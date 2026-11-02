using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Teams;

public static class TeamEndpoints
{
	public static IEndpointRouteBuilder MapTeamEndpoints(this IEndpointRouteBuilder app)
	{
		var api = app.MapGroup("/api/v1").WithTags("Teams");
		api.MapPost("/cases/{caseId:guid}/teams", Create);
		api.MapGet("/cases/{caseId:guid}/teams/mine", Mine);
		api.MapGet("/teams/{teamId:guid}", Get);
		api.MapPost("/teams/{teamId:guid}/invitations", Invite);
		api.MapDelete("/teams/{teamId:guid}/members/{memberUserId:guid}", RemoveMember);
		api.MapGet("/me/team-invitations", MyInvitations);
		api.MapGet("/teams/{teamId:guid}/invite-candidates", Candidates);
		api.MapPost("/team-invitations/{invitationId:guid}/accept", Accept);
		api.MapPost("/team-invitations/{invitationId:guid}/decline", Decline);
		api.MapPost("/team-invitations/{invitationId:guid}/revoke", Revoke);
		api.MapPost("/teams/{teamId:guid}/captain-transfer", RequestTransfer);
		api.MapPost("/teams/{teamId:guid}/captain-transfer/{transferId:guid}/decision", DecideTransfer);
		return app;
	}

	private static async Task<IResult> Create(Guid caseId, CreateTeamRequest request, CurrentUser current,
		VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var project = await db.Cases.SingleOrDefaultAsync(x => x.Id == caseId, ct);
		if (project is null) return ApiErrors.NotFound();
		if (project.Status != "REGISTRATION_OPEN" || project.RegistrationDeadline <= DateTimeOffset.UtcNow)
			return ApiErrors.Conflict("registration_closed", "Registration is not open.");
		if (project.ParticipationFormat == "SOLO") return ApiErrors.Conflict("team_not_allowed", "This case only accepts solo applications.");
		if (await db.TeamMembers.AnyAsync(x => x.UserId == userId && db.Teams.Any(t => t.Id == x.TeamId && t.CaseId == caseId), ct))
			return ApiErrors.Conflict("already_in_case_team", "You already belong to a team for this case.");
		if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 120)
			return ApiErrors.BadRequest("validation_failed", "Team name is required and must be at most 120 characters.");

