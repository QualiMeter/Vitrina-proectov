using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Profiles;

public static class ProfileEndpoints
{
	public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
	{
		var group = app.MapGroup("/api/v1").WithTags("StudentProfiles");
		group.MapGet("/me/student-profile", GetMine);
		group.MapPatch("/me/student-profile", UpdateMine);
		group.MapGet("/public/students/{studentId:guid}", GetPublic);
		group.MapGet("/companies/{companyId:guid}/students/{studentId:guid}/profile", GetCompanyView);
		group.MapGet("/me/case-participations", GetParticipations);
		group.MapGet("/reference-data", GetReferenceData);
		return app;
	}

	private static async Task<IResult> GetMine(CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		var result = await db.Users.AsNoTracking()
			.Where(x => x.Id == userId)
			.Join(db.StudentProfiles.AsNoTracking(), user => user.Id, profile => profile.UserId,
				(user, profile) => new
				{
					userId = user.Id, fullName = user.FullName, nickname = user.Nickname,
					avatarUrl = profile.AvatarObjectKey == null ? null : $"/api/v1/public/students/{user.Id}/avatar",
					profile.Description, profile.PublicSummary, profile.SkillIds, profile.TechnologyIds,
					achievements = profile.Achievements.Select(json => JsonSerializer.Deserialize<object>(json)), publicLinks = profile.PublicLinksJson.Select(json => System.Text.Json.JsonSerializer.Deserialize<object>(json)),
					profile.InstituteId, profile.Course, profile.StudyGroup, profile.Version
				}).SingleOrDefaultAsync(ct);
		return result is null ? ApiErrors.NotFound() : Results.Ok(result);
	}

	private static async Task<IResult> UpdateMine(
		JsonElement request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		if (!request.TryGetProperty("expectedVersion", out var versionElement) || !versionElement.TryGetInt32(out var expectedVersion))
			return ApiErrors.BadRequest("validation_failed", "expectedVersion is required.");

		var profile = await db.StudentProfiles.SingleOrDefaultAsync(x => x.UserId == userId, ct);
		var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, ct);
		if (profile is null || user is null)
			return ApiErrors.NotFound();
		if (profile.Version != expectedVersion)
			return ApiErrors.Conflict("version_conflict", "The profile has changed.");

