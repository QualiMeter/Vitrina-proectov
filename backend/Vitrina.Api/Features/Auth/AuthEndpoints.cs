using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Auth;

public static class AuthEndpoints
{
	public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
	{
		var group = app.MapGroup("/api/v1/auth").WithTags("Auth");

		group.MapGet("/csrf", (HttpContext context, CsrfService csrf) =>
		{
			var token = csrf.CreateToken();
			context.Response.Cookies.Append("vitrina_csrf", token, new CookieOptions
			{
				HttpOnly = false,
				Secure = !context.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment(),
				SameSite = SameSiteMode.Lax,
				Path = "/",
				IsEssential = true
			});
			return Results.Ok(new { csrfToken = token });
		}).AllowAnonymous();

		group.MapPost("/register", Register).RequireRateLimiting("auth").AllowAnonymous();
		group.MapPost("/login", Login).RequireRateLimiting("auth").AllowAnonymous();
		group.MapPost("/logout", Logout);
		group.MapGet("/me", Me);
		group.MapPost("/email-verification/confirm", ConfirmEmail).RequireRateLimiting("auth").AllowAnonymous();
		group.MapPost("/email-verification/resend", ResendEmail).RequireRateLimiting("auth").AllowAnonymous();
		group.MapPost("/password/forgot", ForgotPassword).RequireRateLimiting("auth").AllowAnonymous();
		group.MapPost("/password/reset", ResetPassword).RequireRateLimiting("auth").AllowAnonymous();
		return app;
	}

	private static async Task<IResult> Register(
		RegisterRequest request,
		VitrinaDbContext db,
		IPasswordHasher<UserAccount> hasher,
		IEmailSender emailSender,
		IConfiguration configuration,
		CancellationToken cancellationToken)
	{
		var expectedPolicyVersion = configuration["Privacy:CurrentPolicyVersion"] ?? "v1";
		var nickname = request.Nickname?.Trim();
		var policyVersion = request.PrivacyPolicyVersion?.Trim();
		if (request.Password.Length is < 8 or > 128 ||
			string.IsNullOrWhiteSpace(request.FullName) || request.FullName.Trim().Length > 200 ||
			!new EmailAddressAttribute().IsValid(request.Email) ||
			string.IsNullOrWhiteSpace(nickname) || nickname.Length is < 2 or > 32 ||
			!char.IsLetterOrDigit(nickname[0]) ||
			!nickname.All(c => char.IsLetterOrDigit(c) || c is '_' or '-' or '.') ||
			!request.PrivacyAccepted ||
			string.IsNullOrWhiteSpace(policyVersion) ||
			!string.Equals(policyVersion, expectedPolicyVersion, StringComparison.Ordinal))
			return ApiErrors.BadRequest("validation_failed", "Check email, password, full name, nickname and privacy consent.");

		var email = request.Email.Trim().ToLowerInvariant();
		if (await db.Users.AnyAsync(x => x.Email == email, cancellationToken))
			return ApiErrors.Conflict("email_already_registered", "An account with this email already exists.");
		if (await db.Users.AnyAsync(x => x.Nickname != null && x.Nickname.ToLower() == nickname.ToLower(), cancellationToken))
			return ApiErrors.Conflict("nickname_unavailable", "This nickname is already in use.");

		var user = new UserAccount
		{
			Email = email,
			FullName = request.FullName.Trim(),
			Nickname = nickname,
			PrivacyAcceptedAt = DateTimeOffset.UtcNow,
			PrivacyPolicyVersion = policyVersion
		};
		user.PasswordHash = hasher.HashPassword(user, request.Password);
		db.Users.Add(user);
		db.StudentProfiles.Add(new StudentProfile { UserId = user.Id });
		var verification = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
		db.EmailTokens.Add(new EmailToken
		{
			UserId = user.Id,
			TokenHash = SessionService.Hash(verification),
			Purpose = "EMAIL_CONFIRMATION",
			ExpiresAt = DateTimeOffset.UtcNow.AddHours(24)
		});
		await db.SaveChangesAsync(cancellationToken);
		var confirmationUrl = BuildFrontendLink(configuration, "EmailConfirmationPath", "/verify-email", verification);
		await emailSender.SendAsync(user.Email, "Подтверждение электронной почты",
			$"<p>Для подтверждения адреса перейдите по <a href=\"{confirmationUrl}\">ссылке</a>.</p>",
			cancellationToken);
		return Results.Accepted(value: new { nextAction = "VERIFY_EMAIL", message = "Проверьте почту для подтверждения регистрации." });
	}

