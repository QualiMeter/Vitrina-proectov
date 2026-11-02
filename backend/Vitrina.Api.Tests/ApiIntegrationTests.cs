using Xunit;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
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
}