		string? ReadString(string name) => request.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
			? value.GetString() : null;
		if (ReadString("fullName") is { } fullName)
		{
			if (string.IsNullOrWhiteSpace(fullName) || fullName.Length > 200)
				return ApiErrors.BadRequest("validation_failed", "fullName is invalid.");
			user.FullName = fullName.Trim();
		}
		if (ReadString("nickname") is { } nickname)
		{
			nickname = nickname.Trim();
			if (nickname.Length is < 2 or > 40 || await db.Users.AnyAsync(x => x.Id != userId && x.Nickname == nickname, ct))
				return ApiErrors.Conflict("nickname_unavailable", "The nickname is invalid or already in use.");
			user.Nickname = nickname;
		}
		if (request.TryGetProperty("description", out var description))
		{
			profile.Description = description.ValueKind == JsonValueKind.Null ? null : description.GetString();
			if (profile.Description?.Length > 2048) return ApiErrors.BadRequest("validation_failed", "Description is too long.");
		}
		if (request.TryGetProperty("publicSummary", out var summary))
		{
			profile.PublicSummary = summary.ValueKind == JsonValueKind.Null ? null : summary.GetString();
			if (profile.PublicSummary?.Length > 2000) return ApiErrors.BadRequest("validation_failed", "Public summary is too long.");
		}
		if (request.TryGetProperty("instituteId", out var institute))
		{
			if (institute.ValueKind is not (JsonValueKind.Null or JsonValueKind.String))
				return ApiErrors.BadRequest("validation_failed", "instituteId must be a UUID or null.");
			profile.InstituteId = institute.ValueKind == JsonValueKind.Null ? null : institute.GetGuid();
			if (profile.InstituteId is Guid instituteId && !await db.ReferenceEntries.AnyAsync(x => x.Id == instituteId && x.Type == "institute" && x.IsPublished, ct))
				return ApiErrors.BadRequest("invalid_institute", "The selected institute does not exist.");
		}
		if (request.TryGetProperty("course", out var course))
		{
			profile.Course = course.ValueKind == JsonValueKind.Null ? null : course.GetInt32();
			if (profile.Course is < 1 or > 6) return ApiErrors.BadRequest("validation_failed", "Course must be between 1 and 6.");
		}
		if (request.TryGetProperty("studyGroup", out var studyGroup))
		{
			profile.StudyGroup = studyGroup.ValueKind == JsonValueKind.Null ? null : studyGroup.GetString();
			if (profile.StudyGroup?.Length > 64) return ApiErrors.BadRequest("validation_failed", "Study group is too long.");
		}
		if (request.TryGetProperty("skillIds", out var skills))
		{
			if (skills.ValueKind != JsonValueKind.Array) return ApiErrors.BadRequest("validation_failed", "skillIds must be an array.");
			profile.SkillIds = skills.EnumerateArray().Select(x => x.GetGuid().ToString()).Distinct().ToArray();
			var valid = await db.ReferenceEntries.CountAsync(x => x.Type == "competency" && profile.SkillIds.Contains(x.Id.ToString()), ct);
			if (valid != profile.SkillIds.Length) return ApiErrors.BadRequest("invalid_skill_ids", "One or more skills are not published reference entries.");
		}
		if (request.TryGetProperty("technologyIds", out var technologies))
		{
			if (technologies.ValueKind != JsonValueKind.Array) return ApiErrors.BadRequest("validation_failed", "technologyIds must be an array.");
			profile.TechnologyIds = technologies.EnumerateArray().Select(x => x.GetGuid().ToString()).Distinct().ToArray();
			var valid = await db.ReferenceEntries.CountAsync(x => x.Type == "technology" && profile.TechnologyIds.Contains(x.Id.ToString()), ct);
			if (valid != profile.TechnologyIds.Length) return ApiErrors.BadRequest("invalid_technology_ids", "One or more technologies are not published reference entries.");
		}
		if (request.TryGetProperty("achievements", out var achievements))
		{
			if (achievements.ValueKind != JsonValueKind.Array) return ApiErrors.BadRequest("validation_failed", "achievements must be an array.");
			if (achievements.GetArrayLength() > 50) return ApiErrors.BadRequest("validation_failed", "At most 50 achievements are allowed.");
			foreach (var achievement in achievements.EnumerateArray())
			{
				if (!achievement.TryGetProperty("title", out var title) || string.IsNullOrWhiteSpace(title.GetString()) || title.GetString()!.Length > 160)
					return ApiErrors.BadRequest("validation_failed", "Each achievement requires a title up to 160 characters.");
			}
			profile.Achievements = achievements.EnumerateArray().Select(x => x.GetRawText()).ToArray();
		}
		if (request.TryGetProperty("publicLinks", out var links))
		{
			if (links.ValueKind != JsonValueKind.Array) return ApiErrors.BadRequest("validation_failed", "publicLinks must be an array.");
			profile.PublicLinksJson = links.EnumerateArray().Select(x => x.GetRawText()).ToArray();
			foreach (var link in links.EnumerateArray())
			{
				if (!link.TryGetProperty("label", out var label) || string.IsNullOrWhiteSpace(label.GetString()) ||
					!link.TryGetProperty("url", out var url) || !Uri.TryCreate(url.GetString(), UriKind.Absolute, out var parsed) ||
					parsed.Scheme is not ("http" or "https"))
					return ApiErrors.BadRequest("validation_failed", "Public links must have a label and an HTTP(S) URL.");
			}
		}

