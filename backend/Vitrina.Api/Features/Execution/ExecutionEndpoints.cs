using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Execution;

public static class ExecutionEndpoints
{
	public static IEndpointRouteBuilder MapExecutionEndpoints(this IEndpointRouteBuilder app)
	{
		var api = app.MapGroup("/api/v1").WithTags("Execution");
		api.MapGet("/cases/{caseId:guid}/stages", ListStages);
		api.MapPost("/cases/{caseId:guid}/stages", CreateStage);
		api.MapPatch("/stages/{stageId:guid}", UpdateStage);
		api.MapDelete("/stages/{stageId:guid}", DeleteStage);
		api.MapPost("/stages/{stageId:guid}/checkpoints", CreateCheckpoint);
		api.MapPatch("/checkpoints/{checkpointId:guid}", UpdateCheckpoint);
		api.MapDelete("/checkpoints/{checkpointId:guid}", DeleteCheckpoint);
		api.MapPost("/cases/{caseId:guid}/start-execution", StartExecution);
		api.MapGet("/cases/{caseId:guid}/workspace", Workspace);
		api.MapGet("/cases/{caseId:guid}/execution-dashboard", Dashboard);
		api.MapPost("/checkpoints/{checkpointId:guid}/close-intake", CloseIntake);
		api.MapPost("/checkpoints/{checkpointId:guid}/complete-selection", CompleteSelection);
		api.MapGet("/checkpoints/{checkpointId:guid}/selection-result/mine", SelectionResult);
		api.MapPost("/cases/{caseId:guid}/close-final-intake", CloseFinalIntake);
		api.MapPost("/teams/{teamId:guid}/exclude", ExcludeTeam);
		return app;
	}

