ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PrivacyAcceptedAt" timestamp with time zone NULL;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PrivacyPolicyVersion" character varying(40) NULL;
