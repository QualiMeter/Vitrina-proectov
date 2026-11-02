using System.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Infrastructure;
using Vitrina.Api.Features.Execution;

namespace Vitrina.Api.Features.Evaluation;

public static class ContractEvaluationEndpoints
{
	public static IEndpointRouteBuilder MapContractEvaluationEndpoints(this IEndpointRouteBuilder app)
	{
		var api = app.MapGroup("/api/v1");
		api.MapPost("/cases/{caseId:guid}/begin-evaluation", BeginEvaluation);
		api.MapGet("/cases/{caseId:guid}/evaluation", GetProgress);
		api.MapGet("/cases/{caseId:guid}/reviews", ListReviews);
		api.MapPut("/cases/{caseId:guid}/applications/{applicationId:guid}/review", SaveReview);
		api.MapGet("/cases/{caseId:guid}/awards", GetAwards);
		api.MapPut("/cases/{caseId:guid}/awards", SaveAwards);
		api.MapPost("/cases/{caseId:guid}/publish-results", PublishResults);
		api.MapGet("/public/cases/{caseId:guid}/results", PublicResults);
		api.MapGet("/cases/{caseId:guid}/results/mine", MyResults);
		api.MapGet("/cases/{caseId:guid}/evaluation-audit", EvaluationAudit);
		return app;
	}

