CREATE TABLE IF NOT EXISTS "Notifications" (
    "Id" uuid PRIMARY KEY,
    "UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "Type" varchar(80) NOT NULL,
    "Title" varchar(240) NOT NULL,
    "Body" varchar(2000) NOT NULL,
    "ResourceType" varchar(80),
    "ResourceId" uuid,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ReadAt" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "IX_Notifications_UserId_CreatedAt" ON "Notifications" ("UserId", "CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS "IX_Notifications_UserId_ReadAt" ON "Notifications" ("UserId", "ReadAt");

CREATE TABLE IF NOT EXISTS "OutboxMessages" (
    "Id" uuid PRIMARY KEY,
    "Type" varchar(120) NOT NULL,
    "PayloadJson" jsonb NOT NULL,
    "OccurredAt" timestamp with time zone NOT NULL,
    "AvailableAt" timestamp with time zone,
    "LockedAt" timestamp with time zone,
    "LockOwner" varchar(200),
    "ProcessedAt" timestamp with time zone,
    "Attempts" integer NOT NULL DEFAULT 0,
    "LastError" varchar(2000)
);
CREATE INDEX IF NOT EXISTS "IX_OutboxMessages_ProcessedAt_AvailableAt_OccurredAt"
    ON "OutboxMessages" ("ProcessedAt", "AvailableAt", "OccurredAt");

