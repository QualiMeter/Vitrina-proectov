using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Features.Notifications;

namespace Vitrina.Api.Infrastructure.Outbox;

public sealed class OutboxWorker(
	IServiceScopeFactory scopeFactory,
	IHubContext<NotificationsHub> hub,
	ILogger<OutboxWorker> logger) : BackgroundService
{
	private readonly string _workerId = $"{Environment.MachineName}:{Guid.NewGuid():N}";

	protected override async Task ExecuteAsync(CancellationToken stoppingToken)
	{
		using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));
		while (!stoppingToken.IsCancellationRequested)
		{
			try
			{
				await ProcessBatchAsync(stoppingToken);
			}
			catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
			{
				break;
			}
			catch (Exception exception)
			{
				logger.LogError(exception, "Outbox processing failed.");
			}

			try
			{
				if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
			}
			catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
			{
				break;
			}
		}
	}

	private async Task ProcessBatchAsync(CancellationToken cancellationToken)
	{
		await using var scope = scopeFactory.CreateAsyncScope();
		var db = scope.ServiceProvider.GetRequiredService<VitrinaDbContext>();
		var now = DateTimeOffset.UtcNow;
		var candidates = await db.OutboxMessages
			.Where(x => x.ProcessedAt == null && (x.AvailableAt == null || x.AvailableAt <= now) &&
				(x.LockedAt == null || x.LockedAt < now.AddMinutes(-2)))
			.OrderBy(x => x.OccurredAt)
			.Take(50)
			.Select(x => x.Id)
			.ToListAsync(cancellationToken);

		foreach (var id in candidates)
		{
			var claimed = await db.OutboxMessages
				.Where(x => x.Id == id && x.ProcessedAt == null &&
					(x.LockedAt == null || x.LockedAt < now.AddMinutes(-2)))
				.ExecuteUpdateAsync(update => update
					.SetProperty(x => x.LockedAt, now)
					.SetProperty(x => x.LockOwner, _workerId)
					.SetProperty(x => x.Attempts, x => x.Attempts + 1), cancellationToken);
			if (claimed == 0) continue;

			var message = await db.OutboxMessages.AsNoTracking().SingleOrDefaultAsync(
				x => x.Id == id && x.LockOwner == _workerId, cancellationToken);
			if (message is null) continue;

			try
			{
				if (message.Type == "notification.created")
				{
					var payload = JsonSerializer.Deserialize<NotificationCreatedPayload>(message.PayloadJson);
					if (payload is not null)
						await hub.Clients.Group(NotificationsHub.UserGroup(payload.UserId))
							.SendAsync("notification.created", new { notificationId = payload.NotificationId }, cancellationToken);
				}

				await db.OutboxMessages.Where(x => x.Id == id && x.LockOwner == _workerId)
					.ExecuteUpdateAsync(update => update
						.SetProperty(x => x.ProcessedAt, DateTimeOffset.UtcNow)
						.SetProperty(x => x.LockedAt, (DateTimeOffset?)null)
						.SetProperty(x => x.LockOwner, (string?)null)
						.SetProperty(x => x.LastError, (string?)null), cancellationToken);
			}
			catch (Exception exception) when (exception is not OperationCanceledException)
			{
				var attempts = message.Attempts;
				var delayMinutes = Math.Min(60, Math.Pow(2, Math.Min(attempts, 6)));
				await db.OutboxMessages.Where(x => x.Id == id && x.LockOwner == _workerId)
					.ExecuteUpdateAsync(update => update
						.SetProperty(x => x.AvailableAt, DateTimeOffset.UtcNow.AddMinutes(delayMinutes))
						.SetProperty(x => x.LockedAt, (DateTimeOffset?)null)
						.SetProperty(x => x.LockOwner, (string?)null)
						.SetProperty(x => x.LastError, exception.Message.Length > 2000 ? exception.Message[..2000] : exception.Message), cancellationToken);
				logger.LogWarning(exception, "Outbox message {OutboxMessageId} failed on attempt {Attempt}.", id, attempts);
			}
		}
	}

	private sealed record NotificationCreatedPayload(Guid NotificationId, Guid UserId);
}