	private static async Task<IResult> BeginEvaluation(
		Guid caseId,
		BeginEvaluationRequest request,
		HttpContext http,
		CurrentUser current,
		VitrinaDbContext db,
		CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var key = http.Request.Headers["Idempotency-Key"].FirstOrDefault();
		if (string.IsNullOrWhiteSpace(key) || key.Length > 120)
			return ApiErrors.BadRequest("idempotency_key_required", "Provide an Idempotency-Key header up to 120 characters.");
		await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return Forbidden();
		if (project.EvaluationStartIdempotencyKey == key && (project.Status is "EVALUATING" or "COMPLETED"))
		{
			await tx.CommitAsync(ct);
			return await ProgressDto(project, db, ct);
		}
		if (project.Status != "FINAL_CLOSED")
			return ApiErrors.Conflict("case_not_final_closed", "Only a case with closed final intake can enter evaluation.");
		if (project.Version != request.ExpectedCaseVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		project.Status = "EVALUATING";
		project.EvaluationStartIdempotencyKey = key;
		project.Version++;
		project.UpdatedAt = DateTimeOffset.UtcNow;
		db.AuditEntries.Add(new AuditEntry
		{
			ActorUserId = userId,
			Action = "evaluation.started",
			ResourceType = "Case",
			ResourceId = caseId,
			DetailsJson = System.Text.Json.JsonSerializer.Serialize(new { idempotencyKey = key })
		});
		try
		{
			await db.SaveChangesAsync(ct);
			await tx.CommitAsync(ct);
		}
		catch (PostgresException exception) when (
			exception.SqlState is PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected)
		{
			return ApiErrors.Conflict("case_transition_conflict", "Another request changed the case state. Reload and retry.");
		}
		return await ProgressDto(project, db, ct);
	}

	private static async Task<IResult> GetProgress(Guid caseId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return Forbidden();
		return await ProgressDto(project, db, ct);
	}

	private static async Task<IResult> ProgressDto(CaseProject project, VitrinaDbContext db, CancellationToken ct)
	{
		var eligible = await db.Applications.AsNoTracking().Where(x => x.CaseId == project.Id && x.Status == "ADMITTED").Select(x => x.Id).ToArrayAsync(ct);
		var reviewed = await db.ApplicationReviews.AsNoTracking().CountAsync(x => x.CaseId == project.Id && eligible.Contains(x.ApplicationId), ct);
		var awards = await db.CaseResultPublications.AsNoTracking().SingleOrDefaultAsync(x => x.CaseId == project.Id, ct);
		var response = new Dictionary<string, object?>
		{
			["caseId"] = project.Id,
			["status"] = project.Status,
			["caseVersion"] = project.Version,
			["totalEligibleApplications"] = eligible.Length,
			["reviewedApplications"] = reviewed,
			["draftAwardsVersion"] = awards?.Version ?? 0,
			["canPublish"] = project.Status == "EVALUATING" && awards is not null
		};
		if (awards?.PublishedAt is DateTimeOffset publishedAt)
			response["publishedAt"] = publishedAt;
		return Results.Ok(response);
	}

	private static async Task<IResult> ListReviews(Guid caseId, int? page, int? pageSize, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var currentPage = page ?? 1;
		var currentPageSize = pageSize ?? 20;
		if (currentPage < 1 || currentPageSize is < 1 or > 100)
			return ApiErrors.BadRequest("invalid_pagination", "page must be positive and pageSize must be between 1 and 100.");
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return Forbidden();
		var query = from review in db.ApplicationReviews.AsNoTracking()
			where review.CaseId == caseId
			orderby review.UpdatedAt descending
			select new
			{
				review.ApplicationId,
				review.CaseId,
				review.Version,
				review.Feedback,
				review.Score,
				review.UpdatedAt,
				isPublished = project.Status == "COMPLETED"
			};
		var total = await query.CountAsync(ct);
		var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync(ct);
		return Results.Ok(new { items, page = currentPage, pageSize = currentPageSize, total });
	}

	private static async Task<IResult> SaveReview(
		Guid caseId,
		Guid applicationId,
		ReviewDraftRequest request,
		CurrentUser current,
		VitrinaDbContext db,
		CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		if (string.IsNullOrWhiteSpace(request.Feedback) || request.Feedback.Trim().Length > 10000)
			return ApiErrors.BadRequest("feedback_required", "Feedback is required and must not exceed 10000 characters.");
		await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return Forbidden();
		if (project.Status != "EVALUATING") return ApiErrors.Conflict("case_not_evaluating", "Reviews can only be changed while the case is evaluating.");
		var application = await db.Applications.SingleOrDefaultAsync(x => x.Id == applicationId && x.CaseId == caseId && x.Status == "ADMITTED", ct);
		if (application is null) return ApiErrors.NotFound();
		if (request.Score.HasValue &&
			(project.ScoreRangeMin is null || project.ScoreRangeMax is null ||
			 request.Score < project.ScoreRangeMin || request.Score > project.ScoreRangeMax))
			return ApiErrors.BadRequest("score_out_of_range", "The score must be within the score range published in the case rules.");
		var review = await db.ApplicationReviews.SingleOrDefaultAsync(x => x.ApplicationId == applicationId, ct);
		if (review is null)
		{
			if (request.ExpectedReviewVersion != 0) return ApiErrors.Conflict("review_version_conflict", "Use expectedReviewVersion 0 to create a review.");
			review = new ApplicationReview
			{
				CaseId = caseId,
				ApplicationId = applicationId,
				UpdatedByUserId = userId,
				Feedback = request.Feedback.Trim(),
				Score = request.Score,
				Version = 1
			};
			db.ApplicationReviews.Add(review);
		}
		else
		{
			if (review.Version != request.ExpectedReviewVersion) return ApiErrors.Conflict("review_version_conflict", "The review has changed.");
			review.Feedback = request.Feedback.Trim();
			review.Score = request.Score;
			review.UpdatedByUserId = userId;
			review.Version++;
			review.UpdatedAt = DateTimeOffset.UtcNow;
		}
		db.ApplicationReviewRevisions.Add(new ApplicationReviewRevision
		{
			ReviewId = review.Id,
			CaseId = caseId,
			ApplicationId = applicationId,
			ActorUserId = userId,
			Feedback = review.Feedback,
			Score = review.Score,
			Version = review.Version
		});
		db.AuditEntries.Add(new AuditEntry
		{
			ActorUserId = userId,
			Action = "evaluation.review.updated",
			ResourceType = "ApplicationReview",
			ResourceId = review.Id,
			DetailsJson = System.Text.Json.JsonSerializer.Serialize(new { review.Version, review.Score })
		});
		try
		{
			await db.SaveChangesAsync(ct);
			await tx.CommitAsync(ct);
		}
		catch (DbUpdateConcurrencyException)
		{
			return ApiErrors.Conflict("review_version_conflict", "The review was changed by another request.");
		}
		catch (DbUpdateException)
		{
			return ApiErrors.Conflict("review_already_created", "A review was created by another request.");
		}
		catch (PostgresException exception) when (
			exception.SqlState is PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected)
		{
			return ApiErrors.Conflict("review_version_conflict", "The review was changed by another request.");
		}
		return Results.Ok(new { applicationId, caseId, review.Version, review.Feedback, review.Score, review.UpdatedAt, isPublished = false });
	}

	private static async Task<IResult> GetAwards(Guid caseId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return Forbidden();
		var awards = await db.CaseAwards.AsNoTracking().Where(x => x.CaseId == caseId).ToListAsync(ct);
		var publication = await db.CaseResultPublications.AsNoTracking().SingleOrDefaultAsync(x => x.CaseId == caseId, ct);
		var response = new Dictionary<string, object?>
		{
			["caseId"] = caseId,
			["version"] = publication?.Version ?? 0,
			["placements"] = awards.Where(x => x.Category == "PLACE" && x.Rank.HasValue)
				.Select(x => new { applicationId = x.ApplicationId, place = x.Rank!.Value }).ToArray(),
			["nominations"] = awards.Where(x => x.Category == "NOMINATION")
				.Select(x => new { applicationId = x.ApplicationId, nomination = x.Title }).ToArray()
		};
		if (publication is not null)
			response["updatedAt"] = publication.UpdatedAt;
		return Results.Ok(response);
	}

	private static async Task<IResult> SaveAwards(
		Guid caseId,
		SaveAwardsDraftRequest request,
		CurrentUser current,
		VitrinaDbContext db,
		CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		if (request.Placements is null || request.Nominations is null ||
			request.Placements.Length > 1000 || request.Nominations.Length > 1000 ||
			request.Placements.Any(x => x is null) || request.Nominations.Any(x => x is null))
			return ApiErrors.BadRequest("invalid_awards", "Awards payload is invalid.");
		if (request.Nominations.Any(x => string.IsNullOrWhiteSpace(x.Nomination) || x.Nomination.Trim().Length > 120))
			return ApiErrors.BadRequest("invalid_nomination", "Nomination names are required and must not exceed 120 characters.");
		if (request.Placements.Select(x => x.ApplicationId).Distinct().Count() != request.Placements.Length ||
			request.Nominations
				.Select(x => new { x.ApplicationId, Nomination = x.Nomination.Trim().ToUpperInvariant() })
				.Distinct().Count() != request.Nominations.Length)
			return ApiErrors.BadRequest("duplicate_awards", "Duplicate application placements or nominations are not allowed.");
		await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return Forbidden();
		if (project.Status != "EVALUATING") return ApiErrors.Conflict("case_not_evaluating", "Awards can only be edited during evaluation.");
		var publication = await db.CaseResultPublications.SingleOrDefaultAsync(x => x.CaseId == caseId, ct);
		var currentVersion = publication?.Version ?? 0;
		if (request.ExpectedAwardsVersion != currentVersion) return ApiErrors.Conflict("awards_version_conflict", "The awards draft has changed.");
		if (request.Placements.Any(x => x.Place < 1 || x.Place > project.PrizePlaceCount))
			return ApiErrors.BadRequest("invalid_place", "Place must be within the published prizePlaceCount.");
		if (!project.AllowSharedPlaces && request.Placements.GroupBy(x => x.Place).Any(x => x.Count() > 1))
			return ApiErrors.BadRequest("shared_places_not_allowed", "Published rules do not allow shared places.");
		if (request.Nominations.Any(x =>
			string.IsNullOrWhiteSpace(x.Nomination) ||
			x.Nomination.Trim().Length > 120 ||
			!project.NominationNames.Contains(x.Nomination.Trim(), StringComparer.OrdinalIgnoreCase)))
			return ApiErrors.BadRequest("invalid_nomination", "Nomination must be selected from the published nomination list.");
		var ids = request.Placements.Select(x => x.ApplicationId).Concat(request.Nominations.Select(x => x.ApplicationId)).Distinct().ToArray();
		if (ids.Length > 0 && await db.Applications.CountAsync(x => x.CaseId == caseId && x.Status == "ADMITTED" && ids.Contains(x.Id), ct) != ids.Length)
			return ApiErrors.BadRequest("ineligible_application", "Awards can only be assigned to admitted applications in this case.");
		if (publication is null)
		{
			publication = new CaseResultPublication { CaseId = caseId };
			db.CaseResultPublications.Add(publication);
		}
		else
		{
			publication.Version++;
			publication.UpdatedAt = DateTimeOffset.UtcNow;
		}
		db.CaseAwards.RemoveRange(db.CaseAwards.Where(x => x.CaseId == caseId));
		foreach (var item in request.Placements)
		{
			db.CaseAwards.Add(new CaseAward
			{
				CaseId = caseId,
				ApplicationId = item.ApplicationId,
				Category = "PLACE",
				Title = $"{item.Place}",
				Rank = item.Place
			});
		}
		foreach (var item in request.Nominations)
		{
			db.CaseAwards.Add(new CaseAward
			{
				CaseId = caseId,
				ApplicationId = item.ApplicationId,
				Category = "NOMINATION",
				Title = item.Nomination.Trim()
			});
		}
		db.AuditEntries.Add(new AuditEntry
		{
			ActorUserId = userId,
			Action = "results.awards.draft.updated",
			ResourceType = "Case",
			ResourceId = caseId,
			DetailsJson = System.Text.Json.JsonSerializer.Serialize(new
			{
				publication.Version,
				placements = request.Placements.Length,
				nominations = request.Nominations.Length
			})
		});
		try
		{
			await db.SaveChangesAsync(ct);
			await tx.CommitAsync(ct);
		}
		catch (DbUpdateConcurrencyException)
		{
			return ApiErrors.Conflict("awards_version_conflict", "The awards draft was changed by another request.");
		}
		catch (DbUpdateException)
		{
			return ApiErrors.Conflict("awards_version_conflict", "Another request created or changed the awards draft.");
		}
		catch (PostgresException exception) when (
			exception.SqlState is PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected)
		{
			return ApiErrors.Conflict("awards_version_conflict", "The awards draft was changed by another request.");
		}
		return Results.Ok(new
		{
			caseId,
			version = publication.Version,
			placements = request.Placements,
			nominations = request.Nominations,
			updatedAt = publication.UpdatedAt
		});
	}

	private static async Task<IResult> PublishResults(
		Guid caseId,
		PublishResultsRequest request,
		HttpContext http,
		CurrentUser current,
		VitrinaDbContext db,
		CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		if (!request.Confirm) return ApiErrors.BadRequest("confirmation_required", "Set confirm=true to publish results.");
		var key = http.Request.Headers["Idempotency-Key"].FirstOrDefault();
		if (string.IsNullOrWhiteSpace(key) || key.Length > 120)
			return ApiErrors.BadRequest("idempotency_key_required", "Provide an Idempotency-Key header.");
		await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return Forbidden();
		if (project.Status == "COMPLETED" && project.ResultsPublishIdempotencyKey == key)
		{
			await tx.CommitAsync(ct);
			return await PublicResultsDto(caseId, db, ct);
		}
		if (project.Status != "EVALUATING") return ApiErrors.Conflict("case_not_evaluating", "Only an evaluating case can publish results.");
		if (project.Version != request.ExpectedCaseVersion) return ApiErrors.Conflict("version_conflict", "The case has changed.");
		var publication = await db.CaseResultPublications.SingleOrDefaultAsync(x => x.CaseId == caseId, ct);
		if (publication is null || publication.Version != request.ExpectedAwardsVersion)
			return ApiErrors.Conflict("awards_version_conflict", "The awards draft has changed.");
		publication.Status = "PUBLISHED";
		publication.PublishedByUserId = userId;
		publication.PublishedAt = DateTimeOffset.UtcNow;
		publication.UpdatedAt = DateTimeOffset.UtcNow;
		publication.Version++;
		project.Status = "COMPLETED";
		project.ResultsPublishIdempotencyKey = key;
		project.Version++;
		project.UpdatedAt = DateTimeOffset.UtcNow;
		var participantArrays = await db.Applications.AsNoTracking()
			.Where(x => x.CaseId == caseId && x.Status == "ADMITTED")
			.Select(x => x.ParticipantUserIds)
			.ToListAsync(ct);
		var participantIds = participantArrays.SelectMany(x => x).Distinct().ToArray();
		foreach (var participantId in participantIds)
		{
			var notification = new UserNotification
			{
				UserId = participantId,
				Type = "CASE_RESULTS_PUBLISHED",
				Title = "Опубликованы результаты",
				Body = $"Опубликованы результаты проекта «{project.Title}».",
				ResourceType = "Case",
				ResourceId = caseId
			};
			db.Notifications.Add(notification);
			db.OutboxMessages.Add(new OutboxMessage
			{
				Type = "notification.created",
				PayloadJson = System.Text.Json.JsonSerializer.Serialize(new
				{
					notificationId = notification.Id,
					userId = participantId
				})
			});
		}
		db.AuditEntries.Add(new AuditEntry
		{
			ActorUserId = userId,
			Action = "results.published",
			ResourceType = "Case",
			ResourceId = caseId,
			DetailsJson = System.Text.Json.JsonSerializer.Serialize(new { idempotencyKey = key, publication.Version })
		});
		try
		{
			await db.SaveChangesAsync(ct);
			await tx.CommitAsync(ct);
		}
		catch (DbUpdateConcurrencyException)
		{
			return ApiErrors.Conflict("publication_conflict", "The case or awards were changed by another request.");
		}
		catch (PostgresException exception) when (
			exception.SqlState is PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected)
		{
			return ApiErrors.Conflict("publication_conflict", "Another request changed the case while publishing results.");
		}
		return await PublicResultsDto(caseId, db, ct);
	}

	private static async Task<IResult> PublicResults(Guid caseId, VitrinaDbContext db, CancellationToken ct)
	{
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId && x.Status == "COMPLETED", ct);
		if (project is null) return ApiErrors.NotFound();
		return await PublicResultsDto(caseId, db, ct);
	}

