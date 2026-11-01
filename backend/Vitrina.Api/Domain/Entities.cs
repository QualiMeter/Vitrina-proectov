namespace Vitrina.Api.Domain;

public sealed class UserAccount
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public string Email { get; set; } = "";
	public string PasswordHash { get; set; } = "";
	public string FullName { get; set; } = "";
	public string? Nickname { get; set; }
	public string[] GlobalRoles { get; set; } = ["STUDENT"];
	public string[] GlobalPermissions { get; set; } = [];
	public bool EmailConfirmed { get; set; }
	public bool IsBlocked { get; set; }
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public StudentProfile? StudentProfile { get; set; }
}

public sealed class UserSession
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid UserId { get; set; }
	public string TokenHash { get; set; } = "";
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset LastActivityAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset ExpiresAt { get; set; }
	public DateTimeOffset AbsoluteExpiresAt { get; set; }
	public DateTimeOffset? RevokedAt { get; set; }
}

public sealed class EmailToken
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid UserId { get; set; }
	public string TokenHash { get; set; } = "";
	public string Purpose { get; set; } = "";
	public DateTimeOffset ExpiresAt { get; set; }
	public DateTimeOffset? ConsumedAt { get; set; }
}

public sealed class Company
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public string Name { get; set; } = "";
	public string Description { get; set; } = "";
	public string ContactEmail { get; set; } = "";
	public Guid CreatedByUserId { get; set; }
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public List<CompanyMember> Members { get; set; } = [];
}

public sealed class CompanyMember
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CompanyId { get; set; }
	public Guid UserId { get; set; }
	public string Role { get; set; } = "OWNER";
	public string[] Permissions { get; set; } = ["companies.read", "companies.update", "companies.invite", "cases.manage"];
	public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CaseProject
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CompanyId { get; set; }
	public string Title { get; set; } = "";
	public string? Description { get; set; }
	public string Status { get; set; } = "DRAFT";
	public string? ParticipationFormat { get; set; }
	public string? AdmissionMode { get; set; }
	public DateTimeOffset? RegistrationDeadline { get; set; }
	public int? MinTeamSize { get; set; }
	public int? MaxTeamSize { get; set; }
	public int? MaxAdmittedTeams { get; set; }
	public int? MaxAdmittedSolo { get; set; }
	public int? TeamSelectionLimit { get; set; }
	public int? SoloSelectionLimit { get; set; }
	public bool IsFinalIntakeClosed { get; set; }
	public bool AllowSharedPlaces { get; set; }
	public int PrizePlaceCount { get; set; }
	public string[] NominationNames { get; set; } = [];
	public decimal? ScoreRangeMin { get; set; }
	public decimal? ScoreRangeMax { get; set; }
	public string? EvaluationStartIdempotencyKey { get; set; }
	public string? ResultsPublishIdempotencyKey { get; set; }
	public string? FinalIntakeIdempotencyKey { get; set; }
	public int Version { get; set; } = 1;
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class StudentProfile
{
	public Guid UserId { get; set; }
	public string? Description { get; set; }
	public string? PublicSummary { get; set; }
	public string? AvatarObjectKey { get; set; }
	public string[] SkillIds { get; set; } = [];
	public string[] TechnologyIds { get; set; } = [];
	public string[] Achievements { get; set; } = [];
	public Guid? InstituteId { get; set; }
	public int? Course { get; set; }
	public string? StudyGroup { get; set; }
	public string[] PublicLinksJson { get; set; } = [];
	public int Version { get; set; } = 1;
	public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CompanyInvitation
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CompanyId { get; set; }
	public string Email { get; set; } = "";
	public string Role { get; set; } = "MEMBER";
	public string TokenHash { get; set; } = "";
	public Guid InvitedByUserId { get; set; }
	public string Status { get; set; } = "PENDING";
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset ExpiresAt { get; set; }
	public DateTimeOffset? AcceptedAt { get; set; }
}