		profile.Version++;
		profile.UpdatedAt = DateTimeOffset.UtcNow;
		try
		{
			await db.SaveChangesAsync(ct);
		}
		catch (DbUpdateConcurrencyException)
		{
			return ApiErrors.Conflict("version_conflict", "The profile was updated by another request.");
		}
		return Results.Ok(new
		{
			userId = user.Id, fullName = user.FullName, nickname = user.Nickname,
			avatarUrl = profile.AvatarObjectKey == null ? null : $"/api/v1/public/students/{user.Id}/avatar",
			achievements = profile.Achievements.Select(json => JsonSerializer.Deserialize<object>(json)), profile.Version, profile.InstituteId, profile.Course, profile.StudyGroup,
			profile.Description, profile.PublicSummary, profile.SkillIds, profile.TechnologyIds,
			publicLinks = profile.PublicLinksJson.Select(json => JsonSerializer.Deserialize<object>(json))
		});
	}

	private static async Task<IResult> GetPublic(Guid studentId, VitrinaDbContext db, CancellationToken ct)
	{
		var result = await db.Users.AsNoTracking()
			.Where(x => x.Id == studentId && !x.IsBlocked)
			.Join(db.StudentProfiles.AsNoTracking(), user => user.Id, profile => profile.UserId,
				(user, profile) => new
				{
					studentId = user.Id,
					nickname = user.Nickname,
					avatarUrl = profile.AvatarObjectKey == null ? null : $"/api/v1/public/students/{user.Id}/avatar",
					publicSummary = profile.PublicSummary,
					achievements = profile.Achievements.Select(json => JsonSerializer.Deserialize<object>(json)),
					skillIds = profile.SkillIds,
					technologyIds = profile.TechnologyIds,
					publicLinks = profile.PublicLinksJson.Select(json => System.Text.Json.JsonSerializer.Deserialize<object>(json))
				}).SingleOrDefaultAsync(ct);
		return result is null ? ApiErrors.NotFound() : Results.Ok(result);
	}

	private static async Task<IResult> GetCompanyView(
		Guid companyId, Guid studentId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		var membership = await db.CompanyMembers.AsNoTracking().SingleOrDefaultAsync(x => x.CompanyId == companyId && x.UserId == userId, ct);
		if (membership is null || !membership.Permissions.Contains("students.read"))
			return ApiErrors.Forbidden("company_access_denied", "You do not have permission to view student academic data.");

		var result = await db.Users.AsNoTracking()
			.Where(x => x.Id == studentId && !x.IsBlocked)
			.Join(db.StudentProfiles.AsNoTracking(), user => user.Id, profile => profile.UserId,
				(user, profile) => new
				{
					StudentId = user.Id, user.FullName, user.Nickname,
					PublicSummary = profile.PublicSummary, profile.Achievements,
					profile.SkillIds, profile.TechnologyIds, profile.PublicLinksJson,
					profile.AvatarObjectKey, profile.Course, profile.StudyGroup
				}).SingleOrDefaultAsync(ct);
		if (result is null) return ApiErrors.NotFound();
		return Results.Ok(new
		{
			publicProfile = new
			{
				studentId = result.StudentId, nickname = result.Nickname,
				avatarUrl = result.AvatarObjectKey == null ? null : $"/api/v1/public/students/{result.StudentId}/avatar",
				publicSummary = result.PublicSummary,
				achievements = result.Achievements.Select(json => JsonSerializer.Deserialize<object>(json)),
				skillIds = result.SkillIds, technologyIds = result.TechnologyIds,
				publicLinks = result.PublicLinksJson.Select(json => JsonSerializer.Deserialize<object>(json))
			},
			fullName = result.FullName, course = result.Course, studyGroup = result.StudyGroup
		});
	}

	private static async Task<IResult> GetReferenceData(VitrinaDbContext db, CancellationToken ct)
	{
		var entries = await db.ReferenceEntries.AsNoTracking().Where(x => x.IsPublished)
			.OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
		object Map(string type) => entries.Where(x => x.Type == type).Select(x => new { id = x.Id, name = x.Name }).ToArray();
		return Results.Ok(new
		{
			directions = Map("direction"), technologies = Map("technology"),
			competencies = Map("competency"), portfolioCategories = Map("portfolioCategory"),
			institutes = Map("institute")
		});
	}

	private static async Task<IResult> GetParticipations(
		int page, int pageSize, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		page = Math.Max(1, page);
		pageSize = Math.Clamp(pageSize == 0 ? 20 : pageSize, 1, 100);
		var query = from application in db.Applications.AsNoTracking()
			where application.ParticipantUserIds.Contains(userId)
			join project in db.Cases.AsNoTracking() on application.CaseId equals project.Id
			select new
			{
				caseId = project.Id, caseTitle = project.Title, caseStatus = project.Status,
				applicationId = application.Id, teamId = application.TeamId, format = application.Format,
				role = application.Format == "SOLO" ? "SOLO" : application.CreatedByUserId == userId ? "CAPTAIN" : "MEMBER",
				applicationStatus = application.Status, teamExecutionStatus = "ACTIVE"
			};
		var total = await query.CountAsync(ct);
		var items = await query.OrderByDescending(x => x.caseTitle).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
		return Results.Ok(new { items, page, pageSize, total });
	}

}