	private static async Task<IResult> Login(
		LoginRequest request,
		HttpContext context,
		VitrinaDbContext db,
		IPasswordHasher<UserAccount> hasher,
		SessionService sessions,
		CancellationToken cancellationToken)
	{
		var email = request.Email.Trim().ToLowerInvariant();
		var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email, cancellationToken);
		if (user is null || user.IsBlocked ||
			hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
			return ApiErrors.Unauthorized("invalid_credentials", "Email or password is incorrect.");

		if (!user.EmailConfirmed)
			return ApiErrors.Forbidden("email_not_confirmed", "Confirm your email before signing in.");

		var (token, session) = await sessions.CreateAsync(user.Id, cancellationToken);
		context.Response.Cookies.Append(SessionAuthenticationMiddleware.CookieName(context), token,
			SessionCookie(context, session.ExpiresAt));
		return Results.Ok(await ToAuthSession(user, db, session.ExpiresAt, cancellationToken));
	}

	private static async Task<IResult> Logout(HttpContext context, SessionService sessions, CancellationToken cancellationToken)
	{
		if (context.Request.Cookies.TryGetValue(SessionAuthenticationMiddleware.CookieName(context), out var token))
			await sessions.RevokeAsync(token, cancellationToken);

		context.Response.Cookies.Delete(SessionAuthenticationMiddleware.CookieName(context), SessionCookie(context, DateTimeOffset.UtcNow));
		return Results.NoContent();
	}

	private static async Task<IResult> Me(
		CurrentUser current, HttpContext context, VitrinaDbContext db, CancellationToken cancellationToken)
	{
		if (current.Id is not Guid id ||
			!context.Request.Cookies.TryGetValue(SessionAuthenticationMiddleware.CookieName(context), out var rawToken))
			return ApiErrors.Unauthorized();

		var now = DateTimeOffset.UtcNow;
		var session = await db.Sessions.AsNoTracking().SingleOrDefaultAsync(x =>
			x.UserId == id && x.TokenHash == SessionService.Hash(rawToken) &&
			x.RevokedAt == null && x.ExpiresAt > now && x.AbsoluteExpiresAt > now, cancellationToken);
		var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
		return user is null || session is null
			? ApiErrors.Unauthorized()
			: Results.Ok(await ToAuthSession(user, db, session.ExpiresAt, cancellationToken));
	}

	private static async Task<IResult> ConfirmEmail(
		ConfirmEmailRequest request, HttpContext context, VitrinaDbContext db,
		SessionService sessions, CancellationToken cancellationToken)
	{
		var hash = SessionService.Hash(request.Token);
		var token = await db.EmailTokens.SingleOrDefaultAsync(x =>
			x.TokenHash == hash && x.Purpose == "EMAIL_CONFIRMATION" && x.ConsumedAt == null &&
			x.ExpiresAt > DateTimeOffset.UtcNow, cancellationToken);
		if (token is null)
			return ApiErrors.BadRequest("token_invalid", "Confirmation token is invalid or expired.");

		var user = await db.Users.FindAsync([token.UserId], cancellationToken);
		if (user is null)
			return ApiErrors.BadRequest("token_invalid", "Confirmation token is invalid or expired.");

		user.EmailConfirmed = true;
		token.ConsumedAt = DateTimeOffset.UtcNow;
		await db.SaveChangesAsync(cancellationToken);

		var (sessionToken, session) = await sessions.CreateAsync(user.Id, cancellationToken);
		context.Response.Cookies.Append(SessionAuthenticationMiddleware.CookieName(context), sessionToken,
			SessionCookie(context, session.ExpiresAt));
		context.Response.Headers["Referrer-Policy"] = "no-referrer";
		return Results.Ok(await ToAuthSession(user, db, session.ExpiresAt, cancellationToken));
	}

	private static async Task<IResult> ResendEmail(
		EmailRequest request, VitrinaDbContext db, IEmailSender emailSender,
		IConfiguration configuration, CancellationToken cancellationToken)
	{
		// Always return the same response to avoid account enumeration.
		var user = await db.Users.SingleOrDefaultAsync(x => x.Email == request.Email.Trim().ToLowerInvariant(), cancellationToken);
		if (user is not null && !user.EmailConfirmed)
		{
			var raw = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
			db.EmailTokens.Add(new EmailToken
			{
				UserId = user.Id, TokenHash = SessionService.Hash(raw),
				Purpose = "EMAIL_CONFIRMATION", ExpiresAt = DateTimeOffset.UtcNow.AddHours(24)
			});
			await db.SaveChangesAsync(cancellationToken);
			var url = BuildFrontendLink(configuration, "EmailConfirmationPath", "/verify-email", raw);
			await emailSender.SendAsync(user.Email, "Подтверждение электронной почты",
				$"<p>Для подтверждения адреса перейдите по <a href=\"{url}\">ссылке</a>.</p>",
				cancellationToken);
		}
		return Results.Accepted(value: new { message = "If the account exists, instructions will be sent." });
	}

