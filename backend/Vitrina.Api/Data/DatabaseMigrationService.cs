using Microsoft.EntityFrameworkCore;

namespace Vitrina.Api.Data;

public sealed class DatabaseMigrationService(
	IServiceProvider services,
	IWebHostEnvironment environment,
	IConfiguration configuration,
	ILogger<DatabaseMigrationService> logger) : IHostedService
{
	public async Task StartAsync(CancellationToken cancellationToken)
	{
		await using var scope = services.CreateAsyncScope();
		var db = scope.ServiceProvider.GetRequiredService<VitrinaDbContext>();
		var bootstrap = configuration.GetValue<bool>("Database:BootstrapSchema");
		if (bootstrap)
		{
			if (!environment.IsDevelopment() && !configuration.GetValue<bool>("Database:AllowProductionBootstrap"))
				throw new InvalidOperationException("Database bootstrap is disabled in production unless Database:AllowProductionBootstrap=true is explicitly set.");
			await db.Database.EnsureCreatedAsync(cancellationToken);
			logger.LogWarning("One-time database bootstrap was requested. Disable Database:BootstrapSchema after initialization.");
		}

		await db.Database.MigrateAsync(cancellationToken);
		logger.LogInformation("EF Core database migrations are up to date.");
	}

	public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
