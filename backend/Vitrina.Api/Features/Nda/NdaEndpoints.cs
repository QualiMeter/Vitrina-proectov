using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Features.Execution;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Nda;

public static class NdaEndpoints
{
	public static IEndpointRouteBuilder MapNdaEndpoints(this IEndpointRouteBuilder app)
	{
		var api = app.MapGroup("/api/v1").WithTags("NDA");
		api.MapGet("/cases/{caseId:guid}/nda", Get);
		api.MapPut("/cases/{caseId:guid}/nda", Configure);
		return app;
	}

	private static async Task<IResult> Get(Guid caseId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		var policy = await db.NdaPolicies.AsNoTracking().SingleOrDefaultAsync(x => x.CaseId == caseId, ct);
		if (policy is null) return Results.Ok(new { caseId, required = false });
		var isCompany = await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct);
		var application = await db.Applications.AsNoTracking().Where(x => x.CaseId == caseId && x.ParticipantUserIds.Contains(userId)).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct);
		var isApplicantOrCaptain = application is not null && (application.Format == "SOLO"
			? application.SoloApplicantUserId == userId
			: application.TeamId is Guid teamId && await db.Teams.AnyAsync(x => x.Id == teamId && x.CaptainUserId == userId, ct));
		var canPreviewBeforeApplication = project.Status is "REGISTRATION_OPEN" or "REGISTRATION_CLOSED" or "APPROVED";
		if (!isCompany && application is not null && !isApplicantOrCaptain)
			return ApiErrors.Forbidden("nda_access_denied", "Only the solo applicant or team captain can view this NDA.");
		if (!isCompany && application is null)
		{
			if (!canPreviewBeforeApplication) return ApiErrors.Forbidden("nda_access_denied", "Only an applicant or team captain can view this NDA.");
			var isEligibleStudent = project.ParticipationFormat != "TEAM" && await db.Users.AnyAsync(x => x.Id == userId && !x.IsBlocked && x.GlobalRoles.Contains("STUDENT"), ct);
			var isTeamCaptain = await db.Teams.AnyAsync(x => x.CaseId == caseId && x.CaptainUserId == userId, ct);
			if (!isEligibleStudent && !isTeamCaptain) return ApiErrors.Forbidden("nda_access_denied", "Only an eligible student or team captain can view this NDA.");
		}
		return policy.IsRequired
			? Results.Ok(new { caseId, required = true, version = policy.Version, documentText = policy.Text })
			: Results.Ok(new { caseId, required = false, version = policy.Version });
	}

	private static async Task<IResult> Configure(Guid caseId, ConfigureNdaRequest request, HttpContext http, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var idempotencyKey = http.Request.Headers["Idempotency-Key"].FirstOrDefault();
		if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 120) return ApiErrors.BadRequest("idempotency_key_required", "Provide an Idempotency-Key header.");
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("nda_manage_forbidden", "You cannot configure NDA for this case.");
		if ((request.DocumentText is not null && request.DocumentText.Length > 20000) || (request.Required && string.IsNullOrWhiteSpace(request.DocumentText)) || (!request.Required && request.DocumentText is not null)) return ApiErrors.BadRequest("invalid_nda", "Required NDA text must be provided (up to 20000 characters); optional NDA must omit documentText.");
		var documentText = request.DocumentText?.Trim() ?? "";
		var policy = await db.NdaPolicies.SingleOrDefaultAsync(x => x.CaseId == caseId, ct);
		if (policy is not null && policy.IdempotencyKey == idempotencyKey)
		{
			if (policy.Text != documentText || policy.IsRequired != request.Required) return ApiErrors.Conflict("idempotency_key_reused", "This Idempotency-Key was already used with another NDA configuration.");
			return ToConfigurationResult(caseId, policy);
		}
		if (project.Status is not ("DRAFT" or "REVISION_REQUIRED")) return ApiErrors.Conflict("nda_locked", "NDA cannot be changed after publication.");
		if (project.Version != request.ExpectedCaseVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (policy is null)
		{
			policy = new NdaPolicy { CaseId = caseId, Text = documentText, IsRequired = request.Required, Version = "1", IdempotencyKey = idempotencyKey };
			db.NdaPolicies.Add(policy);
		}
		else
		{
			var nextVersion = int.TryParse(policy.Version, out var currentVersion) ? currentVersion + 1 : 2;
			policy.Version = nextVersion.ToString();
			policy.Text = documentText; policy.IsRequired = request.Required; policy.IdempotencyKey = idempotencyKey; policy.UpdatedAt = DateTimeOffset.UtcNow;
		}
		db.NdaPolicyVersions.Add(new NdaPolicyVersion
		{
			CaseId = caseId,
			Version = policy.Version,
			Text = policy.Text,
			IsRequired = policy.IsRequired,
			CreatedByUserId = userId,
			IdempotencyKey = idempotencyKey
		});
		project.Version++; project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "nda.policy.updated", ResourceType = "NdaPolicy", ResourceId = policy.Id });
		await db.SaveChangesAsync(ct);
		return ToConfigurationResult(caseId, policy);
	}

	private static IResult ToConfigurationResult(Guid caseId, NdaPolicy policy) => policy.IsRequired
		? Results.Ok(new { caseId, required = true, version = policy.Version, documentText = policy.Text })
		: Results.Ok(new { caseId, required = false, version = policy.Version });
}

public sealed record ConfigureNdaRequest(int ExpectedCaseVersion, bool Required, string? DocumentText);
