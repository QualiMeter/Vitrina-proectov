BEGIN;

ALTER TABLE "Applications"
    ADD COLUMN IF NOT EXISTS "PublicResultId" uuid;
UPDATE "Applications" SET "PublicResultId" = gen_random_uuid() WHERE "PublicResultId" IS NULL;
ALTER TABLE "Applications" ALTER COLUMN "PublicResultId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Applications_PublicResultId" ON "Applications" ("PublicResultId");

ALTER TABLE "Cases"
    ADD COLUMN IF NOT EXISTS "AllowSharedPlaces" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "PrizePlaceCount" integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "NominationNames" text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "ScoreRangeMin" numeric,
    ADD COLUMN IF NOT EXISTS "ScoreRangeMax" numeric,
    ADD COLUMN IF NOT EXISTS "EvaluationStartIdempotencyKey" text,
    ADD COLUMN IF NOT EXISTS "ResultsPublishIdempotencyKey" text;

-- Stage 3 used a unique index for the former single-award representation.
-- Stage 4 allows multiple nominations per application, so this index is non-unique.
DROP INDEX IF EXISTS "IX_CaseAwards_CaseId_ApplicationId_Category";

CREATE TABLE IF NOT EXISTS "CaseAwards" (
    "Id" uuid PRIMARY KEY,
    "CaseId" uuid NOT NULL REFERENCES "Cases"("Id") ON DELETE CASCADE,
    "ApplicationId" uuid NOT NULL REFERENCES "Applications"("Id") ON DELETE RESTRICT,
    "Category" text NOT NULL,
    "Title" text NOT NULL,
    "Rank" integer,
    "CreatedAt" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_CaseAwards_CaseId_ApplicationId_Category"
    ON "CaseAwards" ("CaseId", "ApplicationId", "Category");

CREATE TABLE IF NOT EXISTS "CaseResultPublications" (
    "Id" uuid PRIMARY KEY,
    "CaseId" uuid NOT NULL REFERENCES "Cases"("Id") ON DELETE CASCADE,
    "Version" integer NOT NULL DEFAULT 1,
    "Status" text NOT NULL DEFAULT 'DRAFT',
    "PublishedByUserId" uuid,
    "PublishedAt" timestamp with time zone,
    "UpdatedAt" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_CaseResultPublications_CaseId"
    ON "CaseResultPublications" ("CaseId");

CREATE TABLE IF NOT EXISTS "ApplicationReviews" (
    "Id" uuid PRIMARY KEY,
    "CaseId" uuid NOT NULL REFERENCES "Cases"("Id") ON DELETE CASCADE,
    "ApplicationId" uuid NOT NULL REFERENCES "Applications"("Id") ON DELETE CASCADE,
    "UpdatedByUserId" uuid NOT NULL,
    "Feedback" text NOT NULL,
    "Score" numeric,
    "Version" integer NOT NULL DEFAULT 1,
    "UpdatedAt" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_ApplicationReviews_ApplicationId"
    ON "ApplicationReviews" ("ApplicationId");

CREATE TABLE IF NOT EXISTS "ApplicationReviewRevisions" (
    "Id" uuid PRIMARY KEY,
    "ReviewId" uuid NOT NULL REFERENCES "ApplicationReviews"("Id") ON DELETE RESTRICT,
    "CaseId" uuid NOT NULL,
    "ApplicationId" uuid NOT NULL,
    "ActorUserId" uuid NOT NULL,
    "Feedback" text NOT NULL,
    "Score" numeric,
    "Version" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_ApplicationReviewRevisions_ReviewId_Version"
    ON "ApplicationReviewRevisions" ("ReviewId", "Version");

COMMIT;
