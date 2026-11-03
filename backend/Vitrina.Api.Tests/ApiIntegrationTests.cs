using Xunit;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.AspNetCore.TestHost;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Vitrina.Api.Infrastructure;
using Vitrina.Api.Data;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace Vitrina.Api.Tests;

public sealed class ApiIntegrationTests : IAsyncLifetime
{
	private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
		.WithDatabase("vitrina_tests")
		.WithUsername("postgres")
		.WithPassword("test-password")
		.Build();

	private WebApplicationFactory<Program>? _factory;
	private HttpClient? _client;
	private readonly RecordingEmailSender _emailSender = new();

	public async ValueTask InitializeAsync()
	{
		var cancellationToken = TestContext.Current.CancellationToken;
		await _postgres.StartAsync(cancellationToken);
		_factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
		{
			builder.UseEnvironment("Development");
			builder.ConfigureAppConfiguration((_, configuration) =>
				configuration.AddInMemoryCollection(new Dictionary<string, string?>
				{
					["ConnectionStrings:Default"] = _postgres.GetConnectionString(),
					["Database:BootstrapSchema"] = "true",
					["Database:AllowProductionBootstrap"] = "false",
					["Redis:ConnectionString"] = "",
					["Email:Host"] = "",
					["Storage:Endpoint"] = "localhost:9000"
				}));
			builder.ConfigureTestServices(services =>
			{
				services.RemoveAll<IEmailSender>();
				services.AddSingleton<IEmailSender>(_emailSender);
			});
		});
		_client = _factory.CreateClient();
	}

	[Fact]
	public async Task Readiness_ReturnsSuccess_WhenDatabaseIsAvailable()
	{
		var response = await Client.GetAsync("/health/ready", TestContext.Current.CancellationToken);

		Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
	}

	[Fact]
	public async Task RegistrationConfirmationLoginAndMe_UseAuthSessionContract()
	{
		var cancellationToken = TestContext.Current.CancellationToken;
		var csrfResponse = await Client.GetAsync("/api/v1/auth/csrf", cancellationToken);
		csrfResponse.EnsureSuccessStatusCode();
		using var csrfJson = JsonDocument.Parse(await csrfResponse.Content.ReadAsStringAsync(cancellationToken));
		var csrfToken = csrfJson.RootElement.GetProperty("csrfToken").GetString()!;

		using var registerRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/register")
		{
			Content = JsonContent.Create(new
			{
				email = "auth-contract@example.test",
				password = "Strong-password-123",
				fullName = "Auth Contract",
				nickname = "auth_contract",
				privacyAccepted = true,
				privacyPolicyVersion = "v1"
			})
		};
		registerRequest.Headers.Add("X-CSRF-Token", csrfToken);
		var registerResponse = await Client.SendAsync(registerRequest, cancellationToken);
		Assert.Equal(System.Net.HttpStatusCode.Accepted, registerResponse.StatusCode);
		using (var pendingJson = JsonDocument.Parse(await registerResponse.Content.ReadAsStringAsync(cancellationToken)))
		{
			Assert.Equal("VERIFY_EMAIL", pendingJson.RootElement.GetProperty("nextAction").GetString());
			Assert.False(pendingJson.RootElement.TryGetProperty("userId", out _));
			Assert.False(pendingJson.RootElement.TryGetProperty("emailConfirmationRequired", out _));
			Assert.False(string.IsNullOrWhiteSpace(pendingJson.RootElement.GetProperty("message").GetString()));
		}
		Assert.NotNull(_emailSender.LastHtmlBody);
		await using (var scope = _factory!.Services.CreateAsyncScope())
		{
			var db = scope.ServiceProvider.GetRequiredService<VitrinaDbContext>();
			var registeredUser = await db.Users.SingleAsync(x => x.Email == "auth-contract@example.test", cancellationToken);
			Assert.Equal("auth_contract", registeredUser.Nickname);
			Assert.Equal("v1", registeredUser.PrivacyPolicyVersion);
			Assert.NotNull(registeredUser.PrivacyAcceptedAt);
		}

		Assert.Equal("/verify-email", ExtractEmailUri(_emailSender.LastHtmlBody!).AbsolutePath);
		var confirmationToken = ExtractEmailToken(_emailSender.LastHtmlBody!);

		using var confirmRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/email-verification/confirm")
		{
			Content = JsonContent.Create(new { token = confirmationToken })
		};
		confirmRequest.Headers.Add("X-CSRF-Token", csrfToken);
		var confirmResponse = await Client.SendAsync(confirmRequest, cancellationToken);
		confirmResponse.EnsureSuccessStatusCode();
		await AssertAuthSessionResponse(confirmResponse, "auth_contract");
		Assert.Contains(confirmResponse.Headers.GetValues("Set-Cookie"), value => value.Contains("vitrina_session="));

		var meResponse = await Client.GetAsync("/api/v1/auth/me", cancellationToken);
		meResponse.EnsureSuccessStatusCode();
		await AssertAuthSessionResponse(meResponse, "auth_contract");

		using var loginRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login")
		{
			Content = JsonContent.Create(new { email = "auth-contract@example.test", password = "Strong-password-123" })
		};
		loginRequest.Headers.Add("X-CSRF-Token", csrfToken);
		var loginResponse = await Client.SendAsync(loginRequest, cancellationToken);
		loginResponse.EnsureSuccessStatusCode();
		await AssertAuthSessionResponse(loginResponse, "auth_contract");

		using var forgotRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/password/forgot")
		{
			Content = JsonContent.Create(new { email = "auth-contract@example.test" })
		};
		forgotRequest.Headers.Add("X-CSRF-Token", csrfToken);
		var forgotResponse = await Client.SendAsync(forgotRequest, cancellationToken);
		Assert.Equal(System.Net.HttpStatusCode.Accepted, forgotResponse.StatusCode);
		Assert.NotNull(_emailSender.LastHtmlBody);
		Assert.Equal("/reset-password", ExtractEmailUri(_emailSender.LastHtmlBody!).AbsolutePath);
		var resetToken = ExtractEmailToken(_emailSender.LastHtmlBody!);

		using var resetRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/password/reset")
		{
			Content = JsonContent.Create(new { token = resetToken, newPassword = "Another-strong-password-456" })
		};
		resetRequest.Headers.Add("X-CSRF-Token", csrfToken);
		var resetResponse = await Client.SendAsync(resetRequest, cancellationToken);
		Assert.Equal(System.Net.HttpStatusCode.NoContent, resetResponse.StatusCode);

		var meAfterReset = await Client.GetAsync("/api/v1/auth/me", cancellationToken);
		Assert.Equal(System.Net.HttpStatusCode.Unauthorized, meAfterReset.StatusCode);
	}

	[Fact]
	public async Task Registration_RejectsMissingPrivacyConsent()
	{
		var cancellationToken = TestContext.Current.CancellationToken;
		var csrfResponse = await Client.GetAsync("/api/v1/auth/csrf", cancellationToken);
		using var csrfJson = JsonDocument.Parse(await csrfResponse.Content.ReadAsStringAsync(cancellationToken));
		var csrfToken = csrfJson.RootElement.GetProperty("csrfToken").GetString()!;
		using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/register")
		{
			Content = JsonContent.Create(new
			{
				email = "no-consent@example.test",
				password = "Strong-password-123",
				fullName = "No Consent",
				nickname = "no_consent",
				privacyAccepted = false,
				privacyPolicyVersion = "v1"
			})
		};
		request.Headers.Add("X-CSRF-Token", csrfToken);
		var response = await Client.SendAsync(request, cancellationToken);
		Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);

		using var wrongVersionRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/register")
		{
			Content = JsonContent.Create(new
			{
				email = "wrong-policy@example.test",
				password = "Strong-password-123",
				fullName = "Wrong Policy",
				nickname = "wrong_policy",
				privacyAccepted = true,
				privacyPolicyVersion = "old-version"
			})
		};
		wrongVersionRequest.Headers.Add("X-CSRF-Token", csrfToken);
		var wrongVersionResponse = await Client.SendAsync(wrongVersionRequest, cancellationToken);
		Assert.Equal(System.Net.HttpStatusCode.BadRequest, wrongVersionResponse.StatusCode);
	}

	private static Uri ExtractEmailUri(string htmlBody)
	{
		var link = Regex.Match(htmlBody, "href=\"(?<url>[^\"]+)\"");
		Assert.True(link.Success);
		return new Uri(link.Groups["url"].Value);
	}

	private static string ExtractEmailToken(string htmlBody)
	{
		var uri = ExtractEmailUri(htmlBody);
		return Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query)["token"].ToString();
	}

	private static async Task AssertAuthSessionResponse(HttpResponseMessage response, string nickname)
	{
		using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
		var root = json.RootElement;
		Assert.True(root.TryGetProperty("user", out var user));
		Assert.True(root.TryGetProperty("session", out var session));
		Assert.Equal(nickname, user.GetProperty("nickname").GetString());
		Assert.True(session.TryGetProperty("expiresAt", out _));
		Assert.False(root.TryGetProperty("id", out _));
	}

	[Fact]
	public async Task Notifications_AreNotAccessibleWithoutSession()
	{
		var response = await Client.GetAsync("/api/v1/notifications", TestContext.Current.CancellationToken);

		Assert.Equal(System.Net.HttpStatusCode.Unauthorized, response.StatusCode);
	}

	[Fact]
	public async Task Liveness_DoesNotRequireDatabaseRequest()
	{
		var response = await Client.GetAsync("/health/live", TestContext.Current.CancellationToken);

		Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
	}

	public async ValueTask DisposeAsync()
	{
		_client?.Dispose();
		if (_factory is not null) await _factory.DisposeAsync();
		await _postgres.DisposeAsync();
	}

	private HttpClient Client => _client ?? throw new InvalidOperationException("Test client is not initialized.");

	private sealed class RecordingEmailSender : IEmailSender
	{
		public string? LastHtmlBody { get; private set; }

		public Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken)
		{
			LastHtmlBody = htmlBody;
			return Task.CompletedTask;
		}
	}
}
