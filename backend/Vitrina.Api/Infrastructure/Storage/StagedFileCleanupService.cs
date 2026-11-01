using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;

namespace Vitrina.Api.Infrastructure.Storage;

public sealed class StagedFileCleanupService(
	IServiceScopeFactory scopeFactory,
	IPrivateObjectStorage storage,
	ILogger<StagedFileCleanupService> logger) : BackgroundService
{
	private static readonly TimeSpan Retention = TimeSpan.FromHours(24);

	protected override async Task ExecuteAsync(CancellationToken stoppingToken)
	{
		using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
		while (!stoppingToken.IsCancellationRequested)
		{
			try
			{
				await CleanupAsync(stoppingToken);
			}
			catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
			{
				break;
			}
			catch (Exception exception)
			{
				logger.LogError(exception, "Staged file cleanup failed.");
			}

			try
			{
				if (!await timer.WaitForNextTickAsync(stoppingToken))
					break;
			}
			catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
			{
				break;
			}
		}
	}

	private async Task CleanupAsync(CancellationToken cancellationToken)
	{
		await using var scope = scopeFactory.CreateAsyncScope();
		var db = scope.ServiceProvider.GetRequiredService<VitrinaDbContext>();
		var cutoff = DateTimeOffset.UtcNow.Subtract(Retention);
		var expiredFiles = await db.StoredFiles
			.Where(x => x.CreatedAt < cutoff && (x.Status == "READY" || x.Status == "FAILED" || x.Status == "UPLOADING" || x.Status == "DELETING"))
			.OrderBy(x => x.CreatedAt)
			.Take(100)
			.ToListAsync(cancellationToken);

		foreach (var file in expiredFiles)
		{
			var claimed = await db.StoredFiles
				.Where(x => x.Id == file.Id && x.CreatedAt < cutoff &&
					(x.Status == "READY" || x.Status == "FAILED" || x.Status == "UPLOADING" || x.Status == "DELETING"))
				.ExecuteUpdateAsync(update => update.SetProperty(x => x.Status, "DELETING"), cancellationToken);
			if (claimed == 0)
				continue;

			try
			{
				await storage.DeleteAsync(file.ObjectKey, cancellationToken);
				await db.StoredFiles.Where(x => x.Id == file.Id && x.Status == "DELETING").ExecuteDeleteAsync(cancellationToken);
				logger.LogInformation("Expired staged file {FileId} was removed.", file.Id);
			}
			catch (Exception exception) when (exception is not OperationCanceledException)
			{
				await db.StoredFiles.Where(x => x.Id == file.Id && x.Status == "DELETING")
					.ExecuteUpdateAsync(update => update.SetProperty(x => x.Status, "FAILED"), cancellationToken);
				logger.LogWarning(exception, "Could not remove expired staged file {FileId}.", file.Id);
			}
		}
	}
}
