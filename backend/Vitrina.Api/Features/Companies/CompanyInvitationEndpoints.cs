using Microsoft.AspNetCore.RateLimiting;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Companies;

public static class CompanyInvitationEndpoints
{
	public static IEndpointRouteBuilder MapCompanyInvitationEndpoints(this IEndpointRouteBuilder app)
	{
		var group = app.MapGroup("/api/v1").WithTags("Invitations");
		group.MapGet("/companies/{companyId:guid}/invitations", List);
		group.MapPost("/companies/{companyId:guid}/invitations", Create);
		group.MapPost("/company-invitations/preview", Preview).RequireRateLimiting("auth").AllowAnonymous();
		group.MapPost("/company-invitations/accept", Accept).RequireRateLimiting("auth").AllowAnonymous();
		return app;
	}

	private static async Task<IResult> List(
		Guid companyId, int page, int pageSize, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		if (!await db.Companies.AnyAsync(x => x.Id == companyId, ct)) return ApiErrors.NotFound();
		if (!await CanInvite(db, userId, companyId, ct))
			return ApiErrors.Forbidden("company_invitation_forbidden", "You cannot manage invitations for this company.");

		page = Math.Max(1, page);
		pageSize = Math.Clamp(pageSize == 0 ? 20 : pageSize, 1, 100);
		var query = db.CompanyInvitations.AsNoTracking().Where(x => x.CompanyId == companyId);
		var total = await query.CountAsync(ct);
		var items = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize)
			.Take(pageSize).Select(x => new
			{
				id = x.Id, email = x.Email, role = x.Role, status = EffectiveStatus(x.Status, x.ExpiresAt),
				createdAt = x.CreatedAt, expiresAt = x.ExpiresAt, acceptedAt = x.AcceptedAt
			}).ToListAsync(ct);
		return Results.Ok(new { items, page, pageSize, total });
	}

	private static async Task<IResult> Create(
		Guid companyId, CreateCompanyInvitationRequest request, CurrentUser current,
		VitrinaDbContext db, IEmailSender emailSender, IConfiguration configuration, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		if (!await db.Companies.AnyAsync(x => x.Id == companyId, ct)) return ApiErrors.NotFound();
		if (!await CanInvite(db, userId, companyId, ct))
			return ApiErrors.Forbidden("company_invitation_forbidden", "You cannot invite representatives to this company.");
		if (request.Role == "OWNER" && !await CanGrantOwner(db, userId, companyId, ct))
			return ApiErrors.Forbidden("owner_role_forbidden", "Only an owner or university administrator can invite another owner.");
		if (!System.Net.Mail.MailAddress.TryCreate(request.Email, out var address) ||
			!string.Equals(address.Address, request.Email.Trim(), StringComparison.OrdinalIgnoreCase) ||
			request.Role is not ("OWNER" or "MEMBER"))
			return ApiErrors.BadRequest("validation_failed", "A valid email and invitation role are required.");

		var email = address.Address.ToLowerInvariant();
		var company = await db.Companies.SingleOrDefaultAsync(x => x.Id == companyId, ct);
		if (company is null)
			return ApiErrors.NotFound();
		if (await db.CompanyMembers.AnyAsync(x => x.CompanyId == companyId &&
			 db.Users.Any(u => u.Id == x.UserId && u.Email == email), ct))
			return ApiErrors.Conflict("already_company_member", "This user is already a company member.");

		var pending = await db.CompanyInvitations.Where(x => x.CompanyId == companyId && x.Email == email && x.Status == "PENDING")
			.ToListAsync(ct);
		foreach (var old in pending)
			old.Status = "REVOKED";

		var token = CreateToken();
		var invitation = new CompanyInvitation
		{
			CompanyId = companyId,
			Email = email,
			Role = request.Role,
			TokenHash = SessionService.Hash(token),
			InvitedByUserId = userId,
			ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
		};
		db.CompanyInvitations.Add(invitation);
		db.AuditEntries.Add(new AuditEntry
		{
			ActorUserId = userId, Action = "company.invitation.created",
			ResourceType = "CompanyInvitation", ResourceId = invitation.Id,
			DetailsJson = System.Text.Json.JsonSerializer.Serialize(new { companyId, email, invitation.Role })
		});
		await db.SaveChangesAsync(ct);

		var frontend = (configuration["Email:FrontendBaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
		var invitationPath = configuration["Email:Routes:CompanyInvitationPath"] ?? "/accept-invitation";
		var safeCompany = System.Net.WebUtility.HtmlEncode(company.Name);
		var link = $"{frontend}/{invitationPath.TrimStart('/')}?token={Uri.EscapeDataString(token)}";
		try
		{
			await emailSender.SendAsync(email, $"Приглашение в компанию {company.Name}",
				$"<p>Вас пригласили представителем компании <b>{safeCompany}</b>.</p><p><a href=\"{link}\">Посмотреть и принять приглашение</a></p><p>Ссылка действует 7 дней.</p>", ct);
		}
		catch (Exception)
		{
			invitation.Status = "REVOKED";
			await db.SaveChangesAsync(ct);
			return Results.Problem("Invitation email could not be delivered.", statusCode: StatusCodes.Status503ServiceUnavailable);
		}

		return Results.Created($"/api/v1/companies/{companyId}/invitations/{invitation.Id}", Summary(invitation));
	}

	private static async Task<IResult> Preview(
		TokenRequest request, VitrinaDbContext db, CancellationToken ct)
	{
		if (string.IsNullOrWhiteSpace(request.Token) || request.Token.Length > 2048)
			return ApiErrors.BadRequest("invalid_invitation", "Invitation is invalid or expired.");
		var invitation = await db.CompanyInvitations.AsNoTracking()
			.SingleOrDefaultAsync(x => x.TokenHash == SessionService.Hash(request.Token), ct);
		if (invitation is null || invitation.Status != "PENDING" || invitation.ExpiresAt <= DateTimeOffset.UtcNow)
			return ApiErrors.NotFound();
		var company = await db.Companies.AsNoTracking().SingleOrDefaultAsync(x => x.Id == invitation.CompanyId, ct);
		if (company is null)
			return ApiErrors.NotFound();
		return Results.Ok(new
		{
			companyId = company.Id, companyName = company.Name, role = invitation.Role,
			expiresAt = invitation.ExpiresAt, maskedEmail = MaskEmail(invitation.Email)
		});
	}

	private static async Task<IResult> Accept(
		AcceptCompanyInvitationRequest request, CurrentUser current, VitrinaDbContext db,
		SessionService sessions, IPasswordHasher<UserAccount> hasher, HttpContext http,
		CancellationToken ct)
	{
		if (string.IsNullOrWhiteSpace(request.Token) || request.Token.Length > 2048)
			return ApiErrors.BadRequest("invalid_invitation", "Invitation is invalid or expired.");
		await using var transaction = await db.Database.BeginTransactionAsync(ct);
		var invitation = await db.CompanyInvitations.SingleOrDefaultAsync(
			x => x.TokenHash == SessionService.Hash(request.Token), ct);
		if (invitation is null || invitation.Status != "PENDING" || invitation.ExpiresAt <= DateTimeOffset.UtcNow)
			return ApiErrors.NotFound();

		UserAccount? user;
		var isNew = request.Mode == "new";
		if (request.Mode == "existing")
		{
			if (current.Id is not Guid userId)
				return ApiErrors.Unauthorized();
			user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, ct);
			if (user is null || !string.Equals(user.Email, invitation.Email, StringComparison.OrdinalIgnoreCase))
				return ApiErrors.Forbidden("invitation_email_mismatch", "The signed-in account does not match the invitation email.");
		}
		else if (request.Mode == "new")
		{
			if (current.IsAuthenticated)
				return ApiErrors.Conflict("already_authenticated", "Sign out before accepting as a new account.");
			if (!request.PrivacyAccepted || string.IsNullOrWhiteSpace(request.PrivacyPolicyVersion) ||
				string.IsNullOrWhiteSpace(request.FullName) || request.FullName.Length > 200 ||
				string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 10 || request.Password.Length > 128)
				return ApiErrors.BadRequest("validation_failed", "The registration data is invalid.");
			if (await db.Users.AnyAsync(x => x.Email == invitation.Email, ct))
				return ApiErrors.Conflict("account_already_exists", "An account with this email already exists. Sign in to accept the invitation.");
			var nickname = await CreateUniqueNickname(db, invitation.Email.Split('@')[0], ct);
			user = new UserAccount
			{
				Email = invitation.Email,
				FullName = request.FullName.Trim(),
				Nickname = nickname,
				GlobalRoles = ["STUDENT"],
				EmailConfirmed = true,
				PrivacyAcceptedAt = DateTimeOffset.UtcNow,
				PrivacyPolicyVersion = request.PrivacyPolicyVersion!.Trim()
			};
			user.PasswordHash = hasher.HashPassword(user, request.Password);
			db.Users.Add(user);
			db.StudentProfiles.Add(new StudentProfile { UserId = user.Id });
		}
		else
		{
			return ApiErrors.BadRequest("validation_failed", "Mode must be existing or new.");
		}

		if (await db.CompanyMembers.AnyAsync(x => x.CompanyId == invitation.CompanyId && x.UserId == user!.Id, ct))
			return ApiErrors.Conflict("already_company_member", "This account is already a company member.");

		db.CompanyMembers.Add(new CompanyMember
		{
			CompanyId = invitation.CompanyId,
			UserId = user!.Id,
			Role = invitation.Role,
			Permissions = invitation.Role == "OWNER"
				? ["companies.readPrivate", "companies.update", "companies.invite", "students.read", "cases.manage"]
				: ["companies.readPrivate", "students.read"]
		});
		invitation.Status = "ACCEPTED";
		invitation.AcceptedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry
		{
			ActorUserId = user.Id,
			Action = "company.invitation.accepted",
			ResourceType = "Company",
			ResourceId = invitation.CompanyId,
			DetailsJson = System.Text.Json.JsonSerializer.Serialize(new
			{
				invitationId = invitation.Id,
				mode = request.Mode,
				privacyPolicyVersion = isNew ? request.PrivacyPolicyVersion : null
			})
		});
		try
		{
			await db.SaveChangesAsync(ct);
		}
		catch (DbUpdateConcurrencyException)
		{
			return ApiErrors.Conflict("invitation_already_used", "This invitation has already been accepted or revoked.");
		}
		await transaction.CommitAsync(ct);

		if (isNew)
		{
			var (sessionToken, session) = await sessions.CreateAsync(user.Id, ct);
			SetSessionCookie(http, sessionToken);
			return Results.Created("/api/v1/auth/me", await BuildAuthSessionAsync(user, db, session.ExpiresAt, ct));
		}
		var existingExpiry = await db.Sessions.Where(x => x.UserId == user.Id && x.RevokedAt == null)
			.OrderByDescending(x => x.CreatedAt).Select(x => (DateTimeOffset?)x.ExpiresAt).FirstOrDefaultAsync(ct);
		return Results.Ok(await BuildAuthSessionAsync(user, db, existingExpiry, ct));
	}

	private static async Task<object> BuildAuthSessionAsync(
		UserAccount user, VitrinaDbContext db, DateTimeOffset? expiresAt, CancellationToken ct)
	{
		var memberships = await db.CompanyMembers.AsNoTracking()
			.Where(x => x.UserId == user.Id)
			.Join(db.Companies.AsNoTracking(), member => member.CompanyId, company => company.Id,
				(member, company) => new { companyId = company.Id, companyName = company.Name, membershipRole = member.Role })
			.ToArrayAsync(ct);
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
				id = user.Id, email = user.Email, fullName = user.FullName, nickname = user.Nickname,
				globalRoles = user.GlobalRoles, availableAreas = areas,
				permissions = user.GlobalPermissions, companyMemberships = memberships
			},
			session = new { expiresAt }
		};
	}

	private static async Task<string> CreateUniqueNickname(VitrinaDbContext db, string seed, CancellationToken ct)
	{
		var candidate = new string(seed.Where(char.IsLetterOrDigit).Take(32).ToArray());
		if (candidate.Length < 2) candidate = "student";
		var suffix = 1;
		while (await db.Users.AnyAsync(x => x.Nickname == candidate, ct))
			candidate = $"{candidate[..Math.Min(candidate.Length, 32)]}{suffix++}";
		return candidate;
	}

	private static async Task<bool> CanInvite(VitrinaDbContext db, Guid userId, Guid companyId, CancellationToken ct)
	{
		var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId && !x.IsBlocked, ct);
		if (user is null)
			return false;
		if (user.GlobalRoles.Contains("PLATFORM_ADMIN") || user.GlobalRoles.Contains("UNIVERSITY_STAFF") || user.GlobalPermissions.Contains("companies.invite"))
			return await db.Companies.AnyAsync(x => x.Id == companyId, ct);
		return await db.CompanyMembers.AnyAsync(x => x.CompanyId == companyId && x.UserId == userId &&
			x.Permissions.Contains("companies.invite"), ct);
	}

	private static async Task<bool> CanGrantOwner(VitrinaDbContext db, Guid userId, Guid companyId, CancellationToken ct)
	{
		var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId && !x.IsBlocked, ct);
		if (user is null) return false;
		if (user.GlobalRoles.Contains("PLATFORM_ADMIN") || user.GlobalRoles.Contains("UNIVERSITY_STAFF")) return true;
		if (user.GlobalPermissions.Contains("companies.invite")) return true;
		return await db.CompanyMembers.AnyAsync(x => x.CompanyId == companyId && x.UserId == userId && x.Role == "OWNER", ct);
	}

	private static string CreateToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
		.TrimEnd('=').Replace('+', '-').Replace('/', '_');

	private static string EffectiveStatus(string status, DateTimeOffset expiresAt) =>
		status == "PENDING" && expiresAt <= DateTimeOffset.UtcNow ? "EXPIRED" : status;

	private static string MaskEmail(string email)
	{
		var parts = email.Split('@', 2);
		return parts.Length != 2 ? "***" : $"{parts[0][..1]}***@{parts[1]}";
	}

	private static object Summary(CompanyInvitation invitation) => new
	{
		id = invitation.Id, email = invitation.Email, role = invitation.Role, status = invitation.Status,
		createdAt = invitation.CreatedAt, expiresAt = invitation.ExpiresAt, acceptedAt = invitation.AcceptedAt
	};

	private static void SetSessionCookie(HttpContext http, string token)
	{
		var isDevelopment = http.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment();
		http.Response.Cookies.Append(isDevelopment ? "vitrina_session" : "__Host-vitrina_session", token,
			new CookieOptions
			{
				HttpOnly = true, Secure = !isDevelopment, SameSite = SameSiteMode.Lax,
				Path = "/", IsEssential = true, MaxAge = TimeSpan.FromDays(7)
			});
	}
}

public sealed record CreateCompanyInvitationRequest(string Email, string Role);
public sealed record TokenRequest(string Token);
public sealed record AcceptCompanyInvitationRequest(
	string Mode, string Token, string? FullName, string? Password, bool PrivacyAccepted, string? PrivacyPolicyVersion);
