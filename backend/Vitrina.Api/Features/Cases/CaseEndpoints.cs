using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Cases;

public static class CaseEndpoints
{
	public static IEndpointRouteBuilder MapCaseEndpoints(this IEndpointRouteBuilder app)
	{
		var group = app.MapGroup("/api/v1").WithTags("Cases");
		group.MapGet("/public/cases", ListPublic);
		group.MapGet("/public/cases/{caseId:guid}", GetPublic);
		group.MapGet("/companies/{companyId:guid}/cases", ListCompany);
		group.MapPost("/companies/{companyId:guid}/cases", CreateDraft);
		group.MapGet("/cases/{caseId:guid}", GetPrivate);
		group.MapPatch("/cases/{caseId:guid}", UpdateDraft);
		group.MapPost("/cases/{caseId:guid}/submit-moderation", SubmitModeration);
		group.MapGet("/moderation/cases", ListModeration);
		group.MapPost("/cases/{caseId:guid}/moderation-decision", Moderate);
		group.MapPost("/cases/{caseId:guid}/open-registration", OpenRegistration);
		group.MapPost("/cases/{caseId:guid}/close-registration", CloseRegistration);
		group.MapPost("/cases/{caseId:guid}/reopen-registration", ReopenRegistration);
		return app;
	}

	private static async Task<IResult> ListPublic(VitrinaDbContext db, CancellationToken ct)
	{
		var items = await db.Cases.AsNoTracking()
			.Where(x => x.Status == "REGISTRATION_OPEN" || x.Status == "REGISTRATION_CLOSED" ||
						x.Status == "EXECUTING" || x.Status == "FINAL_CLOSED" || x.Status == "EVALUATING" || x.Status == "COMPLETED")
			.OrderByDescending(x => x.CreatedAt)
			.Select(ToPublicProjection)
			.ToListAsync(ct);
		return Results.Ok(new { items, page = 1, pageSize = items.Count, total = items.Count });
	}

	private static async Task<IResult> GetPublic(Guid caseId, VitrinaDbContext db, CancellationToken ct)
	{
		var item = await db.Cases.AsNoTracking()
			.Where(x => x.Id == caseId && x.Status != "DRAFT" && x.Status != "PENDING_MODERATION")
			.Select(ToPublicProjection)
			.SingleOrDefaultAsync(ct);
		return item is null ? ApiErrors.NotFound() : Results.Ok(item);
	}

	private static async Task<IResult> ListCompany(
		Guid companyId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		if (!await db.CompanyMembers.AnyAsync(x => x.CompanyId == companyId && x.UserId == userId, ct))
			return ApiErrors.Forbidden("company_access_denied", "You are not a member of this company.");

		var items = await db.Cases.AsNoTracking().Where(x => x.CompanyId == companyId)
			.OrderByDescending(x => x.UpdatedAt)
			.Select(x => new { caseId = x.Id, x.CompanyId, x.Title, x.Status, x.Version, x.UpdatedAt })
			.ToListAsync(ct);
		return Results.Ok(new { items });
	}

	private static async Task<IResult> CreateDraft(
		Guid companyId, CreateCaseRequest request, CurrentUser current,
		VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		if (!await db.CompanyMembers.AnyAsync(x => x.CompanyId == companyId && x.UserId == userId &&
				(x.Permissions.Contains("cases.manage") || x.Permissions.Contains("companies.update")), ct))
			return ApiErrors.Forbidden("case_management_forbidden", "You cannot manage cases for this company.");
		if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200)
			return ApiErrors.BadRequest("validation_failed", "Title is required and must be at most 200 characters.");

