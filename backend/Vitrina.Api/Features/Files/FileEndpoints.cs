using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Features.Execution;
using Vitrina.Api.Infrastructure;
using Vitrina.Api.Infrastructure.Storage;

namespace Vitrina.Api.Features.Files;

public static class FileEndpoints
{
	public static IEndpointRouteBuilder MapFileEndpoints(this IEndpointRouteBuilder app)
	{
		var api = app.MapGroup("/api/v1").WithTags("Files");
		api.MapPost("/files", Upload).DisableAntiforgery();
		api.MapGet("/files/{fileId:guid}", Metadata);
		api.MapGet("/files/{fileId:guid}/content", Download);
		api.MapPost("/stages/{stageId:guid}/materials", BindStageMaterial);
		return app;
	}

	private static async Task<IResult> Upload(
		[FromForm] IFormFile file,
		[FromForm] string purpose,
		[FromForm] Guid caseId,
		[FromForm] Guid? stageId,
		[FromForm] Guid? checkpointId,
		[FromForm] Guid? applicationId,
		CurrentUser current,
		VitrinaDbContext db,
		IPrivateObjectStorage storage,
		IOptions<StorageOptions> storageOptions,
		CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		if (file is null || file.Length <= 0) return ApiErrors.BadRequest("file_required", "A non-empty file is required.");
		if (file.Length > storageOptions.Value.MaxFileSizeBytes) return ApiErrors.BadRequest("file_too_large", $"Maximum file size is {storageOptions.Value.MaxFileSizeBytes} bytes.");
		if (purpose is not ("STAGE_MATERIAL" or "SUBMISSION_ATTACHMENT")) return ApiErrors.BadRequest("invalid_file_purpose", "Purpose must be STAGE_MATERIAL or SUBMISSION_ATTACHMENT.");
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (purpose == "STAGE_MATERIAL")
		{
			if (stageId is not Guid sid || checkpointId is not null || applicationId is not null) return ApiErrors.BadRequest("invalid_file_binding", "Stage material requires stageId only.");
			if (!await db.CaseStages.AnyAsync(x => x.Id == sid && x.CaseId == caseId, ct)) return ApiErrors.NotFound();
			if (project.Status is not ("DRAFT" or "REVISION_REQUIRED")) return ApiErrors.Conflict("case_structure_locked", "Stage materials cannot be uploaded after publication.");
			if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("file_upload_forbidden", "You cannot upload case materials.");
		}
		else
		{
			if (stageId is not null || checkpointId is not Guid cpId || applicationId is not Guid appId) return ApiErrors.BadRequest("invalid_file_binding", "Submission attachment requires checkpointId and applicationId.");
			var checkpoint = await db.CaseCheckpoints.SingleOrDefaultAsync(x => x.Id == cpId && x.CaseId == caseId, ct);
			var application = await db.Applications.SingleOrDefaultAsync(x => x.Id == appId && x.CaseId == caseId, ct);
			if (checkpoint is null || application is null) return ApiErrors.NotFound();
			if (project.Status != "EXECUTING" || checkpoint.IsIntakeClosed || (checkpoint.Kind == "FINAL" && project.IsFinalIntakeClosed) || (checkpoint.Kind == "SELECTION" && checkpoint.IsSelectionCompleted))
				return ApiErrors.Conflict("submission_intake_closed", "This checkpoint is not accepting attachments.");
			var checkpointStage = await db.CaseStages.SingleOrDefaultAsync(x => x.Id == checkpoint.StageId, ct);
			if (checkpointStage?.AvailableFrom is DateTimeOffset stageAvailableFrom && stageAvailableFrom > DateTimeOffset.UtcNow) return ApiErrors.Conflict("stage_not_available", "This stage is not available yet.");
			var canSubmit = application.Format == "SOLO" ? application.SoloApplicantUserId == userId : application.TeamId is Guid tid && await db.Teams.AnyAsync(x => x.Id == tid && x.CaptainUserId == userId, ct);
			if (!canSubmit || application.Status != "ADMITTED") return ApiErrors.Forbidden("file_upload_forbidden", "Only the active applicant or team captain can upload submission attachments.");
			if (application.TeamId is Guid excludedTeamId && await db.TeamExecutionExclusions.AnyAsync(x => x.TeamId == excludedTeamId, ct)) return ApiErrors.Forbidden("team_excluded", "Your team has been excluded from execution.");
			var nda = await db.NdaPolicies.AsNoTracking().SingleOrDefaultAsync(x => x.CaseId == caseId, ct);
			if (nda is { IsRequired: true } && !await db.NdaAcceptances.AnyAsync(x => x.ApplicationId == application.Id && x.Version == nda.Version, ct)) return ApiErrors.Conflict("nda_acceptance_required", "The current NDA must be accepted before uploading submission attachments.");
		}

		var safeName = Path.GetFileName(file.FileName).Replace("\\", "_").Replace("/", "_");
		if (safeName.Length > 180) safeName = safeName[^180..];
		var contentType = NormalizeContentType(file.ContentType, safeName);
		await using var input = file.OpenReadStream();
		var bytes = new byte[checked((int)file.Length)];
		var read = 0;
		while (read < bytes.Length)
		{
			var count = await input.ReadAsync(bytes.AsMemory(read), ct);
			if (count == 0) break;
			read += count;
		}
		if (read != bytes.Length) return ApiErrors.BadRequest("file_read_failed", "The uploaded file could not be read completely.");
		if (!HasAllowedSignature(bytes, contentType)) return ApiErrors.BadRequest("file_signature_invalid", "File content does not match an allowed file type.");
		var hash = Convert.ToHexString(SHA256.HashData(bytes));
		var objectKey = $"{caseId:N}/{Guid.NewGuid():N}";
		var stored = new StoredFile
		{
			OwnerUserId = userId, CaseId = caseId, StageId = stageId, CheckpointId = checkpointId,
			ApplicationId = applicationId, Purpose = purpose, ObjectKey = objectKey,
			OriginalFileName = safeName, ContentType = contentType, Size = bytes.LongLength, Sha256 = hash,
			Status = "UPLOADING"
		};
		db.StoredFiles.Add(stored);
		await db.SaveChangesAsync(ct);
		try
		{
			await using var stream = new MemoryStream(bytes, writable: false);
			await storage.PutAsync(objectKey, stream, bytes.LongLength, contentType, ct);
			stored.Status = "READY";
			await db.SaveChangesAsync(ct);
		}
		catch
		{
			stored.Status = "FAILED";
			await db.SaveChangesAsync(CancellationToken.None);
			throw;
		}
		return Results.Created($"/api/v1/files/{stored.Id}", ToDto(stored));
	}