	private static async Task<IResult> PublicResultsDto(Guid caseId, VitrinaDbContext db, CancellationToken ct)
	{
		var publication = await db.CaseResultPublications.AsNoTracking().SingleOrDefaultAsync(x => x.CaseId == caseId && x.Status == "PUBLISHED", ct);
		if (publication is null) return ApiErrors.NotFound();
		var project = await db.Cases.AsNoTracking().SingleAsync(x => x.Id == caseId, ct);
		var awards = await db.CaseAwards.AsNoTracking().Where(x => x.CaseId == caseId).ToListAsync(ct);
		var applicationIds = awards.Select(x => x.ApplicationId).Distinct().ToArray();
		var entries = new List<object>();
		foreach (var applicationId in applicationIds)
		{
			var application = await db.Applications.AsNoTracking().SingleAsync(x => x.Id == applicationId, ct);
			string displayName;
			if (application.TeamId is Guid teamId)
				displayName = await db.Teams.AsNoTracking().Where(x => x.Id == teamId).Select(x => x.Name).SingleOrDefaultAsync(ct) ?? "Команда";
			else
				displayName = await db.Users.AsNoTracking()
				.Where(x => x.Id == application.SoloApplicantUserId)
				.Select(x => x.Nickname)
				.SingleOrDefaultAsync(ct) ?? "Участник";
			var appAwards = awards.Where(x => x.ApplicationId == applicationId).ToArray();
			entries.Add(new
			{
				entryId = application.PublicResultId,
				displayName,
				format = application.Format,
				placements = appAwards.Where(x => x.Category == "PLACE" && x.Rank.HasValue).Select(x => x.Rank!.Value).ToArray(),
				nominations = appAwards.Where(x => x.Category == "NOMINATION").Select(x => x.Title).ToArray()
			});
		}
		return Results.Ok(new
		{
			caseId,
			publishedAt = publication.PublishedAt,
			entries,
			contestRules = new
			{
				project.AllowSharedPlaces,
				project.PrizePlaceCount,
				nominationNames = project.NominationNames,
				scoreRange = project.ScoreRangeMin is decimal min && project.ScoreRangeMax is decimal max
					? new { min, max }
					: null
			}
		});
	}