		var team = new CaseTeam { CaseId = caseId, CaptainUserId = userId, Name = request.Name.Trim() };
		db.Teams.Add(team);
		db.TeamMembers.Add(new CaseTeamMember { TeamId = team.Id, UserId = userId });
		await db.SaveChangesAsync(ct);
		return Results.Created($"/api/v1/teams/{team.Id}", await TeamDto(db, team.Id, ct));
	}

	private static async Task<IResult> Mine(Guid caseId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var ids = await db.TeamMembers.Where(x => x.UserId == userId)
			.Join(db.Teams.Where(x => x.CaseId == caseId), m => m.TeamId, t => t.Id, (m, t) => t.Id).ToListAsync(ct);
		var items = new List<object>();
		foreach (var id in ids) items.Add(await TeamDto(db, id, ct));
		return Results.Ok(new { items });
	}

	private static async Task<IResult> Get(Guid teamId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var team = await db.Teams.AsNoTracking().SingleOrDefaultAsync(x => x.Id == teamId, ct);
		if (team is null) return ApiErrors.NotFound();
		var isMember = await db.TeamMembers.AnyAsync(x => x.TeamId == teamId && x.UserId == userId, ct);
		if (!isMember && team.CaptainUserId != userId) return ApiErrors.Forbidden("team_access_denied", "You are not a team member.");
		return Results.Ok(await TeamDto(db, teamId, ct));
	}

	private static async Task<IResult> Invite(Guid teamId, InviteTeamRequest request, CurrentUser current,
		VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var team = await db.Teams.SingleOrDefaultAsync(x => x.Id == teamId, ct);
		if (team is null) return ApiErrors.NotFound();
		if (team.CaptainUserId != userId) return ApiErrors.Forbidden("captain_required", "Only the captain can invite members.");
		if (team.IsLocked || await HasSubmittedApplication(db, teamId, ct)) return ApiErrors.Conflict("team_locked", "Team composition is locked after submission.");
		var project = await db.Cases.SingleAsync(x => x.Id == team.CaseId, ct);
		if (project.Status != "REGISTRATION_OPEN" || project.RegistrationDeadline <= DateTimeOffset.UtcNow)
			return ApiErrors.Conflict("registration_closed", "Invitations are unavailable while registration is closed.");
		if (request.UserId == userId || !await db.Users.AnyAsync(x => x.Id == request.UserId && x.EmailConfirmed && !x.IsBlocked, ct))
			return ApiErrors.BadRequest("invitee_unavailable", "The invited account is unavailable.");
		if (await db.TeamMembers.AnyAsync(x => x.UserId == request.UserId && db.Teams.Any(t => t.Id == x.TeamId && t.CaseId == team.CaseId), ct))
			return ApiErrors.Conflict("already_in_case_team", "The student already belongs to a team for this case.");
		var pending = await db.TeamInvitations.AnyAsync(x => x.TeamId == teamId && x.InviteeUserId == request.UserId && x.Status == "PENDING" && x.ExpiresAt > DateTimeOffset.UtcNow, ct);
		if (pending) return ApiErrors.Conflict("invitation_exists", "An active invitation already exists.");
		var invitation = new CaseTeamInvitation { TeamId = teamId, InviteeUserId = request.UserId, InvitedByUserId = userId, ExpiresAt = DateTimeOffset.UtcNow.AddDays(7) };
		db.TeamInvitations.Add(invitation);
		await db.SaveChangesAsync(ct);
		return Results.Created($"/api/v1/team-invitations/{invitation.Id}", invitation);
	}

	private static async Task<IResult> RemoveMember(Guid teamId, Guid memberUserId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var team = await db.Teams.SingleOrDefaultAsync(x => x.Id == teamId, ct);
		if (team is null) return ApiErrors.NotFound();
		if (team.IsLocked || await HasSubmittedApplication(db, teamId, ct)) return ApiErrors.Conflict("team_locked", "Team composition is locked.");
		if (userId != team.CaptainUserId && userId != memberUserId) return ApiErrors.Forbidden("team_member_removal_forbidden", "Only the captain or the member can remove this membership.");
		if (memberUserId == team.CaptainUserId) return ApiErrors.Conflict("captain_transfer_required", "Captain must transfer captaincy before leaving.");
		var member = await db.TeamMembers.SingleOrDefaultAsync(x => x.TeamId == teamId && x.UserId == memberUserId, ct);
		if (member is null) return ApiErrors.NotFound();
		db.TeamMembers.Remove(member);
		await db.SaveChangesAsync(ct);
		return Results.NoContent();
	}

	private static async Task<IResult> MyInvitations(CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var items = await db.TeamInvitations.AsNoTracking().Where(x => x.InviteeUserId == userId && x.Status == "PENDING" && x.ExpiresAt > DateTimeOffset.UtcNow)
			.Join(db.Teams, i => i.TeamId, t => t.Id, (i, t) => new { invitation = i, team = t })
			.Join(db.Cases, x => x.team.CaseId, c => c.Id, (x, c) => new { x.invitation, x.team, @case = c })
			.Select(x => new { invitationId = x.invitation.Id, x.invitation.ExpiresAt, teamId = x.team.Id, teamName = x.team.Name, caseId = x.@case.Id, caseTitle = x.@case.Title, x.team.CaptainUserId })
			.ToListAsync(ct);
		return Results.Ok(new { items });
	}

	private static async Task<IResult> Candidates(Guid teamId, string? search, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var team = await db.Teams.AsNoTracking().SingleOrDefaultAsync(x => x.Id == teamId, ct);
		if (team is null) return ApiErrors.NotFound();
		if (team.CaptainUserId != userId) return ApiErrors.Forbidden("captain_required", "Only the captain can search invite candidates.");
		var query = db.Users.AsNoTracking().Where(x => x.EmailConfirmed && !x.IsBlocked && x.Id != userId);
		if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.FullName.ToLower().Contains(search.Trim().ToLower()) || (x.Nickname != null && x.Nickname.ToLower().Contains(search.Trim().ToLower())));
		var items = await query.OrderBy(x => x.FullName).Take(20).Select(x => new { userId = x.Id, x.FullName, x.Nickname }).ToListAsync(ct);
		return Results.Ok(new { items });
	}

	private static Task<IResult> Accept(Guid invitationId, CurrentUser current, VitrinaDbContext db, CancellationToken ct) => Respond(invitationId, "ACCEPTED", current, db, ct);
	private static Task<IResult> Decline(Guid invitationId, CurrentUser current, VitrinaDbContext db, CancellationToken ct) => Respond(invitationId, "DECLINED", current, db, ct);
	private static async Task<IResult> Respond(Guid invitationId, string status, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		await using var tx = await db.Database.BeginTransactionAsync(ct);
		var invitation = await db.TeamInvitations.SingleOrDefaultAsync(x => x.Id == invitationId, ct);
		if (invitation is null || invitation.InviteeUserId != userId) return ApiErrors.NotFound();
		var team = await db.Teams.SingleAsync(x => x.Id == invitation.TeamId, ct);
		var project = await db.Cases.SingleAsync(x => x.Id == team.CaseId, ct);
		if (invitation.Status != "PENDING" || invitation.ExpiresAt <= DateTimeOffset.UtcNow || project.Status != "REGISTRATION_OPEN" || project.RegistrationDeadline <= DateTimeOffset.UtcNow || await HasSubmittedApplication(db, team.Id, ct))
			return ApiErrors.Conflict("invitation_expired", "The invitation is no longer valid.");
		if (status == "ACCEPTED")
		{
			if (await db.TeamMembers.AnyAsync(x => x.UserId == userId && db.Teams.Any(t => t.Id == x.TeamId && t.CaseId == team.CaseId), ct))
				return ApiErrors.Conflict("already_in_case_team", "You already belong to a team for this case.");
			var count = await db.TeamMembers.CountAsync(x => x.TeamId == team.Id, ct);
			if (project.MaxTeamSize is int max && count >= max) return ApiErrors.Conflict("team_full", "The team has reached its maximum size.");
			db.TeamMembers.Add(new CaseTeamMember { TeamId = team.Id, UserId = userId });
		}
		invitation.Status = status;
		invitation.RespondedAt = DateTimeOffset.UtcNow;
		await db.SaveChangesAsync(ct);
		await tx.CommitAsync(ct);
		return Results.Ok(new { invitationId, status });
	}

	private static async Task<IResult> Revoke(Guid invitationId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var invitation = await db.TeamInvitations.SingleOrDefaultAsync(x => x.Id == invitationId, ct);
		if (invitation is null) return ApiErrors.NotFound();
		var team = await db.Teams.SingleAsync(x => x.Id == invitation.TeamId, ct);
		if (team.CaptainUserId != userId) return ApiErrors.Forbidden("captain_required", "Only the captain can revoke invitations.");
		if (invitation.Status != "PENDING") return ApiErrors.Conflict("invitation_not_pending", "Invitation is no longer pending.");
		invitation.Status = "REVOKED";
		invitation.RespondedAt = DateTimeOffset.UtcNow;
		await db.SaveChangesAsync(ct);
		return Results.Ok(new { invitationId, status = invitation.Status });
	}

	private static async Task<IResult> RequestTransfer(Guid teamId, CaptainTransferRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var team = await db.Teams.SingleOrDefaultAsync(x => x.Id == teamId, ct);
		if (team is null) return ApiErrors.NotFound();
		if (team.CaptainUserId != userId) return ApiErrors.Forbidden("captain_required", "Only the current captain can request transfer.");
		if (team.IsLocked || await HasSubmittedApplication(db, teamId, ct)) return ApiErrors.Conflict("team_locked", "Captain transfer is disabled after application submission.");
		if (request.NewCaptainUserId == userId || !await db.TeamMembers.AnyAsync(x => x.TeamId == teamId && x.UserId == request.NewCaptainUserId, ct))
			return ApiErrors.BadRequest("invalid_new_captain", "The new captain must be an existing team member.");
		var existing = await db.CaptainTransfers.AnyAsync(x => x.TeamId == teamId && x.Status == "PENDING", ct);
		if (existing) return ApiErrors.Conflict("transfer_pending", "A captain transfer is already pending.");
		var transfer = new CaptainTransfer { TeamId = teamId, FromUserId = userId, ToUserId = request.NewCaptainUserId };
		db.CaptainTransfers.Add(transfer);
		await db.SaveChangesAsync(ct);
		return Results.Created($"/api/v1/teams/{teamId}/captain-transfer/{transfer.Id}", transfer);
	}

	private static async Task<IResult> DecideTransfer(Guid teamId, Guid transferId, CaptainTransferDecision request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var transfer = await db.CaptainTransfers.SingleOrDefaultAsync(x => x.Id == transferId && x.TeamId == teamId, ct);
		if (transfer is null || transfer.ToUserId != userId) return ApiErrors.NotFound();
		if (transfer.Status != "PENDING") return ApiErrors.Conflict("transfer_not_pending", "Transfer is no longer pending.");
		var team = await db.Teams.SingleAsync(x => x.Id == teamId, ct);
		if (team.CaptainUserId != transfer.FromUserId) return ApiErrors.Conflict("captain_changed", "The current captain has changed.");
		transfer.Status = request.Action == "CONFIRM" ? "CONFIRMED" : "DECLINED";
		transfer.DecidedAt = DateTimeOffset.UtcNow;
		if (request.Action == "CONFIRM") team.CaptainUserId = userId;
		else if (request.Action != "DECLINE") return ApiErrors.BadRequest("invalid_action", "Action must be CONFIRM or DECLINE.");
		await db.SaveChangesAsync(ct);
		return Results.Ok(new { transferId, status = transfer.Status, team.CaptainUserId });
	}

	private static async Task<bool> HasSubmittedApplication(VitrinaDbContext db, Guid teamId, CancellationToken ct) =>
		await db.Applications.AnyAsync(x => x.TeamId == teamId && x.Status != "DRAFT", ct);

	private static async Task<object> TeamDto(VitrinaDbContext db, Guid teamId, CancellationToken ct)
	{
		var team = await db.Teams.AsNoTracking().SingleAsync(x => x.Id == teamId, ct);
		var members = await db.TeamMembers.AsNoTracking().Where(x => x.TeamId == teamId)
			.Join(db.Users, m => m.UserId, u => u.Id, (m, u) => new { userId = u.Id, u.FullName, u.Nickname, m.JoinedAt }).ToListAsync(ct);
		return new { teamId = team.Id, caseId = team.CaseId, team.CaptainUserId, team.Name, team.IsLocked, members };
	}
}

public sealed record CreateTeamRequest(string Name);
public sealed record InviteTeamRequest(Guid UserId);
public sealed record CaptainTransferRequest(Guid NewCaptainUserId);
public sealed record CaptainTransferDecision(string Action);