	private static async Task<IResult> BindStageMaterial(Guid stageId, BindStageMaterialRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var stage = await db.CaseStages.SingleOrDefaultAsync(x => x.Id == stageId, ct);
		if (stage is null) return ApiErrors.NotFound();
		var project = await db.Cases.SingleAsync(x => x.Id == stage.CaseId, ct);
		if (project.Status is not ("DRAFT" or "REVISION_REQUIRED")) return ApiErrors.Conflict("case_structure_locked", "Materials cannot be bound after publication.");
		if (project.Version != request.ExpectedCaseVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return ApiErrors.Forbidden("file_bind_forbidden", "You cannot bind materials.");
		var file = await db.StoredFiles.SingleOrDefaultAsync(x => x.Id == request.FileId && x.CaseId == project.Id, ct);
		if (file is null) return ApiErrors.NotFound();
		if (file.OwnerUserId != userId || file.Purpose != "STAGE_MATERIAL" || file.Status != "READY" || file.StageId != stageId) return ApiErrors.Conflict("file_not_bindable", "The file is not a ready material for this stage.");
		file.Status = "BOUND";
		project.Version++; project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry { ActorUserId = userId, Action = "execution.stage.material.bound", ResourceType = "StoredFile", ResourceId = file.Id });
		await db.SaveChangesAsync(ct);
		return Results.Created($"/api/v1/files/{file.Id}", ToMetadataDto(file));
	}