public sealed class ReferenceEntry
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public string Type { get; set; } = "";
	public string Name { get; set; } = "";
	public int SortOrder { get; set; }
	public bool IsPublished { get; set; } = true;
}

public sealed class AuditEntry
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid? ActorUserId { get; set; }
	public string Action { get; set; } = "";
	public string ResourceType { get; set; } = "";
	public Guid? ResourceId { get; set; }
	public string? DetailsJson { get; set; }
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CaseTeam
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public Guid CaptainUserId { get; set; }
	public string Name { get; set; } = "";
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
	public bool IsLocked { get; set; }
}

public sealed class CaseTeamMember
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid TeamId { get; set; }
	public Guid UserId { get; set; }
	public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CaseTeamInvitation
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid TeamId { get; set; }
	public Guid InviteeUserId { get; set; }
	public Guid InvitedByUserId { get; set; }
	public string Status { get; set; } = "PENDING";
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset ExpiresAt { get; set; }
	public DateTimeOffset? RespondedAt { get; set; }
}

public sealed class CaptainTransfer
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid TeamId { get; set; }
	public Guid FromUserId { get; set; }
	public Guid ToUserId { get; set; }
	public string Status { get; set; } = "PENDING";
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset? DecidedAt { get; set; }
}

public sealed class CaseApplication
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid PublicResultId { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public string Format { get; set; } = "SOLO";
	public Guid? TeamId { get; set; }
	public Guid? SoloApplicantUserId { get; set; }
	public Guid CreatedByUserId { get; set; }
	public string Status { get; set; } = "DRAFT";
	public string? CoverLetter { get; set; }
	public string? ProjectDescription { get; set; }
	public Guid[] ParticipantUserIds { get; set; } = [];
	public int Version { get; set; } = 1;
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset? SubmittedAt { get; set; }
	public DateTimeOffset? DecidedAt { get; set; }
	public string? NdaAcceptedVersion { get; set; }
	public Guid? NdaAcceptedByUserId { get; set; }
	public DateTimeOffset? NdaAcceptedAt { get; set; }
}

public sealed class CaseApplicationEvent
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid ApplicationId { get; set; }
	public string? FromStatus { get; set; }
	public string ToStatus { get; set; } = "";
	public Guid ActorUserId { get; set; }
	public string? Comment { get; set; }
	public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CaseParticipationHistory
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public Guid UserId { get; set; }
	public Guid ApplicationId { get; set; }
	public string State { get; set; } = "ACTIVE";
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}


public sealed class CaseStage
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public string Title { get; set; } = "";
	public string Kind { get; set; } = "WORK";
	public string? Description { get; set; }
	public string? Instructions { get; set; }
	public DateTimeOffset? AvailableFrom { get; set; }
	public int Sequence { get; set; }
	public int Version { get; set; } = 1;
	public bool IsPublished { get; set; }
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CaseCheckpoint
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public Guid StageId { get; set; }
	public string Title { get; set; } = "";
	public string? Description { get; set; }
	public string? Instructions { get; set; }
	public string Kind { get; set; } = "REGULAR";
	public DateTimeOffset? Deadline { get; set; }
	public int? TeamSelectionLimit { get; set; }
	public int? SoloSelectionLimit { get; set; }
	public bool IsIntakeClosed { get; set; }
	public DateTimeOffset? ClosedAt { get; set; }
	public bool IsSelectionCompleted { get; set; }
	public DateTimeOffset? SelectionCompletedAt { get; set; }
	public string? SelectionIdempotencyKey { get; set; }
	public Guid[] PassingTeamIds { get; set; } = [];
	public Guid[] PassingSoloApplicationIds { get; set; } = [];
	public int Version { get; set; } = 1;
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class SubmissionVersion
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CheckpointId { get; set; }
	public Guid CaseId { get; set; }
	public Guid ApplicationId { get; set; }
	public int Version { get; set; }
	public Guid SubmittedByUserId { get; set; }
	public string? Description { get; set; }
	public string LinksJson { get; set; } = "[]";
	public Guid[] FileIds { get; set; } = [];
	public bool IsLate { get; set; }
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class StoredFile
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid OwnerUserId { get; set; }
	public Guid? CaseId { get; set; }
	public Guid? StageId { get; set; }
	public Guid? CheckpointId { get; set; }
	public Guid? ApplicationId { get; set; }
	public string Purpose { get; set; } = "";
	public string ObjectKey { get; set; } = "";
	public string OriginalFileName { get; set; } = "";
	public string ContentType { get; set; } = "application/octet-stream";
	public long Size { get; set; }
	public string Sha256 { get; set; } = "";
	public string Status { get; set; } = "READY";
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class NdaPolicy
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public string Version { get; set; } = "1";
	public string Text { get; set; } = "";
	public bool IsRequired { get; set; }
	public string? IdempotencyKey { get; set; }
	public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}


