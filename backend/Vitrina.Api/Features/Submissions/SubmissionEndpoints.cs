using System.Data;
using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Features.Execution;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Submissions;

public static class SubmissionEndpoints
{
	public static IEndpointRouteBuilder MapSubmissionEndpoints(this IEndpointRouteBuilder app)
	{
		var api = app.MapGroup("/api/v1").WithTags("Submissions");
		api.MapPost("/checkpoints/{checkpointId:guid}/submissions", CreateVersion);
		api.MapGet("/checkpoints/{checkpointId:guid}/submissions/mine", Mine);
		api.MapGet("/checkpoints/{checkpointId:guid}/submissions", ForCompany);
		api.MapGet("/checkpoints/{checkpointId:guid}/submissions/{applicationId:guid}/versions", Versions);
		return app;
	}

	private static async Task<IResult> CreateVersion(Guid checkpointId, CreateSubmissionRequest request, HttpContext http, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var idempotencyKey = http.Request.Headers["Idempotency-Key"].FirstOrDefault();
		if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 120) return ApiErrors.BadRequest("idempotency_key_required", "Provide a unique Idempotency-Key header (up to 120 characters).");
		var prior = await db.SubmissionIdempotencies.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == userId && x.CheckpointId == checkpointId && x.Key == idempotencyKey, ct);
		if (prior is not null)
		{
			var existing = await db.SubmissionVersions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == prior.SubmissionId, ct);
			if (existing is null) return ApiErrors.Conflict("idempotency_record_invalid", "The previous submission record is unavailable.");
			if (existing.ApplicationId != request.ApplicationId || existing.Description != request.Description?.Trim() || !existing.FileIds.OrderBy(x => x).SequenceEqual((request.FileIds ?? []).Distinct().OrderBy(x => x)) || existing.LinksJson != System.Text.Json.JsonSerializer.Serialize(request.Links ?? []))
				return ApiErrors.Conflict("idempotency_key_reused", "This Idempotency-Key was already used with a different request payload.");
			return Results.Ok(await ToDtoAsync(existing, db, ct));
		}
		await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
		var checkpoint = await db.CaseCheckpoints.SingleOrDefaultAsync(x => x.Id == checkpointId, ct);
		if (checkpoint is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == checkpoint.CaseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (project.Status != "EXECUTING") return ApiErrors.Conflict("execution_not_active", "Submissions are accepted only during execution.");
		if (checkpoint.IsIntakeClosed || (checkpoint.Kind == "FINAL" && project.IsFinalIntakeClosed) || (checkpoint.Kind == "SELECTION" && checkpoint.IsSelectionCompleted))
			return ApiErrors.Conflict("submission_intake_closed", "This checkpoint no longer accepts submissions.");
		var stage = await db.CaseStages.SingleOrDefaultAsync(x => x.Id == checkpoint.StageId, ct);
		if (stage is null) return ApiErrors.NotFound();
		if (stage.AvailableFrom is DateTimeOffset availableFrom && availableFrom > DateTimeOffset.UtcNow) return ApiErrors.Conflict("stage_not_available", "This stage is not available yet.");
		var stageSequence = stage.Sequence;
		var earlierOpenCheckpoint = await db.CaseCheckpoints.AnyAsync(x => x.CaseId == project.Id && x.Id != checkpointId && !x.IsIntakeClosed && !x.IsSelectionCompleted && db.CaseStages.Any(s => s.Id == x.StageId && s.Sequence < stageSequence), ct);
		if (earlierOpenCheckpoint) return ApiErrors.Conflict("checkpoint_not_available", "Complete or close earlier checkpoints before submitting to this checkpoint.");
		var application = await db.Applications.SingleOrDefaultAsync(x => x.Id == request.ApplicationId && x.CaseId == project.Id, ct);
		if (application is null) return ApiErrors.NotFound();
		if (application.Status != "ADMITTED") return ApiErrors.Conflict("application_not_active", "Only admitted applications can submit work.");
		var canSubmit = application.Format == "SOLO"
			? application.SoloApplicantUserId == userId
			: application.TeamId is Guid teamId && await db.Teams.AnyAsync(x => x.Id == teamId && x.CaptainUserId == userId, ct);
		if (!canSubmit) return ApiErrors.Forbidden("submission_forbidden", "Only the solo applicant or current team captain can submit.");
		if (application.TeamId is Guid excludedTeam && await db.TeamExecutionExclusions.AnyAsync(x => x.TeamId == excludedTeam, ct)) return ApiErrors.Forbidden("team_excluded", "Your team has been excluded from execution.");
		var nda = await db.NdaPolicies.AsNoTracking().SingleOrDefaultAsync(x => x.CaseId == project.Id, ct);
		if (nda is { IsRequired: true } && !await db.NdaAcceptances.AnyAsync(x => x.ApplicationId == application.Id && x.UserId == userId && x.Version == nda.Version, ct))
			return ApiErrors.Conflict("nda_acceptance_required", "Accept the current NDA version before submitting.");
		if (request.Description?.Length > 10000) return ApiErrors.BadRequest("description_too_long", "Submission description is limited to 10000 characters.");
		if (request.Links is { Length: > 30 } || request.Links?.Any(x => string.IsNullOrWhiteSpace(x.Label) || x.Label.Length > 150 || !Uri.TryCreate(x.Url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")) == true)
			return ApiErrors.BadRequest("invalid_submission_links", "Submission links must be valid HTTP(S) URLs with labels, up to 30 entries.");
		var requestedFileIds = request.FileIds ?? [];
		var fileIds = requestedFileIds.Distinct().ToArray();
		if (fileIds.Length != requestedFileIds.Length) return ApiErrors.BadRequest("duplicate_file_ids", "File IDs must be unique.");
		if (fileIds.Length > 30) return ApiErrors.BadRequest("too_many_files", "A submission can contain at most 30 files.");
		var files = await db.StoredFiles.Where(x => fileIds.Contains(x.Id)).ToListAsync(ct);
		if (files.Count != fileIds.Length || files.Any(x => x.OwnerUserId != userId || x.Status != "READY" || x.Purpose != "SUBMISSION_ATTACHMENT" || x.CaseId != project.Id || x.CheckpointId != checkpointId || x.ApplicationId != application.Id))
			return ApiErrors.Forbidden("submission_file_invalid", "Every attached file must be an uploaded submission attachment for this application and checkpoint.");
		var latestVersion = await db.SubmissionVersions.Where(x => x.CheckpointId == checkpointId && x.ApplicationId == application.Id).Select(x => (int?)x.Version).MaxAsync(ct) ?? 0;
		if (request.ExpectedLastVersion != latestVersion) return ApiErrors.Conflict("version_conflict", "The latest submission version has changed. Reload the history and retry.");
		var version = latestVersion + 1;
		var now = DateTimeOffset.UtcNow;
		var submission = new SubmissionVersion
		{
			CheckpointId = checkpointId, CaseId = project.Id, ApplicationId = application.Id, Version = version,
			SubmittedByUserId = userId, Description = request.Description?.Trim(),
			LinksJson = System.Text.Json.JsonSerializer.Serialize(request.Links ?? []), FileIds = fileIds,
			IsLate = checkpoint.Deadline is DateTimeOffset deadline && now > deadline, CreatedAt = now
		};
		db.SubmissionVersions.Add(submission);
		db.SubmissionIdempotencies.Add(new SubmissionIdempotency { UserId = userId, CheckpointId = checkpointId, Key = idempotencyKey, SubmissionId = submission.Id });
		foreach (var file in files) file.Status = "ATTACHED";
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "submission.version.created", ResourceType = "SubmissionVersion", ResourceId = submission.Id });
		await db.SaveChangesAsync(ct);
		await tx.CommitAsync(ct);
		return Results.Created($"/api/v1/checkpoints/{checkpointId}/submissions/{application.Id}/versions", await ToDtoAsync(submission, db, ct));
	}

	private static async Task<IResult> Mine(Guid checkpointId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var checkpoint = await db.CaseCheckpoints.AsNoTracking().SingleOrDefaultAsync(x => x.Id == checkpointId, ct);
		if (checkpoint is null) return ApiErrors.NotFound();
		var appIds = await db.Applications.AsNoTracking().Where(x => x.CaseId == checkpoint.CaseId && x.ParticipantUserIds.Contains(userId)).Select(x => x.Id).ToArrayAsync(ct);
		var items = await db.SubmissionVersions.AsNoTracking().Where(x => x.CheckpointId == checkpointId && appIds.Contains(x.ApplicationId)).OrderBy(x => x.CreatedAt).ToListAsync(ct);
		return Results.Ok(new { items = await Task.WhenAll(items.Select(x => ToDtoAsync(x, db, ct))), latestVersion = items.Count == 0 ? 0 : items.Max(x => x.Version) });
	}

	private static async Task<IResult> ForCompany(Guid checkpointId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var checkpoint = await db.CaseCheckpoints.AsNoTracking().SingleOrDefaultAsync(x => x.Id == checkpointId, ct);
		if (checkpoint is null) return ApiErrors.NotFound();
		var project = await db.Cases.AsNoTracking().SingleAsync(x => x.Id == checkpoint.CaseId, ct);
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("submission_review_forbidden", "You cannot review submissions.");
		var items = await db.SubmissionVersions.AsNoTracking().Where(x => x.CheckpointId == checkpointId).OrderBy(x => x.ApplicationId).ThenBy(x => x.Version).ToListAsync(ct);
		return Results.Ok(new { items = await Task.WhenAll(items.Select(x => ToDtoAsync(x, db, ct))) });
	}

	private static async Task<IResult> Versions(Guid checkpointId, Guid applicationId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var checkpoint = await db.CaseCheckpoints.AsNoTracking().SingleOrDefaultAsync(x => x.Id == checkpointId, ct);
		if (checkpoint is null) return ApiErrors.NotFound();
		var application = await db.Applications.AsNoTracking().SingleOrDefaultAsync(x => x.Id == applicationId && x.CaseId == checkpoint.CaseId, ct);
		if (application is null) return ApiErrors.NotFound();
		var project = await db.Cases.AsNoTracking().SingleAsync(x => x.Id == checkpoint.CaseId, ct);
		var isParticipant = application.ParticipantUserIds.Contains(userId);
		if (!isParticipant && !await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("submission_access_denied", "You cannot view these submissions.");
		var items = await db.SubmissionVersions.AsNoTracking().Where(x => x.CheckpointId == checkpointId && x.ApplicationId == applicationId).OrderBy(x => x.Version).ToListAsync(ct);
		return Results.Ok(new { items = await Task.WhenAll(items.Select(x => ToDtoAsync(x, db, ct))), latestVersion = items.Count == 0 ? 0 : items.Max(x => x.Version) });
	}

	private static async Task<object> ToDtoAsync(SubmissionVersion x, VitrinaDbContext db, CancellationToken ct)
	{
		var attachments = await db.StoredFiles.AsNoTracking()
			.Where(file => x.FileIds.Contains(file.Id))
			.Select(file => new
			{
				id = file.Id,
				displayName = file.OriginalFileName,
				contentType = file.ContentType,
				sizeBytes = file.Size,
				purpose = file.Purpose,
				status = "READY",
				createdAt = file.CreatedAt
			})
			.ToListAsync(ct);
		return new
		{
			x.Id,
			x.CheckpointId,
			x.ApplicationId,
			x.Version,
			x.SubmittedByUserId,
			submittedAt = x.CreatedAt,
			x.IsLate,
			description = x.Description,
			links = System.Text.Json.JsonSerializer.Deserialize<object[]>(x.LinksJson) ?? [],
			attachments
		};
	}
}

public sealed record CreateSubmissionRequest(Guid ApplicationId, int ExpectedLastVersion, string? Description, SubmissionLink[]? Links = null, Guid[]? FileIds = null);
public sealed record SubmissionLink(string Label, string Url);