	private static async Task<IResult> Metadata(Guid fileId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var file = await db.StoredFiles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == fileId, ct);
		if (file is null || file.Status is not ("READY" or "BOUND" or "ATTACHED")) return ApiErrors.NotFound();
		if (!await CanAccessFile(file, userId, db, ct)) return ApiErrors.NotFound();
		return Results.Ok(ToMetadataDto(file));
	}

	private static async Task<IResult> Download(Guid fileId, HttpContext http, CurrentUser current, VitrinaDbContext db, IPrivateObjectStorage storage, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var file = await db.StoredFiles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == fileId, ct);
		if (file is null || file.Status is not ("READY" or "BOUND" or "ATTACHED")) return ApiErrors.NotFound();
		if (!await CanAccessFile(file, userId, db, ct)) return ApiErrors.NotFound();
		var stream = await storage.GetAsync(file.ObjectKey, ct);
		if (stream.CanSeek && stream.Length != file.Size)
		{
			await stream.DisposeAsync();
			return Results.Problem(statusCode: StatusCodes.Status502BadGateway, title: "Private storage returned an incomplete object.");
		}
		http.Response.Headers["Cache-Control"] = "no-store, no-cache, max-age=0";
		http.Response.Headers["Pragma"] = "no-cache";
		http.Response.Headers["X-Content-Type-Options"] = "nosniff";
		return Results.File(stream, file.ContentType, file.OriginalFileName, enableRangeProcessing: false);
	}

	private static async Task<bool> CanAccessFile(StoredFile file, Guid userId, VitrinaDbContext db, CancellationToken ct)
	{
		if (file.OwnerUserId == userId && (file.Status is "READY" or "BOUND" or "ATTACHED")) return true;
		if (file.CaseId is not Guid caseId) return false;
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return false;
		if (await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct))
			return file.Purpose != "SUBMISSION_ATTACHMENT" || file.Status == "ATTACHED";
		if (file.Purpose == "STAGE_MATERIAL")
		{
			if (file.Status != "BOUND" || project.Status != "EXECUTING") return false;
			var apps = await db.Applications.AsNoTracking().Where(x => x.CaseId == caseId && x.ParticipantUserIds.Contains(userId) && x.Status == "ADMITTED").ToListAsync(ct);
			if (apps.Count == 0) return false;
			var applicationIds = apps.Select(x => x.Id).ToArray();
			var teamIds = apps.Where(x => x.TeamId.HasValue).Select(x => x.TeamId!.Value).ToArray();
			if (teamIds.Length > 0 && await db.TeamExecutionExclusions.AnyAsync(e => teamIds.Contains(e.TeamId), ct)) return false;
			if (file.StageId is Guid fileStageId)
			{
				var fileStage = await db.CaseStages.AsNoTracking().SingleOrDefaultAsync(x => x.Id == fileStageId && x.CaseId == caseId, ct);
				if (fileStage is null || (fileStage.AvailableFrom is DateTimeOffset availableFrom && availableFrom > DateTimeOffset.UtcNow)) return false;
				var fileStageSequence = fileStage.Sequence;
				var earlierOpen = await db.CaseCheckpoints.AnyAsync(x => x.CaseId == caseId && !x.IsIntakeClosed && !x.IsSelectionCompleted && db.CaseStages.Any(s => s.Id == x.StageId && s.Sequence < fileStageSequence), ct);
				if (earlierOpen) return false;
			}
			var policy = await db.NdaPolicies.AsNoTracking().SingleOrDefaultAsync(x => x.CaseId == caseId, ct);
			if (policy is { IsRequired: true } && !await db.NdaAcceptances.AnyAsync(x => applicationIds.Contains(x.ApplicationId) && x.Version == policy.Version, ct)) return false;
			return true;
		}
		if (file.Purpose != "SUBMISSION_ATTACHMENT" || file.Status != "ATTACHED" || file.ApplicationId is not Guid applicationId) return false;
		var application = await db.Applications.AsNoTracking().SingleOrDefaultAsync(x => x.Id == applicationId, ct);
		return application is not null && (application.ParticipantUserIds.Contains(userId) || await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct));
	}

	private static string NormalizeContentType(string contentType, string fileName)
	{
		var extension = Path.GetExtension(fileName).ToLowerInvariant();
		return extension switch
		{
			".pdf" => "application/pdf",
			".png" => "image/png",
			".jpg" or ".jpeg" => "image/jpeg",
			".txt" => "text/plain",
			".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
			_ => "application/octet-stream"
		};
	}

	private static bool HasAllowedSignature(byte[] data, string contentType)
	{
		if (contentType == "application/pdf") return data.Length >= 5 && data.AsSpan(0, 5).SequenceEqual("%PDF-"u8);
		if (contentType == "image/png") return data.Length >= 8 && data.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
		if (contentType == "image/jpeg") return data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF;
		if (contentType == "text/plain") return data.All(x => x == 9 || x == 10 || x == 13 || x >= 32);
		if (contentType.StartsWith("application/vnd.openxmlformats-officedocument.", StringComparison.Ordinal)) return data.Length >= 4 && data[0] == 0x50 && data[1] == 0x4B && data[2] == 0x03 && data[3] == 0x04;
		return false;
	}

	private static object ToDto(StoredFile x) => new { fileId = x.Id, x.Status, createdAt = x.CreatedAt, stagedUntil = x.CreatedAt.AddDays(1) };
	private static object ToMetadataDto(StoredFile x) => new { id = x.Id, displayName = x.OriginalFileName, contentType = x.ContentType, sizeBytes = x.Size, x.Purpose, x.Status, x.CreatedAt };
}

public sealed record BindStageMaterialRequest(int ExpectedCaseVersion, Guid FileId);