	private static async Task<IResult> MyResults(Guid caseId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId && x.Status == "COMPLETED", ct);
		if (project is null) return ApiErrors.NotFound();
		var application = await db.Applications.AsNoTracking().SingleOrDefaultAsync(x => x.CaseId == caseId && x.ParticipantUserIds.Contains(userId), ct);
		if (application is null) return ApiErrors.NotFound();
		var publication = await db.CaseResultPublications.AsNoTracking().SingleOrDefaultAsync(x => x.CaseId == caseId && x.Status == "PUBLISHED", ct);
		if (publication is null) return ApiErrors.NotFound();
		var awards = await db.CaseAwards.AsNoTracking().Where(x => x.CaseId == caseId && x.ApplicationId == application.Id).ToListAsync(ct);
		var review = await db.ApplicationReviews.AsNoTracking().SingleOrDefaultAsync(x => x.ApplicationId == application.Id, ct);
		var response = new Dictionary<string, object?>
		{
			["caseId"] = caseId,
			["applicationId"] = application.Id,
			["publishedAt"] = publication.PublishedAt,
			["placements"] = awards.Where(x => x.Category == "PLACE" && x.Rank.HasValue).Select(x => x.Rank!.Value).ToArray(),
			["nominations"] = awards.Where(x => x.Category == "NOMINATION").Select(x => x.Title).ToArray()
		};
		if (review is not null)
		{
			response["review"] = new
			{
				review.ApplicationId,
				review.CaseId,
				review.Version,
				review.Feedback,
				review.Score,
				review.UpdatedAt,
				isPublished = true
			};
		}
		return Results.Ok(response);
	}

	private static async Task<IResult> EvaluationAudit(
		Guid caseId,
		int? page,
		int? pageSize,
		CurrentUser current,
		VitrinaDbContext db,
		CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var currentPage = page ?? 1;
		var currentPageSize = pageSize ?? 20;
		if (currentPage < 1 || currentPageSize is < 1 or > 100) return ApiErrors.BadRequest("invalid_pagination", "Invalid page or pageSize.");
		var project = await db.Cases.AsNoTracking().SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (!await ExecutionEndpoints.CanManageCase(db, project.CompanyId, userId, ct)) return Forbidden();
		var query = db.AuditEntries.AsNoTracking().Where(x =>
			x.ResourceId == caseId ||
			(x.ResourceType == "ApplicationReview" &&
			 db.ApplicationReviews.Any(review => review.Id == x.ResourceId && review.CaseId == caseId)));
		var total = await query.CountAsync(ct);
		var items = await (from entry in query
			join actor in db.Users.AsNoTracking() on entry.ActorUserId equals (Guid?)actor.Id
			orderby entry.CreatedAt descending
			select new
			{
				eventId = entry.Id,
				caseId,
				action = entry.Action,
				actorUserId = actor.Id,
				at = entry.CreatedAt,
				objectType = entry.ResourceType,
				objectId = entry.ResourceId!.Value
			}).Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync(ct);
		return Results.Ok(new { items, page = currentPage, pageSize = currentPageSize, total });
	}

	private static IResult Forbidden() => ApiErrors.Forbidden("evaluation_forbidden", "You do not have permission to perform this operation.");
}

public sealed record BeginEvaluationRequest(int ExpectedCaseVersion);
public sealed record ReviewDraftRequest(int ExpectedReviewVersion, string Feedback, decimal? Score);
public sealed record PrizeAwardRequest(Guid ApplicationId, int Place);
public sealed record NominationAwardRequest(Guid ApplicationId, string Nomination);
public sealed record SaveAwardsDraftRequest(int ExpectedAwardsVersion, PrizeAwardRequest[] Placements, NominationAwardRequest[] Nominations);
public sealed record PublishResultsRequest(int ExpectedCaseVersion, int ExpectedAwardsVersion, bool Confirm);
