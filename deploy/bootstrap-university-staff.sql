-- Run only after the account has registered and confirmed its email.
-- Replace the email with the exact account address.
UPDATE "Users"
SET
    "GlobalRoles" = ARRAY['STUDENT', 'UNIVERSITY_STAFF']::text[],
    "GlobalPermissions" = ARRAY[
        'companies.create',
        'companies.listAll',
        'companies.readPrivate',
        'companies.invite',
        'cases.manage'
    ]::text[]
WHERE lower("Email") = lower('replace-with-admin@example.com');

-- Verify exactly one row was updated and then sign out/in to refresh the client profile.