public sealed class NdaPolicyVersion
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public string Version { get; set; } = "1";
	public string Text { get; set; } = "";
	public bool IsRequired { get; set; }
	public Guid CreatedByUserId { get; set; }
	public string? IdempotencyKey { get; set; }
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class NdaAcceptance
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public Guid ApplicationId { get; set; }
	public Guid UserId { get; set; }
	public string Version { get; set; } = "";
	public DateTimeOffset AcceptedAt { get; set; } = DateTimeOffset.UtcNow;
	public string? RequestIp { get; set; }
}

public sealed class SubmissionIdempotency
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid UserId { get; set; }
	public Guid CheckpointId { get; set; }
	public string Key { get; set; } = "";
	public Guid SubmissionId { get; set; }
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class TeamExecutionExclusion
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid TeamId { get; set; }
	public Guid CaseId { get; set; }
	public Guid ExcludedByUserId { get; set; }
	public string Reason { get; set; } = "";
	public string IdempotencyKey { get; set; } = "";
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}


public sealed class CaseAward
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public Guid ApplicationId { get; set; }
	public string Category { get; set; } = "PLACE";
	public string Title { get; set; } = "";
	public int? Rank { get; set; }
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CaseResultPublication
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public int Version { get; set; } = 1;
	public string Status { get; set; } = "DRAFT";
	public Guid? PublishedByUserId { get; set; }
	public DateTimeOffset? PublishedAt { get; set; }
	public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}


public sealed class ApplicationReview
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid CaseId { get; set; }
	public Guid ApplicationId { get; set; }
	public Guid UpdatedByUserId { get; set; }
	public string Feedback { get; set; } = "";
	public decimal? Score { get; set; }
	public int Version { get; set; } = 1;
	public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class ApplicationReviewRevision
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid ReviewId { get; set; }
	public Guid CaseId { get; set; }
	public Guid ApplicationId { get; set; }
	public Guid ActorUserId { get; set; }
	public string Feedback { get; set; } = "";
	public decimal? Score { get; set; }
	public int Version { get; set; }
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}


public sealed class UserNotification
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public Guid UserId { get; set; }
	public string Type { get; set; } = "GENERAL";
	public string Title { get; set; } = "";
	public string Body { get; set; } = "";
	public string? ResourceType { get; set; }
	public Guid? ResourceId { get; set; }
	public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset? ReadAt { get; set; }
}

public sealed class OutboxMessage
{
	public Guid Id { get; set; } = Guid.NewGuid();
	public string Type { get; set; } = "";
	public string PayloadJson { get; set; } = "{}";
	public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;
	public DateTimeOffset? AvailableAt { get; set; }
	public DateTimeOffset? LockedAt { get; set; }
	public string? LockOwner { get; set; }
	public DateTimeOffset? ProcessedAt { get; set; }
	public int Attempts { get; set; }
	public string? LastError { get; set; }
}
