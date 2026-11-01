BEGIN;

ALTER TABLE "Cases"
	ADD COLUMN IF NOT EXISTS "TeamSelectionLimit" integer,
	ADD COLUMN IF NOT EXISTS "SoloSelectionLimit" integer,
	ADD COLUMN IF NOT EXISTS "IsFinalIntakeClosed" boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS "FinalIntakeIdempotencyKey" text;

ALTER TABLE "Applications"
	ADD COLUMN IF NOT EXISTS "NdaAcceptedVersion" text,
	ADD COLUMN IF NOT EXISTS "NdaAcceptedByUserId" uuid,
	ADD COLUMN IF NOT EXISTS "NdaAcceptedAt" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "CaseStages" (
	"Id" uuid PRIMARY KEY,
	"CaseId" uuid NOT NULL REFERENCES "Cases"("Id") ON DELETE CASCADE,
	"Title" text NOT NULL,
	"Kind" text NOT NULL DEFAULT 'WORK',
	"Description" text,
	"Instructions" text,
	"AvailableFrom" timestamp with time zone,
	"Sequence" integer NOT NULL,
	"Version" integer NOT NULL DEFAULT 1,
	"IsPublished" boolean NOT NULL DEFAULT false,
	"CreatedAt" timestamp with time zone NOT NULL,
	"UpdatedAt" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_CaseStages_CaseId_Sequence" ON "CaseStages" ("CaseId", "Sequence");

CREATE TABLE IF NOT EXISTS "CaseCheckpoints" (
	"Id" uuid PRIMARY KEY,
	"CaseId" uuid NOT NULL REFERENCES "Cases"("Id") ON DELETE CASCADE,
	"StageId" uuid NOT NULL REFERENCES "CaseStages"("Id") ON DELETE CASCADE,
	"Title" text NOT NULL,
	"Description" text,
	"Instructions" text,
	"Kind" text NOT NULL,
	"Deadline" timestamp with time zone,
	"TeamSelectionLimit" integer,
	"SoloSelectionLimit" integer,
	"IsIntakeClosed" boolean NOT NULL DEFAULT false,
	"ClosedAt" timestamp with time zone,
	"IsSelectionCompleted" boolean NOT NULL DEFAULT false,
	"SelectionCompletedAt" timestamp with time zone,
	"SelectionIdempotencyKey" text,
	"PassingTeamIds" uuid[] NOT NULL DEFAULT '{}',
	"PassingSoloApplicationIds" uuid[] NOT NULL DEFAULT '{}',
	"Version" integer NOT NULL DEFAULT 1,
	"CreatedAt" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_CaseCheckpoints_StageId_Title" ON "CaseCheckpoints" ("StageId", "Title");
CREATE INDEX IF NOT EXISTS "IX_CaseCheckpoints_CaseId" ON "CaseCheckpoints" ("CaseId");

CREATE TABLE IF NOT EXISTS "SubmissionVersions" (
	"Id" uuid PRIMARY KEY,
	"CheckpointId" uuid NOT NULL REFERENCES "CaseCheckpoints"("Id") ON DELETE RESTRICT,
	"CaseId" uuid NOT NULL REFERENCES "Cases"("Id") ON DELETE RESTRICT,
	"ApplicationId" uuid NOT NULL REFERENCES "Applications"("Id") ON DELETE RESTRICT,
	"Version" integer NOT NULL,
	"SubmittedByUserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
	"Description" text,
	"LinksJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"FileIds" uuid[] NOT NULL DEFAULT '{}',
	"IsLate" boolean NOT NULL DEFAULT false,
	"CreatedAt" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_SubmissionVersions_CheckpointId_ApplicationId_Version" ON "SubmissionVersions" ("CheckpointId", "ApplicationId", "Version");
CREATE INDEX IF NOT EXISTS "IX_SubmissionVersions_CaseId" ON "SubmissionVersions" ("CaseId");

CREATE TABLE IF NOT EXISTS "StoredFiles" (
	"Id" uuid PRIMARY KEY,
	"OwnerUserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
	"CaseId" uuid REFERENCES "Cases"("Id") ON DELETE RESTRICT,
	"StageId" uuid REFERENCES "CaseStages"("Id") ON DELETE RESTRICT,
	"CheckpointId" uuid REFERENCES "CaseCheckpoints"("Id") ON DELETE RESTRICT,
	"ApplicationId" uuid REFERENCES "Applications"("Id") ON DELETE RESTRICT,
	"Purpose" text NOT NULL,
	"ObjectKey" text NOT NULL,
	"OriginalFileName" text NOT NULL,
	"ContentType" text NOT NULL,
	"Size" bigint NOT NULL,
	"Sha256" text NOT NULL,
	"Status" text NOT NULL,
	"CreatedAt" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_StoredFiles_ObjectKey" ON "StoredFiles" ("ObjectKey");
CREATE INDEX IF NOT EXISTS "IX_StoredFiles_ApplicationId_Purpose" ON "StoredFiles" ("ApplicationId", "Purpose");
CREATE INDEX IF NOT EXISTS "IX_StoredFiles_CaseId_StageId_Status" ON "StoredFiles" ("CaseId", "StageId", "Status");

CREATE TABLE IF NOT EXISTS "NdaPolicies" (
	"Id" uuid PRIMARY KEY,
	"CaseId" uuid NOT NULL REFERENCES "Cases"("Id") ON DELETE CASCADE,
	"Version" text NOT NULL,
	"Text" text NOT NULL,
	"IsRequired" boolean NOT NULL DEFAULT false,
	"IdempotencyKey" text,
	"UpdatedAt" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_NdaPolicies_CaseId" ON "NdaPolicies" ("CaseId");

CREATE TABLE IF NOT EXISTS "NdaPolicyVersions" (
	"Id" uuid PRIMARY KEY,
	"CaseId" uuid NOT NULL REFERENCES "Cases"("Id") ON DELETE RESTRICT,
	"Version" text NOT NULL,
	"Text" text NOT NULL,
	"IsRequired" boolean NOT NULL,
	"CreatedByUserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
	"IdempotencyKey" text,
	"CreatedAt" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_NdaPolicyVersions_CaseId_Version" ON "NdaPolicyVersions" ("CaseId", "Version");

CREATE TABLE IF NOT EXISTS "NdaAcceptances" (
	"Id" uuid PRIMARY KEY,
	"CaseId" uuid NOT NULL REFERENCES "Cases"("Id") ON DELETE RESTRICT,
	"ApplicationId" uuid NOT NULL REFERENCES "Applications"("Id") ON DELETE RESTRICT,
	"UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
	"Version" text NOT NULL,
	"AcceptedAt" timestamp with time zone NOT NULL,
	"RequestIp" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_NdaAcceptances_ApplicationId_UserId_Version" ON "NdaAcceptances" ("ApplicationId", "UserId", "Version");

CREATE TABLE IF NOT EXISTS "SubmissionIdempotencies" (
	"Id" uuid PRIMARY KEY,
	"UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
	"CheckpointId" uuid NOT NULL REFERENCES "CaseCheckpoints"("Id") ON DELETE RESTRICT,
	"Key" text NOT NULL,
	"SubmissionId" uuid NOT NULL,
	"CreatedAt" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_SubmissionIdempotencies_UserId_CheckpointId_Key" ON "SubmissionIdempotencies" ("UserId", "CheckpointId", "Key");

CREATE TABLE IF NOT EXISTS "TeamExecutionExclusions" (
	"Id" uuid PRIMARY KEY,
	"TeamId" uuid NOT NULL REFERENCES "Teams"("Id") ON DELETE RESTRICT,
	"CaseId" uuid NOT NULL REFERENCES "Cases"("Id") ON DELETE RESTRICT,
	"ExcludedByUserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
	"Reason" text NOT NULL,
	"IdempotencyKey" text NOT NULL,
	"CreatedAt" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_TeamExecutionExclusions_TeamId" ON "TeamExecutionExclusions" ("TeamId");
CREATE INDEX IF NOT EXISTS "IX_TeamExecutionExclusions_CaseId" ON "TeamExecutionExclusions" ("CaseId");

COMMIT;
