using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Vitrina.Api.Data;

namespace Vitrina.Api.Data.Migrations;

[DbContext(typeof(VitrinaDbContext))]
[Migration("202611010002_CaseAwardsPublications")]
public sealed class CaseAwardsPublications : Migration
{
	protected override void Up(MigrationBuilder migrationBuilder)
	{
		migrationBuilder.Sql(ReadSql());
	}

	protected override void Down(MigrationBuilder migrationBuilder)
	{
		// These tables may have been created by the initial EF model bootstrap.
		// Keep them on rollback to avoid deleting already stored evaluation results.
	}

	private static string ReadSql()
	{
		var assembly = typeof(CaseAwardsPublications).Assembly;
		using var stream = assembly.GetManifestResourceStream(
			"Vitrina.Api.Data.Migrations.006_case_awards_publications.sql")
			?? throw new InvalidOperationException("Stage 5.1 SQL migration resource was not found.");
		using var reader = new StreamReader(stream);
		return reader.ReadToEnd();
	}
}
