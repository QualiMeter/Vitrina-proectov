using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Vitrina.Api.Data;

namespace Vitrina.Api.Data.Migrations;

[DbContext(typeof(VitrinaDbContext))]
[Migration("202611020001_RegistrationPrivacyConsent")]
public sealed class RegistrationPrivacyConsent : Migration
{
	protected override void Up(MigrationBuilder migrationBuilder)
	{
		migrationBuilder.Sql(ReadSql());
	}

	protected override void Down(MigrationBuilder migrationBuilder)
	{
		// Consent records are retained for auditability; rollback does not erase them.
	}

	private static string ReadSql()
	{
		var assembly = typeof(RegistrationPrivacyConsent).Assembly;
		using var stream = assembly.GetManifestResourceStream(
			"Vitrina.Api.Data.Migrations.007_registration_privacy_consent.sql")
			?? throw new InvalidOperationException("Registration privacy consent migration resource was not found.");
		using var reader = new StreamReader(stream);
		return reader.ReadToEnd();
	}
}