	private static async Task<IResult> ForgotPassword(
		EmailRequest request, VitrinaDbContext db, IEmailSender emailSender,
		IConfiguration configuration, CancellationToken cancellationToken)
	{
		var user = await db.Users.SingleOrDefaultAsync(x => x.Email == request.Email.Trim().ToLowerInvariant(), cancellationToken);
		if (user is not null)
		{
			var raw = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
			db.EmailTokens.Add(new EmailToken
			{
				UserId = user.Id, TokenHash = SessionService.Hash(raw),
				Purpose = "PASSWORD_RESET", ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(30)
			});
			await db.SaveChangesAsync(cancellationToken);
			var url = BuildFrontendLink(configuration, "PasswordResetPath", "/reset-password", raw);
			await emailSender.SendAsync(user.Email, "Сброс пароля",
				$"<p>Для смены пароля перейдите по <a href=\"{url}\">ссылке</a>. Ссылка действует 30 минут.</p>",
				cancellationToken);
		}
		return Results.Accepted(value: new { message = "If the account exists, reset instructions will be sent." });
	}

	private static async Task<IResult> ResetPassword(
		ResetPasswordRequest request, VitrinaDbContext db,
		IPasswordHasher<UserAccount> hasher, CancellationToken cancellationToken)
	{
		if (request.NewPassword.Length is < 8 or > 128)
			return ApiErrors.BadRequest("validation_failed", "Password must contain 8 to 128 characters.");

		var token = await db.EmailTokens.SingleOrDefaultAsync(x =>
			x.TokenHash == SessionService.Hash(request.Token) && x.Purpose == "PASSWORD_RESET" &&
			x.ConsumedAt == null && x.ExpiresAt > DateTimeOffset.UtcNow, cancellationToken);
		if (token is null)
			return ApiErrors.BadRequest("token_invalid", "Reset token is invalid or expired.");

		var user = await db.Users.FindAsync([token.UserId], cancellationToken);
		if (user is null)
			return ApiErrors.BadRequest("token_invalid", "Reset token is invalid or expired.");

		user.PasswordHash = hasher.HashPassword(user, request.NewPassword);
		token.ConsumedAt = DateTimeOffset.UtcNow;
		var sessions = await db.Sessions.Where(x => x.UserId == user.Id && x.RevokedAt == null).ToListAsync(cancellationToken);
		foreach (var session in sessions)
			session.RevokedAt = DateTimeOffset.UtcNow;
		await db.SaveChangesAsync(cancellationToken);
		return Results.NoContent();
	}

	private static async Task<object> ToAuthSession(
		UserAccount user, VitrinaDbContext db, DateTimeOffset expiresAt, CancellationToken ct)
	{
		var memberships = await db.CompanyMembers.AsNoTracking()
			.Where(x => x.UserId == user.Id)
			.Join(db.Companies.AsNoTracking(), member => member.CompanyId, company => company.Id,
				(member, company) => new
				{
					companyId = company.Id,
					companyName = company.Name,
					membershipRole = member.Role
				}).ToArrayAsync(ct);
		var areas = new List<string>();
		if (user.GlobalRoles.Contains("STUDENT")) areas.Add("student");
		if (memberships.Length > 0) areas.Add("company");
		if (user.GlobalRoles.Contains("UNIVERSITY_STAFF")) areas.Add("university");
		if (user.GlobalRoles.Contains("PLATFORM_ADMIN")) areas.Add("admin");
		if (user.GlobalPermissions.Contains("mentor.access")) areas.Add("mentor");
		return new
		{
			user = new
			{
				id = user.Id,
				email = user.Email,
				fullName = user.FullName,
				nickname = user.Nickname,
				globalRoles = user.GlobalRoles,
				availableAreas = areas,
				permissions = user.GlobalPermissions,
				companyMemberships = memberships
			},
			session = new { expiresAt }
		};
	}

	private static string BuildFrontendLink(
		IConfiguration configuration, string pathSetting, string defaultPath, string token)
	{
		var frontend = (configuration["Email:FrontendBaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
		var path = configuration[$"Email:Routes:{pathSetting}"] ?? defaultPath;
		path = "/" + path.TrimStart('/');
		return $"{frontend}{path}?token={Uri.EscapeDataString(token)}";
	}

	private static CookieOptions SessionCookie(HttpContext context, DateTimeOffset expires) => new()
	{
		HttpOnly = true,
		Secure = !context.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment(),
		SameSite = SameSiteMode.Lax,
		Path = "/",
		Expires = expires,
		IsEssential = true
	};
}

public sealed record RegisterRequest(string Email, string Password, string FullName, string Nickname, bool PrivacyAccepted, string PrivacyPolicyVersion);
public sealed record LoginRequest(string Email, string Password);
public sealed record EmailRequest(string Email);
public sealed record ConfirmEmailRequest(string Token);
public sealed record ResetPasswordRequest(string Token, string NewPassword);
