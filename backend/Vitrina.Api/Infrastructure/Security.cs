using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;

namespace Vitrina.Api.Infrastructure;

public sealed class CurrentUser(IHttpContextAccessor accessor)
{
	public Guid? Id => accessor.HttpContext?.Items["UserId"] as Guid?;
	public bool IsAuthenticated => Id.HasValue;
}

public sealed class SessionService(VitrinaDbContext db)
{
	public static string Hash(string value) =>
		Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

	public async Task<UserAccount?> ResolveAsync(string token, CancellationToken cancellationToken)
	{
		var hash = Hash(token);
		var session = await db.Sessions.SingleOrDefaultAsync(
			x => x.TokenHash == hash && x.RevokedAt == null, cancellationToken);

		if (session is null || session.ExpiresAt <= DateTimeOffset.UtcNow ||
			session.AbsoluteExpiresAt <= DateTimeOffset.UtcNow)
			return null;

		session.LastActivityAt = DateTimeOffset.UtcNow;
		session.ExpiresAt = Min(DateTimeOffset.UtcNow.AddHours(12), session.AbsoluteExpiresAt);
		var user = await db.Users.SingleOrDefaultAsync(x => x.Id == session.UserId, cancellationToken);
		if (user is null || user.IsBlocked)
			return null;

		await db.SaveChangesAsync(cancellationToken);
		return user;
	}

	public async Task<(string Token, UserSession Session)> CreateAsync(Guid userId, CancellationToken cancellationToken)
	{
		var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
			.TrimEnd('=').Replace('+', '-').Replace('/', '_');
		var now = DateTimeOffset.UtcNow;
		var session = new UserSession
		{
			UserId = userId,
			TokenHash = Hash(token),
			CreatedAt = now,
			LastActivityAt = now,
			ExpiresAt = now.AddHours(12),
			AbsoluteExpiresAt = now.AddDays(7)
		};
		db.Sessions.Add(session);
		await db.SaveChangesAsync(cancellationToken);
		return (token, session);
	}

	public async Task RevokeAsync(string token, CancellationToken cancellationToken)
	{
		var session = await db.Sessions.SingleOrDefaultAsync(
			x => x.TokenHash == Hash(token), cancellationToken);
		if (session is not null && session.RevokedAt is null)
		{
			session.RevokedAt = DateTimeOffset.UtcNow;
			await db.SaveChangesAsync(cancellationToken);
		}
	}

	private static DateTimeOffset Min(DateTimeOffset a, DateTimeOffset b) => a < b ? a : b;
}

public sealed class CsrfService
{
	public string CreateToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
		.TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

public sealed class SessionAuthenticationMiddleware(RequestDelegate next)
{
	public async Task InvokeAsync(HttpContext context, SessionService sessions)
	{
		if (context.Request.Cookies.TryGetValue(CookieName(context), out var token))
		{
			var user = await sessions.ResolveAsync(token, context.RequestAborted);
			if (user is not null)
				context.Items["UserId"] = user.Id;
		}
		await next(context);
	}

	public static string CookieName(HttpContext context) =>
		context.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment()
			? "vitrina_session"
			: "__Host-vitrina_session";
}

public sealed class CsrfMiddleware(RequestDelegate next)
{
	private static readonly HashSet<string> SafeMethods = ["GET", "HEAD", "OPTIONS"];

	public async Task InvokeAsync(HttpContext context)
	{
		if (!SafeMethods.Contains(context.Request.Method.ToUpperInvariant()) &&
			context.Request.Path.StartsWithSegments("/api/v1"))
		{
			var cookie = context.Request.Cookies["vitrina_csrf"];
			var header = context.Request.Headers["X-CSRF-Token"].FirstOrDefault();
			if (string.IsNullOrWhiteSpace(cookie) || string.IsNullOrWhiteSpace(header) ||
				!CryptographicOperations.FixedTimeEquals(
					Encoding.UTF8.GetBytes(cookie), Encoding.UTF8.GetBytes(header)))
			{
				context.Response.StatusCode = StatusCodes.Status403Forbidden;
				await context.Response.WriteAsJsonAsync(new
				{
					code = "csrf_invalid",
					message = "CSRF token is missing or invalid",
					requestId = context.TraceIdentifier
				});
				return;
			}
		}
		await next(context);
	}
}

public sealed class RequestContextMiddleware(RequestDelegate next)
{
	public async Task InvokeAsync(HttpContext context)
	{
		context.Response.Headers["X-Request-Id"] = context.TraceIdentifier;
		await next(context);
	}
}

public interface IAccessPolicy
{
	Task<bool> CanManageCompanyAsync(Guid userId, Guid companyId, CancellationToken cancellationToken);
}

public sealed class AccessPolicy(VitrinaDbContext db) : IAccessPolicy
{
	public async Task<bool> CanManageCompanyAsync(Guid userId, Guid companyId, CancellationToken cancellationToken)
	{
		var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
		if (user is null || user.IsBlocked)
			return false;

		if (user.GlobalRoles.Contains("PLATFORM_ADMIN") || user.GlobalRoles.Contains("UNIVERSITY_STAFF") || user.GlobalPermissions.Contains("cases.manage"))
			return true;

		return await db.CompanyMembers.AnyAsync(x =>
			x.CompanyId == companyId && x.UserId == userId &&
			(x.Permissions.Contains("cases.manage") || x.Permissions.Contains("companies.update")),
			cancellationToken);
	}
}
