using System.Data;
using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Applications;

public static class ApplicationEndpoints
{
	public static IEndpointRouteBuilder MapApplicationEndpoints(this IEndpointRouteBuilder app)
	{
		var api = app.MapGroup("/api/v1").WithTags("Applications");
		api.MapPost("/cases/{caseId:guid}/applications", Create);
		api.MapGet("/cases/{caseId:guid}/applications", ListForCompany);
		api.MapGet("/cases/{caseId:guid}/applications/mine", Mine);
		api.MapGet("/applications/{applicationId:guid}", Get);
		api.MapPatch("/applications/{applicationId:guid}", Update);
		api.MapPost("/applications/{applicationId:guid}/submit", Submit);
		api.MapPost("/applications/{applicationId:guid}/withdraw", Withdraw);
		api.MapPost("/applications/{applicationId:guid}/decision", Decide);
		api.MapGet("/applications/{applicationId:guid}/events", Events);
		return app;
	}

	private static async Task<IResult> Create(Guid caseId, CreateApplicationRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (project.Status != "REGISTRATION_OPEN" || project.RegistrationDeadline <= DateTimeOffset.UtcNow)
			return ApiErrors.Conflict("registration_closed", "Registration is not open.");
		if (request.Format is not ("SOLO" or "TEAM")) return ApiErrors.BadRequest("invalid_format", "Format must be SOLO or TEAM.");
		Guid[] participants;
		Guid? teamId = null;
		Guid? soloId = null;
		if (request.Format == "SOLO")
		{
			if (project.ParticipationFormat == "TEAM") return ApiErrors.Conflict("solo_not_allowed", "Solo applications are not allowed.");
			soloId = userId;
			participants = [userId];
		}
		else
		{
			if (project.ParticipationFormat == "SOLO" || request.TeamId is not Guid requestedTeamId)
				return ApiErrors.BadRequest("invalid_team_application", "A valid teamId is required.");
			var team = await db.Teams.SingleOrDefaultAsync(x => x.Id == requestedTeamId && x.CaseId == caseId, ct);
			if (team is null) return ApiErrors.NotFound();
			if (team.CaptainUserId != userId) return ApiErrors.Forbidden("captain_required", "Only the team captain can create the application.");
			if (team.IsLocked) return ApiErrors.Conflict("team_locked", "The team is already locked.");
			teamId = team.Id;
			participants = await db.TeamMembers.Where(x => x.TeamId == team.Id).Select(x => x.UserId).ToArrayAsync(ct);
			if (participants.Length < (project.MinTeamSize ?? 1) || (project.MaxTeamSize is int max && participants.Length > max))
				return ApiErrors.Conflict("team_size_invalid", "The team does not satisfy the configured size limits.");
			if (await db.TeamInvitations.AnyAsync(x => x.TeamId == team.Id && x.Status == "PENDING" && x.ExpiresAt > DateTimeOffset.UtcNow, ct))
				return ApiErrors.Conflict("pending_invitations", "Resolve pending team invitations before creating an application.");
		}
		if (await db.ParticipationHistory.AnyAsync(x => x.CaseId == caseId && participants.Contains(x.UserId), ct))
			return ApiErrors.Conflict("participation_already_exists", "A participant has already applied to this case.");
		if (await db.Applications.AnyAsync(x => x.CaseId == caseId && x.Status == "DRAFT" && (x.SoloApplicantUserId == soloId || (teamId != null && x.TeamId == teamId)), ct))
			return ApiErrors.Conflict("draft_exists", "A draft already exists for this applicant.");
		var application = new CaseApplication { CaseId = caseId, Format = request.Format, TeamId = teamId, SoloApplicantUserId = soloId, CreatedByUserId = userId, ParticipantUserIds = participants };
		db.Applications.Add(application);
		db.ApplicationEvents.Add(new CaseApplicationEvent { ApplicationId = application.Id, ToStatus = "DRAFT", ActorUserId = userId });
		await db.SaveChangesAsync(ct);
		return Results.Created($"/api/v1/applications/{application.Id}", Dto(application, userId));
	}

