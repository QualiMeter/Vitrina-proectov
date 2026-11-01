using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Vitrina.Api.Data;

namespace Vitrina.Api.Data.Migrations;

[DbContext(typeof(VitrinaDbContext))]
[Migration("202611010001_Stage5NotificationsOutbox")]
public sealed class Stage5NotificationsOutbox : Migration
{
	protected override void Up(MigrationBuilder migrationBuilder)
	{
		migrationBuilder.Sql(ReadSql());
	}

	protected override void Down(MigrationBuilder migrationBuilder)
	{
		migrationBuilder.Sql("DROP TABLE IF EXISTS \"OutboxMessages\"; DROP TABLE IF EXISTS \"Notifications\";");
	}

	private static string ReadSql()
	{
		var assembly = typeof(Stage5NotificationsOutbox).Assembly;
		using var stream = assembly.GetManifestResourceStream(
			"Vitrina.Api.Data.Migrations.005_stage5_notifications_outbox.sql")
			?? throw new InvalidOperationException("Stage 5 SQL migration resource was not found.");
		using var reader = new StreamReader(stream);
		return reader.ReadToEnd();
	}
}