		var entity = new CaseProject { CompanyId = companyId, Title = request.Title.Trim() };
		db.Cases.Add(entity);
		db.AuditEntries.Add(new AuditEntry
		{
			ActorUserId = userId, Action = "case.created", ResourceType = "Case", ResourceId = entity.Id
		});
		await db.SaveChangesAsync(ct);
		return Results.Created($"/api/v1/cases/{entity.Id}", ToPrivate(entity));
	}

	private static async Task<IResult> GetPrivate(
		Guid caseId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		var entity = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (entity is null)
			return ApiErrors.NotFound();
		if (!await db.CompanyMembers.AnyAsync(x => x.CompanyId == entity.CompanyId && x.UserId == userId, ct))
			return ApiErrors.Forbidden("case_access_denied", "You cannot access this case.");
		return Results.Ok(ToPrivate(entity));
	}

	private static async Task<IResult> UpdateDraft(
		Guid caseId, UpdateCaseRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		var entity = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (entity is null)
			return ApiErrors.NotFound();
		if (!await db.CompanyMembers.AnyAsync(x => x.CompanyId == entity.CompanyId && x.UserId == userId &&
				x.Permissions.Contains("cases.manage"), ct))
			return ApiErrors.Forbidden("case_management_forbidden", "You cannot manage this case.");
		if (entity.Status != "DRAFT" && entity.Status != "REVISION_REQUIRED")
			return ApiErrors.Conflict("case_not_editable", "Only draft or revision-requested cases can be edited.");
		if (request.ExpectedVersion != entity.Version)
			return ApiErrors.Conflict("version_conflict", "The case has changed. Reload it and retry.");

		entity.Description = request.Description?.Trim();
		entity.ParticipationFormat = request.ParticipationFormat;
		entity.AdmissionMode = request.AdmissionMode;
		entity.RegistrationDeadline = request.RegistrationDeadline;
		entity.MinTeamSize = request.MinTeamSize;
		entity.MaxTeamSize = request.MaxTeamSize;
		entity.MaxAdmittedTeams = request.MaxAdmittedTeams;
		entity.MaxAdmittedSolo = request.MaxAdmittedSolo;
		if (request.ContestRules is not null)
		{
			var rules = request.ContestRules;
			if (rules.PrizePlaceCount is < 0 or > 100 || rules.NominationNames is null || rules.NominationNames.Length > 100 ||
				rules.NominationNames.Any(x => string.IsNullOrWhiteSpace(x) || x.Trim().Length > 120) ||
				rules.NominationNames.Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() != rules.NominationNames.Length ||
				(rules.ScoreRange is not null && rules.ScoreRange.Min >= rules.ScoreRange.Max))
				return ApiErrors.BadRequest(
				"invalid_contest_rules",
				"Contest rules contain an invalid place count, nomination list or score range.");
			entity.AllowSharedPlaces = rules.AllowSharedPlaces;
			entity.PrizePlaceCount = rules.PrizePlaceCount;
			entity.NominationNames = rules.NominationNames.Select(x => x.Trim()).ToArray();
			entity.ScoreRangeMin = rules.ScoreRange?.Min;
			entity.ScoreRangeMax = rules.ScoreRange?.Max;
		}
		entity.Version++;
		entity.UpdatedAt = DateTimeOffset.UtcNow;
		await db.SaveChangesAsync(ct);
		return Results.Ok(ToPrivate(entity));
	}

	private static async Task<IResult> SubmitModeration(
		Guid caseId, VersionRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		var entity = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (entity is null)
			return ApiErrors.NotFound();
		if (!await db.CompanyMembers.AnyAsync(x => x.CompanyId == entity.CompanyId && x.UserId == userId &&
				x.Permissions.Contains("cases.manage"), ct))
			return ApiErrors.Forbidden("case_management_forbidden", "You cannot manage this case.");
		if (entity.Version != request.ExpectedVersion)
			return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (string.IsNullOrWhiteSpace(entity.Description) || entity.Description.Length < 20 ||
			entity.ParticipationFormat is null || entity.AdmissionMode is null)
			return ApiErrors.BadRequest("case_incomplete", "Complete the case description and participation settings first.");

		entity.Status = "PENDING_MODERATION";
		entity.Version++;
		entity.UpdatedAt = DateTimeOffset.UtcNow;
		await db.SaveChangesAsync(ct);
		return Results.Ok(ToPrivate(entity));
	}

	private static async Task<IResult> ListModeration(CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var moderator = await db.Users.AsNoTracking().AnyAsync(x => x.Id == userId && x.GlobalRoles.Contains("MODERATOR") && !x.IsBlocked, ct);
		if (!moderator) return ApiErrors.Forbidden("moderation_forbidden", "Moderator role is required.");
		var items = await db.Cases.AsNoTracking().Where(x => x.Status == "PENDING_MODERATION")
			.OrderBy(x => x.CreatedAt).Select(x => new { caseId = x.Id, x.CompanyId, x.Title, x.Description, x.Status, x.Version, x.CreatedAt }).ToListAsync(ct);
		return Results.Ok(new { items });
	}

	private static async Task<IResult> Moderate(Guid caseId, ModerationDecisionRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		if (!await db.Users.AnyAsync(x => x.Id == userId && x.GlobalRoles.Contains("MODERATOR") && !x.IsBlocked, ct))
			return ApiErrors.Forbidden("moderation_forbidden", "Moderator role is required.");
		var entity = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (entity is null) return ApiErrors.NotFound();
		if (entity.Status != "PENDING_MODERATION") return ApiErrors.Conflict("case_not_pending_moderation", "Case is not awaiting moderation.");
		if (entity.Version != request.ExpectedVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (request.Action is not ("APPROVE" or "REVISION" or "REJECT")) return ApiErrors.BadRequest("invalid_action", "Action must be APPROVE, REVISION or REJECT.");
		if (request.Action != "APPROVE" && string.IsNullOrWhiteSpace(request.Reason)) return ApiErrors.BadRequest("reason_required", "A reason is required.");
		var from = entity.Status;
		entity.Status = request.Action switch { "APPROVE" => "APPROVED", "REVISION" => "REVISION_REQUIRED", _ => "REJECTED" };
		entity.Version++;
		entity.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "case.moderated", ResourceType = "Case", ResourceId = caseId, DetailsJson = System.Text.Json.JsonSerializer.Serialize(new { from, entity.Status, request.Reason }) });
		await db.SaveChangesAsync(ct);
		return Results.Ok(ToPrivate(entity));
	}

	private static Task<IResult> OpenRegistration(Guid caseId, VersionRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct) =>
		ChangeRegistration(caseId, request, "OPEN", current, db, ct);

	private static Task<IResult> CloseRegistration(Guid caseId, VersionRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct) =>
		ChangeRegistration(caseId, request, "CLOSE", current, db, ct);

	private static Task<IResult> ReopenRegistration(Guid caseId, VersionRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct) =>
		ChangeRegistration(caseId, request, "REOPEN", current, db, ct);

	private static async Task<IResult> ChangeRegistration(Guid caseId, VersionRequest request, string action, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var entity = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (entity is null) return ApiErrors.NotFound();
		if (!await db.CompanyMembers.AnyAsync(x => x.CompanyId == entity.CompanyId && x.UserId == userId && x.Permissions.Contains("cases.manage"), ct))
			return ApiErrors.Forbidden("case_management_forbidden", "You cannot manage this case.");
		if (entity.Version != request.ExpectedVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (action == "OPEN" && entity.Status != "APPROVED") return ApiErrors.Conflict("case_not_approved", "Only approved cases can open registration.");
		if (action == "CLOSE" && entity.Status != "REGISTRATION_OPEN") return ApiErrors.Conflict("registration_not_open", "Registration is not open.");
		if (action == "REOPEN" && entity.Status != "REGISTRATION_CLOSED") return ApiErrors.Conflict("registration_not_closed", "Registration is not closed.");
		if (action != "CLOSE" && entity.RegistrationDeadline <= DateTimeOffset.UtcNow) return ApiErrors.Conflict("registration_deadline_passed", "Registration deadline has passed.");
		entity.Status = action == "CLOSE" ? "REGISTRATION_CLOSED" : "REGISTRATION_OPEN";
		entity.Version++;
		entity.UpdatedAt = DateTimeOffset.UtcNow;
		await db.TeamInvitations.Where(x => db.Teams.Any(t => t.Id == x.TeamId && t.CaseId == caseId) && x.Status == "PENDING")
			.ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "EXPIRED"), ct);
		await db.SaveChangesAsync(ct);
		return Results.Ok(ToPrivate(entity));
	}

	private static object ToPrivate(CaseProject x) => new
	{
		id = x.Id, caseId = x.Id, companyId = x.CompanyId, x.Title, x.Description, x.Status,
		x.ParticipationFormat, x.AdmissionMode, x.RegistrationDeadline, x.MinTeamSize,
		x.MaxTeamSize, x.MaxAdmittedTeams, x.MaxAdmittedSolo, x.Version,
		contestRules = new
		{
			x.AllowSharedPlaces,
			x.PrizePlaceCount,
			nominationNames = x.NominationNames,
			scoreRange = x.ScoreRangeMin is decimal min && x.ScoreRangeMax is decimal max
				? new { min, max }
				: null
		}
	};

	private static readonly System.Linq.Expressions.Expression<Func<CaseProject, object>> ToPublicProjection =
		x => new
		{
			caseId = x.Id,
			x.CompanyId,
			x.Title,
			x.Description,
			x.Status,
			x.ParticipationFormat,
			x.AdmissionMode,
			contestRules = new
			{
				x.AllowSharedPlaces,
				x.PrizePlaceCount,
				nominationNames = x.NominationNames,
				scoreRange = x.ScoreRangeMin.HasValue && x.ScoreRangeMax.HasValue
					? new { min = x.ScoreRangeMin.Value, max = x.ScoreRangeMax.Value }
					: null
			}
		};
}

public sealed record CreateCaseRequest(string Title);
public sealed record UpdateCaseRequest(
	int ExpectedVersion, string? Description, string? ParticipationFormat, string? AdmissionMode,
	DateTimeOffset? RegistrationDeadline, int? MinTeamSize, int? MaxTeamSize,
	int? MaxAdmittedTeams, int? MaxAdmittedSolo, CaseContestRulesRequest? ContestRules = null);
public sealed record CaseContestRulesRequest(bool AllowSharedPlaces, int PrizePlaceCount, string[] NominationNames, CaseScoreRangeRequest? ScoreRange);
public sealed record CaseScoreRangeRequest(decimal Min, decimal Max);
public sealed record VersionRequest(int ExpectedVersion);

public sealed record ModerationDecisionRequest(int ExpectedVersion, string Action, string? Reason);