	private static async Task<IResult> ListForCompany(Guid caseId, string? status, string? format, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await db.CompanyMembers.AnyAsync(x => x.CompanyId == project.CompanyId && x.UserId == userId && (x.Permissions.Contains("applications.read") || x.Permissions.Contains("cases.manage")), ct))
			return ApiErrors.Forbidden("application_access_denied", "You cannot review applications for this case.");
		var query = db.Applications.AsNoTracking().Where(x => x.CaseId == caseId);
		if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
		if (!string.IsNullOrWhiteSpace(format)) query = query.Where(x => x.Format == format);
		var items = await query.OrderByDescending(x => x.SubmittedAt ?? x.CreatedAt).Take(100).ToListAsync(ct);
		return Results.Ok(new { items = items.Select(x => Dto(x, userId)), page = 1, pageSize = items.Count, total = items.Count });
	}

	private static async Task<IResult> Mine(Guid caseId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var items = await db.Applications.AsNoTracking().Where(x => x.CaseId == caseId && (x.ParticipantUserIds.Contains(userId)))
			.OrderByDescending(x => x.UpdatedAt).Take(100).ToListAsync(ct);
		return Results.Ok(new { items = items.Select(x => Dto(x, userId)), page = 1, pageSize = items.Count, total = items.Count });
	}

	private static async Task<IResult> Get(Guid applicationId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var app = await db.Applications.AsNoTracking().SingleOrDefaultAsync(x => x.Id == applicationId, ct);
		if (app is null) return ApiErrors.NotFound();
		if (!await CanRead(app, userId, db, ct)) return ApiErrors.Forbidden("application_access_denied", "You cannot access this application.");
		return Results.Ok(Dto(app, userId));
	}

	private static async Task<IResult> Update(Guid applicationId, UpdateApplicationRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var app = await db.Applications.SingleOrDefaultAsync(x => x.Id == applicationId, ct);
		if (app is null) return ApiErrors.NotFound();
		if (!await CanManageAsync(app, userId, db, ct)) return ApiErrors.Forbidden("application_edit_forbidden", "Only the applicant or team captain can edit this draft.");
		if (app.Status != "DRAFT") return ApiErrors.Conflict("application_not_editable", "Only drafts can be edited.");
		if (app.Version != request.ExpectedVersion) return ApiErrors.Conflict("version_conflict", "The application has changed.");
		if (request.CoverLetter?.Length > 5000) return ApiErrors.BadRequest("validation_failed", "Cover letter is too long.");
		app.CoverLetter = request.CoverLetter?.Trim();
		app.Version++;
		app.UpdatedAt = DateTimeOffset.UtcNow;
		await db.SaveChangesAsync(ct);
		return Results.Ok(Dto(app, userId));
	}

	private static async Task<IResult> Submit(Guid applicationId, ApplicationVersionRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
		var app = await db.Applications.SingleOrDefaultAsync(x => x.Id == applicationId, ct);
		if (app is null) return ApiErrors.NotFound();
		if (!await CanManageAsync(app, userId, db, ct)) return ApiErrors.Forbidden("application_submit_forbidden", "Only the applicant or team captain can submit.");
		if (app.Status != "DRAFT") return ApiErrors.Conflict("application_not_draft", "Only drafts can be submitted.");
		if (app.Version != request.ExpectedVersion) return ApiErrors.Conflict("version_conflict", "The application has changed.");
		var project = await db.Cases.SingleAsync(x => x.Id == app.CaseId, ct);
		if (project.Status != "REGISTRATION_OPEN" || project.RegistrationDeadline <= DateTimeOffset.UtcNow)
			return ApiErrors.Conflict("registration_closed", "Registration is not open.");
		if (project.AdmissionMode == "SELECTIVE" && string.IsNullOrWhiteSpace(app.CoverLetter))
			return ApiErrors.BadRequest("cover_letter_required", "A cover letter is required for selective admission.");
		var ndaPolicy = await db.NdaPolicies.SingleOrDefaultAsync(x => x.CaseId == project.Id, ct);
		if (ndaPolicy is { IsRequired: true })
		{
			var acceptance = request.NdaAcceptance;
			if (acceptance is null || !acceptance.Accepted || acceptance.Version != ndaPolicy.Version)
				return ApiErrors.Conflict("nda_acceptance_required", "Accept the current NDA version before submitting the application.");
			var acceptedAt = DateTimeOffset.UtcNow;
			app.NdaAcceptedVersion = ndaPolicy.Version;
			app.NdaAcceptedByUserId = userId;
			app.NdaAcceptedAt = acceptedAt;
			db.NdaAcceptances.Add(new NdaAcceptance
			{
				CaseId = project.Id,
				ApplicationId = app.Id,
				UserId = userId,
				Version = ndaPolicy.Version,
				AcceptedAt = acceptedAt
			});
		}
		if (app.Format == "TEAM")
		{
			var team = await db.Teams.SingleAsync(x => x.Id == app.TeamId, ct);
			if (team.CaptainUserId != userId) return ApiErrors.Forbidden("captain_required", "Only the current captain can submit.");
			if (await db.TeamInvitations.AnyAsync(x => x.TeamId == team.Id && x.Status == "PENDING" && x.ExpiresAt > DateTimeOffset.UtcNow, ct))
				return ApiErrors.Conflict("pending_invitations", "Resolve pending invitations before submission.");
			var currentMembers = await db.TeamMembers.Where(x => x.TeamId == team.Id).Select(x => x.UserId).OrderBy(x => x).ToArrayAsync(ct);
			if (!currentMembers.SequenceEqual(app.ParticipantUserIds.OrderBy(x => x)))
				return ApiErrors.Conflict("team_composition_changed", "Recreate the application because team membership changed.");
		}
		if (await db.ParticipationHistory.AnyAsync(x => x.CaseId == app.CaseId && app.ParticipantUserIds.Contains(x.UserId), ct))
			return ApiErrors.Conflict("participation_already_exists", "A participant has already applied to this case.");
		var nextStatus = project.AdmissionMode == "OPEN" ? "ADMITTED" : "SUBMITTED";
		if (nextStatus == "ADMITTED" && !await HasCapacity(db, project, app.Format, ct))
			return ApiErrors.Conflict("admission_quota_full", "No admission capacity remains for this format.");
		var from = app.Status;
		app.Status = nextStatus;
		app.SubmittedAt = DateTimeOffset.UtcNow;
		app.UpdatedAt = DateTimeOffset.UtcNow;
		app.Version++;
		foreach (var participantId in app.ParticipantUserIds)
			db.ParticipationHistory.Add(new CaseParticipationHistory { CaseId = app.CaseId, UserId = participantId, ApplicationId = app.Id, State = nextStatus });
		if (app.TeamId is Guid teamId)
		{
			var team = await db.Teams.SingleAsync(x => x.Id == teamId, ct);
			team.IsLocked = true;
		}
		db.ApplicationEvents.Add(new CaseApplicationEvent { ApplicationId = app.Id, FromStatus = from, ToStatus = nextStatus, ActorUserId = userId });
		await db.SaveChangesAsync(ct);
		await tx.CommitAsync(ct);
		return Results.Ok(Dto(app, userId));
	}

	private static async Task<IResult> Withdraw(Guid applicationId, ApplicationWithdrawRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
		var app = await db.Applications.SingleOrDefaultAsync(x => x.Id == applicationId, ct);
		if (app is null) return ApiErrors.NotFound();
		if (!await CanManageAsync(app, userId, db, ct)) return ApiErrors.Forbidden("application_withdraw_forbidden", "Only the applicant or captain can withdraw.");
		if (app.Version != request.ExpectedVersion) return ApiErrors.Conflict("version_conflict", "The application has changed.");
		if (app.Status is not ("SUBMITTED" or "ADMITTED")) return ApiErrors.Conflict("application_not_withdrawable", "This application cannot be withdrawn.");
		var project = await db.Cases.SingleAsync(x => x.Id == app.CaseId, ct);
		if (project.Status is "EXECUTING" or "FINAL_CLOSED" or "COMPLETED" or "EVALUATION" or "RESULTS_PUBLISHED")
			return ApiErrors.Conflict("execution_started", "Applications cannot be withdrawn after execution starts.");
		var from = app.Status;
		app.Status = "WITHDRAWN";
		app.Version++;
		app.UpdatedAt = DateTimeOffset.UtcNow;
		await db.ParticipationHistory.Where(x => x.ApplicationId == app.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.State, "WITHDRAWN"), ct);
		db.ApplicationEvents.Add(new CaseApplicationEvent { ApplicationId = app.Id, FromStatus = from, ToStatus = "WITHDRAWN", ActorUserId = userId, Comment = request.Reason });
		await db.SaveChangesAsync(ct);
		await tx.CommitAsync(ct);
		return Results.Ok(Dto(app, userId));
	}

	private static async Task<IResult> Decide(Guid applicationId, ApplicationDecisionRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
		var app = await db.Applications.SingleOrDefaultAsync(x => x.Id == applicationId, ct);
		if (app is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleAsync(x => x.Id == app.CaseId, ct);
		if (!await db.CompanyMembers.AnyAsync(x => x.CompanyId == project.CompanyId && x.UserId == userId && (x.Permissions.Contains("applications.manage") || x.Permissions.Contains("cases.manage")), ct))
			return ApiErrors.Forbidden("application_decision_forbidden", "You cannot decide applications for this company.");
		if (project.AdmissionMode != "SELECTIVE" || app.Status != "SUBMITTED") return ApiErrors.Conflict("application_not_reviewable", "Only submitted selective applications can be decided.");
		if (app.Version != request.ExpectedVersion) return ApiErrors.Conflict("version_conflict", "The application has changed.");
		if (request.Action == "REJECT" && string.IsNullOrWhiteSpace(request.Reason)) return ApiErrors.BadRequest("reason_required", "A rejection reason is required.");
		if (request.Action is not ("ADMIT" or "REJECT")) return ApiErrors.BadRequest("invalid_action", "Action must be ADMIT or REJECT.");
		if (request.Action == "ADMIT" && !await HasCapacity(db, project, app.Format, ct)) return ApiErrors.Conflict("admission_quota_full", "No admission capacity remains for this format.");
		var from = app.Status;
		app.Status = request.Action == "ADMIT" ? "ADMITTED" : "REJECTED";
		app.DecidedAt = DateTimeOffset.UtcNow;
		app.UpdatedAt = DateTimeOffset.UtcNow;
		app.Version++;
		await db.ParticipationHistory.Where(x => x.ApplicationId == app.Id)
			.ExecuteUpdateAsync(s => s.SetProperty(x => x.State, app.Status), ct);
		db.ApplicationEvents.Add(new CaseApplicationEvent { ApplicationId = app.Id, FromStatus = from, ToStatus = app.Status, ActorUserId = userId, Comment = request.Reason });
		await db.SaveChangesAsync(ct);
		await tx.CommitAsync(ct);
		return Results.Ok(Dto(app, userId));
	}

	private static async Task<IResult> Events(Guid applicationId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var app = await db.Applications.AsNoTracking().SingleOrDefaultAsync(x => x.Id == applicationId, ct);
		if (app is null) return ApiErrors.NotFound();
		if (!await CanRead(app, userId, db, ct)) return ApiErrors.Forbidden("application_access_denied", "You cannot access this application.");
		var items = await db.ApplicationEvents.AsNoTracking().Where(x => x.ApplicationId == applicationId).OrderBy(x => x.OccurredAt).ToListAsync(ct);
		return Results.Ok(new { items });
	}

	private static async Task<bool> CanRead(CaseApplication app, Guid userId, VitrinaDbContext db, CancellationToken ct) =>
		app.ParticipantUserIds.Contains(userId) || await db.Cases.Where(x => x.Id == app.CaseId)
			.Join(db.CompanyMembers.Where(x => x.UserId == userId), c => c.CompanyId, m => m.CompanyId, (c, m) => m)
			.AnyAsync(m => m.Permissions.Contains("applications.read") || m.Permissions.Contains("cases.manage"), ct);

	private static async Task<bool> CanManageAsync(CaseApplication app, Guid userId, VitrinaDbContext db, CancellationToken ct)
	{
		if (app.Format == "SOLO") return app.SoloApplicantUserId == userId;
		return app.TeamId is Guid teamId && await db.Teams.AnyAsync(x => x.Id == teamId && x.CaptainUserId == userId, ct);
	}

	private static async Task<bool> HasCapacity(VitrinaDbContext db, CaseProject project, string format, CancellationToken ct)
	{
		var query = db.Applications.Where(x => x.CaseId == project.Id && x.Status == "ADMITTED" && x.Format == format);
		var admitted = await query.CountAsync(ct);
		var limit = format == "TEAM" ? project.MaxAdmittedTeams : project.MaxAdmittedSolo;
		return limit is null || admitted < limit.Value;
	}

	private static object Dto(CaseApplication x, Guid viewerId) => new
	{
		id = x.Id, caseId = x.CaseId, x.Format, x.TeamId, x.SoloApplicantUserId, x.Status, x.CoverLetter,
		x.ParticipantUserIds, x.Version, x.CreatedAt, x.UpdatedAt, x.SubmittedAt, x.DecidedAt,
		ndaAcceptance = x.NdaAcceptedVersion is null ? null : new { caseId = x.CaseId, version = x.NdaAcceptedVersion, userId = x.NdaAcceptedByUserId, acceptedAt = x.NdaAcceptedAt },
		allowedActions = new { canEdit = x.Status == "DRAFT" && (x.Format == "SOLO" ? x.SoloApplicantUserId == viewerId : x.CreatedByUserId == viewerId), canSubmit = x.Status == "DRAFT" && (x.Format == "SOLO" ? x.SoloApplicantUserId == viewerId : x.CreatedByUserId == viewerId), canWithdraw = (x.Status is "SUBMITTED" or "ADMITTED") && (x.Format == "SOLO" ? x.SoloApplicantUserId == viewerId : x.CreatedByUserId == viewerId) }
	};
}

public sealed record CreateApplicationRequest(string Format, Guid? TeamId);
public sealed record UpdateApplicationRequest(int ExpectedVersion, string? CoverLetter);
public sealed record ApplicationVersionRequest(int ExpectedVersion, NdaAcceptanceRequest? NdaAcceptance = null);
public sealed record NdaAcceptanceRequest(string Version, bool Accepted);
public sealed record ApplicationWithdrawRequest(int ExpectedVersion, string? Reason);
public sealed record ApplicationDecisionRequest(string Action, int ExpectedVersion, string? Reason);
