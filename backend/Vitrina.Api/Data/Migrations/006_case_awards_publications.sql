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