	private static async Task<IResult> ListStages(Guid caseId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "Only company members with case management access can inspect the editor view.");
		var stages = await db.CaseStages.AsNoTracking().Where(x => x.CaseId == caseId).OrderBy(x => x.Sequence).ToListAsync(ct);
		var ids = stages.Select(x => x.Id).ToArray();
		var checkpoints = await db.CaseCheckpoints.AsNoTracking().Where(x => ids.Contains(x.StageId)).OrderBy(x => x.CreatedAt).ToListAsync(ct);
		var files = await db.StoredFiles.AsNoTracking().Where(x => x.CaseId == caseId && x.StageId != null && (x.Status == "READY" || x.Status == "BOUND")).ToListAsync(ct);
		return Results.Ok(new
		{
			items = stages.Select(stage => new
			{
				id = stage.Id,
				caseId = stage.CaseId,
				version = stage.Version,
				sequence = stage.Sequence,
				kind = stage.Kind,
				title = stage.Title,
				description = stage.Description,
				availableFrom = stage.AvailableFrom,
				createdAt = stage.CreatedAt,
				updatedAt = stage.UpdatedAt,
				checkpoints = checkpoints.Where(checkpoint => checkpoint.StageId == stage.Id).Select(ToCheckpointDto),
				materials = files.Where(file => file.StageId == stage.Id).Select(ToFileMetadataDto)
			})
		});
	}

	private static async Task<IResult> CreateStage(Guid caseId, StageCreateRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot manage this case.");
		if (project.Status is not ("DRAFT" or "REVISION_REQUIRED")) return ApiErrors.Conflict("case_structure_locked", "Stages can only be changed before publication.");
		if (request.ExpectedCaseVersion != project.Version) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200 || request.Kind is not ("WORK" or "FINAL")) return ApiErrors.BadRequest("validation_failed", "A valid stage title and kind are required.");
		var sequence = request.Sequence;
		if (sequence < 1) return ApiErrors.BadRequest("invalid_sequence", "Sequence must be positive.");
		if (await db.CaseStages.AnyAsync(x => x.CaseId == caseId && x.Sequence == sequence, ct)) return ApiErrors.Conflict("sequence_already_used", "Another stage already uses this sequence.");
		var stage = new CaseStage { CaseId = caseId, Title = request.Title.Trim(), Kind = request.Kind, Description = request.Description?.Trim(), AvailableFrom = request.AvailableFrom, Sequence = sequence };
		db.CaseStages.Add(stage);
		project.Version++;
		project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.stage.created", ResourceType = "CaseStage", ResourceId = stage.Id });
		await db.SaveChangesAsync(ct);
		return Results.Created($"/api/v1/stages/{stage.Id}", await ToStageDtoAsync(stage, db, ct));
	}

	private static async Task<IResult> UpdateStage(Guid stageId, StageUpdateRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var stage = await db.CaseStages.SingleOrDefaultAsync(x => x.Id == stageId, ct);
		if (stage is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleAsync(x => x.Id == stage.CaseId, ct);
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot manage this case.");
		if (project.Status is not ("DRAFT" or "REVISION_REQUIRED")) return ApiErrors.Conflict("case_structure_locked", "Stages are locked after publication.");
		if (project.Version != request.ExpectedCaseVersion || stage.Version != request.ExpectedVersion) return ApiErrors.Conflict("version_conflict", "The case or stage has changed.");
		if (request.Title is not null)
		{
			if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200) return ApiErrors.BadRequest("validation_failed", "Stage title is invalid.");
			stage.Title = request.Title.Trim();
		}
		if (request.Description is not null) stage.Description = request.Description.Trim();
		if (request.AvailableFrom.HasValue) stage.AvailableFrom = request.AvailableFrom;
		if (request.Sequence is int sequence)
		{
			if (sequence < 1) return ApiErrors.BadRequest("invalid_sequence", "Sequence must be positive.");
			if (await db.CaseStages.AnyAsync(x => x.CaseId == stage.CaseId && x.Id != stageId && x.Sequence == sequence, ct)) return ApiErrors.Conflict("sequence_already_used", "Another stage already uses this sequence.");
			stage.Sequence = sequence;
		}
		stage.Version++; stage.UpdatedAt = DateTimeOffset.UtcNow; project.Version++; project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.stage.updated", ResourceType = "CaseStage", ResourceId = stageId });
		await db.SaveChangesAsync(ct);
		return Results.Ok(await ToStageDtoAsync(stage, db, ct));
	}

	private static async Task<IResult> DeleteStage(Guid stageId, [FromBody] CaseExecutionCommand request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var stage = await db.CaseStages.SingleOrDefaultAsync(x => x.Id == stageId, ct);
		if (stage is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleAsync(x => x.Id == stage.CaseId, ct);
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot manage this case.");
		if (project.Status is not ("DRAFT" or "REVISION_REQUIRED")) return ApiErrors.Conflict("case_structure_locked", "Stages are locked after publication.");
		if (project.Version != request.ExpectedCaseVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (await db.CaseCheckpoints.AnyAsync(x => x.StageId == stageId, ct)) return ApiErrors.Conflict("stage_has_checkpoints", "Delete its checkpoints first.");
		if (await db.StoredFiles.AnyAsync(x => x.StageId == stageId, ct)) return ApiErrors.Conflict("stage_has_files", "Delete or detach its materials first.");
		db.CaseStages.Remove(stage); project.Version++; project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.stage.deleted", ResourceType = "CaseStage", ResourceId = stageId });
		await db.SaveChangesAsync(ct);
		return Results.NoContent();
	}

	private static async Task<IResult> CreateCheckpoint(Guid stageId, CheckpointCreateRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var stage = await db.CaseStages.SingleOrDefaultAsync(x => x.Id == stageId, ct);
		if (stage is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleAsync(x => x.Id == stage.CaseId, ct);
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot manage this case.");
		if (project.Status is not ("DRAFT" or "REVISION_REQUIRED")) return ApiErrors.Conflict("case_structure_locked", "Checkpoints are locked after publication.");
		if (project.Version != request.ExpectedCaseVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200 || request.Kind is not ("REGULAR" or "SELECTION" or "FINAL") || request.Deadline is null) return ApiErrors.BadRequest("validation_failed", "A title, valid checkpoint kind and deadline are required.");
		if (request.SelectionLimit is < 1 || request.SoloSelectionLimit is < 0) return ApiErrors.BadRequest("invalid_selection_limit", "Team selection limit must be positive and solo selection limit cannot be negative.");
		if (request.Kind == "SELECTION")
		{
			if (project.ParticipationFormat is not ("TEAM" or "SOLO" or "BOTH")) return ApiErrors.Conflict("participation_format_required", "Configure the case participation format before creating a selection checkpoint.");
			var allowsTeams = project.ParticipationFormat is "TEAM" or "BOTH";
			var allowsSolo = project.ParticipationFormat is "SOLO" or "BOTH";
			if ((allowsTeams && request.SelectionLimit is null) || (allowsSolo && request.SoloSelectionLimit is null))
				return ApiErrors.BadRequest("selection_limit_required", "Configure a separate selection limit for every allowed participation format.");
			if ((!allowsTeams && request.SelectionLimit is not null) || (!allowsSolo && request.SoloSelectionLimit is not null))
				return ApiErrors.BadRequest("selection_limit_not_applicable", "Do not configure a selection limit for a participation format disabled in this case.");
		}
		if (request.Kind == "FINAL" && await db.CaseCheckpoints.AnyAsync(x => x.CaseId == project.Id && x.Kind == "FINAL", ct)) return ApiErrors.Conflict("final_checkpoint_exists", "Only one final checkpoint is supported per case.");
		var checkpoint = new CaseCheckpoint { CaseId = project.Id, StageId = stageId, Title = request.Title.Trim(), Instructions = request.Instructions?.Trim(), Kind = request.Kind, Deadline = request.Deadline, TeamSelectionLimit = request.SelectionLimit, SoloSelectionLimit = request.SoloSelectionLimit };
		db.CaseCheckpoints.Add(checkpoint);
		project.Version++; project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.checkpoint.created", ResourceType = "CaseCheckpoint", ResourceId = checkpoint.Id });
		await db.SaveChangesAsync(ct);
		return Results.Created($"/api/v1/checkpoints/{checkpoint.Id}", ToCheckpointDto(checkpoint));
	}

	private static async Task<IResult> UpdateCheckpoint(Guid checkpointId, CheckpointUpdateRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var checkpoint = await db.CaseCheckpoints.SingleOrDefaultAsync(x => x.Id == checkpointId, ct);
		if (checkpoint is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleAsync(x => x.Id == checkpoint.CaseId, ct);
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot manage this case.");
		if (project.Status is not ("DRAFT" or "REVISION_REQUIRED")) return ApiErrors.Conflict("case_structure_locked", "Checkpoints are locked after publication.");
		if (project.Version != request.ExpectedCaseVersion || checkpoint.Version != request.ExpectedVersion) return ApiErrors.Conflict("version_conflict", "The case or checkpoint has changed.");
		if (request.Title is not null)
		{
			if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200) return ApiErrors.BadRequest("validation_failed", "Title is invalid.");
			checkpoint.Title = request.Title.Trim();
		}
		if (request.Instructions is not null) checkpoint.Instructions = request.Instructions.Trim();
		if (request.Deadline.HasValue) checkpoint.Deadline = request.Deadline;
		if (request.SelectionLimit is < 1 || request.SoloSelectionLimit is < 0) return ApiErrors.BadRequest("invalid_selection_limit", "Team selection limit must be positive and solo selection limit cannot be negative.");
		var resultingTeamLimit = request.SelectionLimit ?? checkpoint.TeamSelectionLimit;
		var resultingSoloLimit = request.SoloSelectionLimit ?? checkpoint.SoloSelectionLimit;
		if (checkpoint.Kind == "SELECTION")
		{
			if (project.ParticipationFormat is not ("TEAM" or "SOLO" or "BOTH")) return ApiErrors.Conflict("participation_format_required", "Configure the case participation format before updating a selection checkpoint.");
			var allowsTeams = project.ParticipationFormat is "TEAM" or "BOTH";
			var allowsSolo = project.ParticipationFormat is "SOLO" or "BOTH";
			if (allowsTeams && resultingTeamLimit is null || allowsSolo && resultingSoloLimit is null)
				return ApiErrors.BadRequest("selection_limit_required", "Configure a separate selection limit for every allowed participation format.");
			if (!allowsTeams && resultingTeamLimit is not null || !allowsSolo && resultingSoloLimit is not null)
				return ApiErrors.BadRequest("selection_limit_not_applicable", "Do not configure a selection limit for a participation format disabled in this case.");
		}
		checkpoint.TeamSelectionLimit = resultingTeamLimit;
		checkpoint.SoloSelectionLimit = resultingSoloLimit;
		checkpoint.Version++; project.Version++; project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.checkpoint.updated", ResourceType = "CaseCheckpoint", ResourceId = checkpointId });
		await db.SaveChangesAsync(ct);
		return Results.Ok(ToCheckpointDto(checkpoint));
	}

	private static async Task<IResult> DeleteCheckpoint(Guid checkpointId, [FromBody] CaseExecutionCommand request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var checkpoint = await db.CaseCheckpoints.SingleOrDefaultAsync(x => x.Id == checkpointId, ct);
		if (checkpoint is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleAsync(x => x.Id == checkpoint.CaseId, ct);
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot manage this case.");
		if (project.Status is not ("DRAFT" or "REVISION_REQUIRED")) return ApiErrors.Conflict("case_structure_locked", "Checkpoints are locked after publication.");
		if (project.Version != request.ExpectedCaseVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (await db.SubmissionVersions.AnyAsync(x => x.CheckpointId == checkpointId, ct) || await db.StoredFiles.AnyAsync(x => x.CheckpointId == checkpointId, ct)) return ApiErrors.Conflict("checkpoint_has_submissions", "A checkpoint with submissions or files cannot be deleted.");
		db.CaseCheckpoints.Remove(checkpoint); project.Version++; project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.checkpoint.deleted", ResourceType = "CaseCheckpoint", ResourceId = checkpointId });
		await db.SaveChangesAsync(ct); return Results.NoContent();
	}

	private static async Task<IResult> StartExecution(Guid caseId, CaseExecutionCommand request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot start execution.");
		if (project.Status != "REGISTRATION_CLOSED") return ApiErrors.Conflict("case_not_ready", "Execution can only start after registration is closed.");
		if (project.Version != request.ExpectedCaseVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (!await db.Applications.AnyAsync(x => x.CaseId == caseId && x.Status == "ADMITTED", ct)) return ApiErrors.Conflict("no_admitted_applications", "At least one admitted application is required.");
		if (!await db.CaseStages.AnyAsync(x => x.CaseId == caseId, ct)) return ApiErrors.Conflict("stages_missing", "Configure at least one stage before starting execution.");
		if (!await db.CaseCheckpoints.AnyAsync(x => x.CaseId == caseId, ct)) return ApiErrors.Conflict("checkpoints_missing", "Configure at least one checkpoint before starting execution.");
		project.Status = "EXECUTING"; project.Version++; project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.started", ResourceType = "Case", ResourceId = caseId });
		await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.Ok(new { project.Id, project.Status, project.Version });
	}

	private static async Task<IResult> Workspace(Guid caseId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		var application = await db.Applications.AsNoTracking()
			.Where(x => x.CaseId == caseId && x.ParticipantUserIds.Contains(userId))
			.OrderByDescending(x => x.CreatedAt)
			.FirstOrDefaultAsync(ct);
		if (application is null) return ApiErrors.Forbidden("workspace_forbidden", "You are not a participant in this case.");
		var nda = await db.NdaPolicies.AsNoTracking().SingleOrDefaultAsync(x => x.CaseId == caseId, ct);
		var ndaAccepted = nda is null || !nda.IsRequired || await db.NdaAcceptances.AnyAsync(x => x.ApplicationId == application.Id && x.Version == nda.Version, ct);
		var isExcludedTeam = application.TeamId is Guid excludedTeamId && await db.TeamExecutionExclusions.AnyAsync(x => x.TeamId == excludedTeamId, ct);
		var myParticipationStatus = isExcludedTeam ? "EXCLUDED" : application.Status switch
		{
			"ADMITTED" => "ACTIVE",
			"ELIMINATED" => "ELIMINATED",
			"WITHDRAWN" => "WITHDRAWN",
			_ => "WITHDRAWN"
		};
		if (project.Status != "EXECUTING" || application.Status != "ADMITTED" || isExcludedTeam)
		{
			return Results.Ok(new
			{
				caseId,
				applicationId = application.Id,
				status = project.Status,
				myParticipationStatus,
				ndaRequired = nda?.IsRequired ?? false,
				ndaAcceptedForApplication = ndaAccepted,
				stages = Array.Empty<object>(),
				allowedActions = Array.Empty<string>()
			});
		}
		var isSubmitter = application.Format == "SOLO"
			? application.SoloApplicantUserId == userId
			: application.TeamId is Guid activeTeamId && await db.Teams.AnyAsync(x => x.Id == activeTeamId && x.CaptainUserId == userId, ct);
		var checkpoints = await db.CaseCheckpoints.AsNoTracking().Where(x => x.CaseId == caseId).OrderBy(x => x.CreatedAt).ToListAsync(ct);
		var allStages = await db.CaseStages.AsNoTracking().Where(x => x.CaseId == caseId).OrderBy(x => x.Sequence).ToListAsync(ct);
		var now = DateTimeOffset.UtcNow;
		var activeCheckpoint = checkpoints.FirstOrDefault(x => !x.IsIntakeClosed && !x.IsSelectionCompleted &&
			allStages.Any(stage => stage.Id == x.StageId && (stage.AvailableFrom is null || stage.AvailableFrom <= now)));
		var currentStageSequence = activeCheckpoint is null
			? allStages.Where(x => x.AvailableFrom is null || x.AvailableFrom <= now).LastOrDefault()?.Sequence
			: allStages.FirstOrDefault(x => x.Id == activeCheckpoint.StageId)?.Sequence;
		var visibleStageIds = currentStageSequence is null
			? Array.Empty<Guid>()
			: allStages.Where(x => x.Sequence <= currentStageSequence.Value && (x.AvailableFrom is null || x.AvailableFrom <= now)).Select(x => x.Id).ToArray();
		var visibleCheckpointIds = checkpoints.Where(x => visibleStageIds.Contains(x.StageId))
			.Where(x => activeCheckpoint is null || x.CreatedAt <= activeCheckpoint.CreatedAt)
			.Select(x => x.Id).ToHashSet();
		var stages = allStages.Where(x => visibleStageIds.Contains(x.Id)).ToList();
		var files = await db.StoredFiles.AsNoTracking()
			.Where(x => x.CaseId == caseId && x.StageId != null && x.Status == "BOUND")
			.ToListAsync(ct);
		var stageDtos = stages.Select(stage => new
		{
			id = stage.Id,
			sequence = stage.Sequence,
			title = stage.Title,
			description = stage.Description,
			materials = files.Where(file => file.StageId == stage.Id).Select(file => new
			{
				fileId = file.Id,
				displayName = file.OriginalFileName,
				sizeBytes = file.Size,
				contentType = file.ContentType
			}),
			checkpoints = checkpoints.Where(checkpoint => checkpoint.StageId == stage.Id && visibleCheckpointIds.Contains(checkpoint.Id)).Select(checkpoint => new
			{
				id = checkpoint.Id,
				stageId = stage.Id,
				title = checkpoint.Title,
				kind = checkpoint.Kind,
				deadline = checkpoint.Deadline,
				intakeStatus = checkpoint.IsSelectionCompleted ? "SELECTION_CLOSED" : checkpoint.IsIntakeClosed ? "CLOSED" : "OPEN",
				canSubmit = isSubmitter && ndaAccepted && checkpoint.Id == activeCheckpoint?.Id && !checkpoint.IsIntakeClosed,
				mySelectionOutcome = checkpoint.Kind != "SELECTION"
					? "NOT_APPLICABLE"
					: !checkpoint.IsSelectionCompleted
						? (application.Status == "ELIMINATED" ? "NOT_APPLICABLE" : "PENDING")
						: application.Format == "SOLO"
							? (checkpoint.PassingSoloApplicationIds.Contains(application.Id) ? "PASSED" : "ELIMINATED")
							: (application.TeamId is Guid selectedTeamId && checkpoint.PassingTeamIds.Contains(selectedTeamId) ? "PASSED" : "ELIMINATED")
			})
		});
		var allowedActions = isSubmitter && ndaAccepted && activeCheckpoint is not null ? new[] { "SUBMIT" } : Array.Empty<string>();
		return Results.Ok(new
		{
			caseId,
			applicationId = application.Id,
			status = project.Status,
			myParticipationStatus,
			ndaRequired = nda?.IsRequired ?? false,
			ndaAcceptedForApplication = ndaAccepted,
			stages = stageDtos,
			allowedActions
		});
	}

	private static async Task<IResult> Dashboard(Guid caseId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot view this dashboard.");
		var applications = await db.Applications.AsNoTracking().Where(x => x.CaseId == caseId).ToListAsync(ct);
		var teamApplications = applications.Where(x => x.Format == "TEAM").ToList();
		var exclusions = await db.TeamExecutionExclusions.AsNoTracking().Where(x => x.CaseId == caseId).ToListAsync(ct);
		var excludedTeamIds = exclusions.Select(x => x.TeamId).ToHashSet();
		var submissions = await db.SubmissionVersions.AsNoTracking().Where(x => x.CaseId == caseId).ToListAsync(ct);
		var teams = new List<object>();
		foreach (var application in teamApplications)
		{
			if (application.TeamId is not Guid teamId) continue;
			var team = await db.Teams.AsNoTracking().SingleOrDefaultAsync(x => x.Id == teamId, ct);
			if (team is null) continue;
			var lastSubmittedAt = submissions.Where(x => x.ApplicationId == application.Id).Select(x => (DateTimeOffset?)x.CreatedAt).Max();
			teams.Add(new
			{
				teamId,
				captainUserId = team.CaptainUserId,
				status = excludedTeamIds.Contains(teamId) ? "EXCLUDED" : application.Status switch
				{
					"ADMITTED" => "ACTIVE",
					"ELIMINATED" => "ELIMINATED",
					"WITHDRAWN" => "WITHDRAWN",
					_ => "WITHDRAWN"
				},
				lastSubmittedAt
			});
		}
		var stages = await db.CaseStages.AsNoTracking().Where(x => x.CaseId == caseId).OrderBy(x => x.Sequence).ToListAsync(ct);
		var stageIds = stages.Select(x => x.Id).ToArray();
		var checkpoints = await db.CaseCheckpoints.AsNoTracking().Where(x => stageIds.Contains(x.StageId)).OrderBy(x => x.CreatedAt).ToListAsync(ct);
		var stageFiles = await db.StoredFiles.AsNoTracking().Where(x => x.CaseId == caseId && x.StageId != null && (x.Status == "READY" || x.Status == "BOUND")).ToListAsync(ct);
		var stageDtos = stages.Select(stage => new
		{
			id = stage.Id,
			caseId = stage.CaseId,
			version = stage.Version,
			sequence = stage.Sequence,
			kind = stage.Kind,
			title = stage.Title,
			description = stage.Description,
			availableFrom = stage.AvailableFrom,
			createdAt = stage.CreatedAt,
			updatedAt = stage.UpdatedAt,
			checkpoints = checkpoints.Where(checkpoint => checkpoint.StageId == stage.Id).Select(ToCheckpointDto),
			materials = stageFiles.Where(file => file.StageId == stage.Id).Select(ToFileMetadataDto)
		});
		return Results.Ok(new
		{
			caseId,
			status = project.Status,
			stages = stageDtos,
			activeTeamCount = teamApplications.Count(x => x.Status == "ADMITTED" && x.TeamId is Guid teamId && !excludedTeamIds.Contains(teamId)),
			eliminatedTeamCount = teamApplications.Count(x => x.Status == "ELIMINATED" && x.TeamId is Guid teamId && !excludedTeamIds.Contains(teamId)),
			excludedTeamCount = exclusions.Count,
			admittedSoloCount = applications.Count(x => x.Format == "SOLO" && x.Status == "ADMITTED"),
			caseVersion = project.Version,
			teams
		});
	}

	private static async Task<IResult> CloseIntake(Guid checkpointId, CheckpointCloseRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var checkpoint = await db.CaseCheckpoints.SingleOrDefaultAsync(x => x.Id == checkpointId, ct);
		if (checkpoint is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleAsync(x => x.Id == checkpoint.CaseId, ct);
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot close this intake.");
		if (project.Status != "EXECUTING") return ApiErrors.Conflict("execution_not_started", "Execution is not active.");
		if (checkpoint.Kind != "REGULAR") return ApiErrors.Conflict("invalid_checkpoint_kind", "Use complete-selection for selection checkpoints and close-final-intake for final checkpoints.");
		if (checkpoint.Version != request.ExpectedVersion) return ApiErrors.Conflict("version_conflict", "The checkpoint has changed.");
		checkpoint.IsIntakeClosed = true; checkpoint.ClosedAt = DateTimeOffset.UtcNow; checkpoint.Version++;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.checkpoint.closed", ResourceType = "CaseCheckpoint", ResourceId = checkpointId });
		await db.SaveChangesAsync(ct); return Results.Ok(ToCheckpointDto(checkpoint));
	}

	private static async Task<IResult> CompleteSelection(Guid checkpointId, SelectionRequest request, HttpContext http, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var idempotencyKey = http.Request.Headers["Idempotency-Key"].FirstOrDefault();
		if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 120) return ApiErrors.BadRequest("idempotency_key_required", "Provide an Idempotency-Key header.");
		await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
		var checkpoint = await db.CaseCheckpoints.SingleOrDefaultAsync(x => x.Id == checkpointId, ct);
		if (checkpoint is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleAsync(x => x.Id == checkpoint.CaseId, ct);
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot complete selection.");
		if (checkpoint.Kind != "SELECTION") return ApiErrors.Conflict("selection_unavailable", "This is not a selection checkpoint.");
		if (checkpoint.IsSelectionCompleted)
		{
			var sameTeams = checkpoint.PassingTeamIds.OrderBy(x => x).SequenceEqual(request.PassingTeamIds.OrderBy(x => x));
			var sameSolo = checkpoint.PassingSoloApplicationIds.OrderBy(x => x).SequenceEqual((request.PassingSoloApplicationIds ?? []).OrderBy(x => x));
			if (checkpoint.SelectionIdempotencyKey == idempotencyKey && sameTeams && sameSolo)
				return Results.Ok(new { checkpointId, version = checkpoint.Version, status = "SELECTION_CLOSED", passingTeamIds = checkpoint.PassingTeamIds, passingSoloApplicationIds = checkpoint.PassingSoloApplicationIds });
			return ApiErrors.Conflict("selection_already_completed", "Selection has already been completed with another request.");
		}
		if (project.Status != "EXECUTING") return ApiErrors.Conflict("selection_unavailable", "Execution is not active.");
		if (checkpoint.Version != request.ExpectedVersion) return ApiErrors.Conflict("version_conflict", "The checkpoint has changed.");
		var stageSequence = await db.CaseStages.Where(x => x.Id == checkpoint.StageId).Select(x => (int?)x.Sequence).SingleOrDefaultAsync(ct);
		if (stageSequence is null) return ApiErrors.NotFound();
		if (await db.CaseCheckpoints.AnyAsync(x => x.CaseId == project.Id && x.Id != checkpointId && !x.IsIntakeClosed && !x.IsSelectionCompleted && db.CaseStages.Any(s => s.Id == x.StageId && s.Sequence < stageSequence.Value), ct))
			return ApiErrors.Conflict("checkpoint_not_available", "Earlier checkpoints must be closed before selection.");
		var active = await db.Applications.Where(x => x.CaseId == project.Id && x.Status == "ADMITTED").ToListAsync(ct);
		if (active.Count == 0) return ApiErrors.Conflict("no_active_applications", "There are no active applications to evaluate at this selection checkpoint.");
		var teamApps = active.Where(x => x.Format == "TEAM").ToList();
		var soloApps = active.Where(x => x.Format == "SOLO").ToList();
		if ((project.ParticipationFormat == "TEAM" && (request.PassingSoloApplicationIds?.Length ?? 0) > 0) ||
			(project.ParticipationFormat == "SOLO" && request.PassingTeamIds.Length > 0))
			return ApiErrors.BadRequest("selection_format_not_allowed", "The selection includes an application format disabled for this case.");
		if (request.PassingTeamIds.Length > 500 || (request.PassingSoloApplicationIds?.Length ?? 0) > 500)
			return ApiErrors.BadRequest("selection_too_large", "At most 500 teams and 500 solo applications can be selected.");
		var passingTeams = request.PassingTeamIds.Distinct().ToHashSet();
		var passingSolo = (request.PassingSoloApplicationIds ?? []).Distinct().ToHashSet();
		if (passingTeams.Any(id => teamApps.All(x => x.TeamId != id)) || passingSolo.Any(id => soloApps.All(x => x.Id != id))) return ApiErrors.BadRequest("invalid_selection", "Passing application IDs must belong to active applications of this case.");
		if (checkpoint.TeamSelectionLimit is int teamLimit && passingTeams.Count > teamLimit) return ApiErrors.BadRequest("team_selection_limit_exceeded", "Too many teams selected.");
		if (checkpoint.SoloSelectionLimit is int soloLimit && passingSolo.Count > soloLimit) return ApiErrors.BadRequest("solo_selection_limit_exceeded", "Too many solo applications selected.");
		var passingApplications = teamApps.Where(x => x.TeamId.HasValue && passingTeams.Contains(x.TeamId.Value)).Select(x => x.Id).Concat(passingSolo).ToHashSet();
		foreach (var application in active.Where(x => !passingApplications.Contains(x.Id)))
		{
			application.Status = "ELIMINATED"; application.Version++; application.UpdatedAt = DateTimeOffset.UtcNow;
			db.ApplicationEvents.Add(new CaseApplicationEvent { ApplicationId = application.Id, FromStatus = "ADMITTED", ToStatus = "ELIMINATED", ActorUserId = userId, Comment = "Selection checkpoint completed." });
			await db.ParticipationHistory.Where(x => x.ApplicationId == application.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.State, "ELIMINATED"), ct);
		}
		checkpoint.IsSelectionCompleted = true; checkpoint.IsIntakeClosed = true; checkpoint.ClosedAt = DateTimeOffset.UtcNow; checkpoint.SelectionCompletedAt = DateTimeOffset.UtcNow; checkpoint.SelectionIdempotencyKey = idempotencyKey;
		checkpoint.PassingTeamIds = passingTeams.ToArray(); checkpoint.PassingSoloApplicationIds = passingSolo.ToArray(); checkpoint.Version++;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.selection.completed", ResourceType = "CaseCheckpoint", ResourceId = checkpointId });
		await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
		return Results.Ok(new { checkpointId, version = checkpoint.Version, status = "SELECTION_CLOSED", passingTeamIds = passingTeams, passingSoloApplicationIds = passingSolo, eliminatedCount = active.Count - passingApplications.Count });
	}

	private static async Task<IResult> SelectionResult(Guid checkpointId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var checkpoint = await db.CaseCheckpoints.AsNoTracking().SingleOrDefaultAsync(x => x.Id == checkpointId, ct);
		if (checkpoint is null) return ApiErrors.NotFound();
		if (checkpoint.Kind != "SELECTION") return ApiErrors.Conflict("not_selection_checkpoint", "This checkpoint does not have a selection result.");
		var application = await db.Applications.AsNoTracking()
			.Where(x => x.CaseId == checkpoint.CaseId && x.ParticipantUserIds.Contains(userId))
			.OrderByDescending(x => x.CreatedAt)
			.FirstOrDefaultAsync(ct);
		if (application is null) return ApiErrors.Forbidden("selection_result_forbidden", "You are not a participant in this case.");
		var outcome = !checkpoint.IsSelectionCompleted
			? (application.Status == "ELIMINATED" ? "NOT_APPLICABLE" : "PENDING")
			: application.Format == "SOLO"
				? (checkpoint.PassingSoloApplicationIds.Contains(application.Id) ? "PASSED" : "ELIMINATED")
				: (application.TeamId is Guid selectedTeamId && checkpoint.PassingTeamIds.Contains(selectedTeamId) ? "PASSED" : "ELIMINATED");
		if (application.Format == "SOLO")
			return Results.Ok(new { checkpointId, applicationId = application.Id, outcome, decidedAt = checkpoint.SelectionCompletedAt });
		return Results.Ok(new { checkpointId, teamId = application.TeamId, outcome, decidedAt = checkpoint.SelectionCompletedAt });
	}

	private static async Task<IResult> CloseFinalIntake(Guid caseId, CaseExecutionCommand request, HttpContext http, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var idempotencyKey = http.Request.Headers["Idempotency-Key"].FirstOrDefault();
		if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 120) return ApiErrors.BadRequest("idempotency_key_required", "Provide an Idempotency-Key header.");
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot close final intake.");
		if (project.Status == "FINAL_CLOSED" && project.FinalIntakeIdempotencyKey == idempotencyKey) return Results.Ok(new { project.Id, project.Status, project.Version });
		if (project.Status != "EXECUTING") return ApiErrors.Conflict("execution_not_active", "Execution is not active.");
		if (project.Version != request.ExpectedCaseVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (!await db.CaseCheckpoints.AnyAsync(x => x.CaseId == caseId && x.Kind == "FINAL", ct)) return ApiErrors.Conflict("final_checkpoint_missing", "A final checkpoint must be configured.");
		project.Status = "FINAL_CLOSED"; project.IsFinalIntakeClosed = true; project.FinalIntakeIdempotencyKey = idempotencyKey; project.Version++; project.UpdatedAt = DateTimeOffset.UtcNow;
		await db.CaseCheckpoints.Where(x => x.CaseId == caseId && x.Kind == "FINAL" && !x.IsIntakeClosed)
			.ExecuteUpdateAsync(update => update
				.SetProperty(x => x.IsIntakeClosed, true)
				.SetProperty(x => x.ClosedAt, DateTimeOffset.UtcNow)
				.SetProperty(x => x.Version, x => x.Version + 1), ct);
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.final_intake.closed", ResourceType = "Case", ResourceId = caseId });
		await db.SaveChangesAsync(ct); return Results.Ok(new { project.Id, project.Status, project.Version });
	}

	private static async Task<IResult> ExcludeTeam(Guid teamId, ExcludeTeamRequest request, HttpContext http, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var idempotencyKey = http.Request.Headers["Idempotency-Key"].FirstOrDefault();
		if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 120) return ApiErrors.BadRequest("idempotency_key_required", "Provide an Idempotency-Key header.");
		var team = await db.Teams.SingleOrDefaultAsync(x => x.Id == teamId, ct);
		if (team is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleAsync(x => x.Id == team.CaseId, ct);
		if (!await CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("execution_forbidden", "You cannot exclude this team.");
		if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 2000) return ApiErrors.BadRequest("reason_required", "A reason up to 2000 characters is required.");
		var existingExclusion = await db.TeamExecutionExclusions.SingleOrDefaultAsync(x => x.TeamId == teamId, ct);
		if (existingExclusion is not null)
		{
			if (existingExclusion.IdempotencyKey == idempotencyKey && existingExclusion.Reason == request.Reason.Trim()) return Results.Ok(new { teamId, status = "EXCLUDED", reason = existingExclusion.Reason, excludedAt = existingExclusion.CreatedAt, excludedByUserId = existingExclusion.ExcludedByUserId });
			return ApiErrors.Conflict("team_already_excluded", "Team is already excluded.");
		}
		if (project.Status != "EXECUTING") return ApiErrors.Conflict("execution_not_active", "Execution is not active.");
		if (project.Version != request.ExpectedCaseVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		var application = await db.Applications.SingleOrDefaultAsync(x => x.TeamId == teamId && x.CaseId == project.Id && x.Status == "ADMITTED", ct);
		if (application is null) return ApiErrors.Conflict("team_not_active", "Only an admitted active team can be excluded from execution.");
		db.TeamExecutionExclusions.Add(new TeamExecutionExclusion { TeamId = teamId, CaseId = project.Id, ExcludedByUserId = userId, Reason = request.Reason.Trim(), IdempotencyKey = idempotencyKey });
		application.Status = "ELIMINATED"; application.Version++; application.UpdatedAt = DateTimeOffset.UtcNow;
		db.ApplicationEvents.Add(new CaseApplicationEvent { ApplicationId = application.Id, FromStatus = "ADMITTED", ToStatus = "ELIMINATED", ActorUserId = userId, Comment = request.Reason.Trim() });
		await db.ParticipationHistory.Where(x => x.ApplicationId == application.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.State, "ELIMINATED"), ct);
		project.Version++; project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.team.excluded", ResourceType = "CaseTeam", ResourceId = teamId, DetailsJson = System.Text.Json.JsonSerializer.Serialize(new { request.Reason }) });
		await db.SaveChangesAsync(ct);
		var exclusion = await db.TeamExecutionExclusions.AsNoTracking().SingleAsync(x => x.TeamId == teamId, ct);
		return Results.Ok(new { teamId, status = "EXCLUDED", reason = exclusion.Reason, excludedAt = exclusion.CreatedAt, excludedByUserId = exclusion.ExcludedByUserId });
	}

	private static async Task<object> ToStageDtoAsync(CaseStage stage, VitrinaDbContext db, CancellationToken ct)
	{
		var checkpoints = await db.CaseCheckpoints.AsNoTracking()
			.Where(x => x.StageId == stage.Id)
			.OrderBy(x => x.CreatedAt)
			.ToListAsync(ct);
		var materials = await db.StoredFiles.AsNoTracking()
			.Where(x => x.StageId == stage.Id && (x.Status == "READY" || x.Status == "BOUND"))
			.ToListAsync(ct);
		return new
		{
			id = stage.Id,
			caseId = stage.CaseId,
			version = stage.Version,
			sequence = stage.Sequence,
			kind = stage.Kind,
			title = stage.Title,
			description = stage.Description,
			availableFrom = stage.AvailableFrom,
			createdAt = stage.CreatedAt,
			updatedAt = stage.UpdatedAt,
			checkpoints = checkpoints.Select(ToCheckpointDto),
			materials = materials.Select(ToFileMetadataDto)
		};
	}

	private static object ToCheckpointDto(CaseCheckpoint checkpoint) => new
	{
		id = checkpoint.Id,
		caseId = checkpoint.CaseId,
		stageId = checkpoint.StageId,
		version = checkpoint.Version,
		title = checkpoint.Title,
		kind = checkpoint.Kind,
		deadline = checkpoint.Deadline,
		intakeStatus = checkpoint.IsSelectionCompleted ? "SELECTION_CLOSED" : checkpoint.IsIntakeClosed ? "CLOSED" : "OPEN",
		selectionLimit = checkpoint.TeamSelectionLimit,
		soloSelectionLimit = checkpoint.SoloSelectionLimit,
		instructions = checkpoint.Instructions,
		closedAt = checkpoint.ClosedAt,
		allowedActions = Array.Empty<string>()
	};

	private static object ToFileMetadataDto(StoredFile file) => new
	{
		id = file.Id,
		displayName = file.OriginalFileName,
		contentType = file.ContentType,
		sizeBytes = file.Size,
		purpose = file.Purpose,
		status = "READY",
		createdAt = file.CreatedAt
	};

	internal static async Task<bool> CanManageCase(VitrinaDbContext db, Guid companyId, Guid userId, CancellationToken ct) =>
		await db.Users.AnyAsync(x => x.Id == userId && !x.IsBlocked && (x.GlobalRoles.Contains("PLATFORM_ADMIN") || x.GlobalRoles.Contains("UNIVERSITY_STAFF") || x.GlobalPermissions.Contains("cases.manage")), ct) ||
		await db.CompanyMembers.AnyAsync(x => x.CompanyId == companyId && x.UserId == userId && (x.Permissions.Contains("cases.manage") || x.Permissions.Contains("companies.update")), ct);
}

public sealed record StageCreateRequest(int ExpectedCaseVersion, string Title, string Kind, int Sequence, string? Description, DateTimeOffset? AvailableFrom);
public sealed record StageUpdateRequest(int ExpectedCaseVersion, int ExpectedVersion, string? Title, string? Description, int? Sequence, DateTimeOffset? AvailableFrom);
public sealed record CheckpointCreateRequest(int ExpectedCaseVersion, string Title, string Kind, DateTimeOffset? Deadline, int? SelectionLimit, string? Instructions, int? SoloSelectionLimit);
public sealed record CheckpointUpdateRequest(int ExpectedCaseVersion, int ExpectedVersion, string? Title, DateTimeOffset? Deadline, int? SelectionLimit, string? Instructions, int? SoloSelectionLimit);
public sealed record SelectionRequest(int ExpectedVersion, Guid[] PassingTeamIds, Guid[]? PassingSoloApplicationIds = null);
public sealed record ExcludeTeamRequest(int ExpectedCaseVersion, string Reason);
public sealed record CaseExecutionCommand(int ExpectedCaseVersion);
public sealed record CheckpointCloseRequest(int ExpectedVersion);
