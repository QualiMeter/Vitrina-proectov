using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Notifications;

public static class NotificationEndpoints
{
	public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder app)
	{
		var api = app.MapGroup("/api/v1/notifications");
		api.MapGet("", List);
		api.MapGet("/unread-count", UnreadCount);
		api.MapPost("/{notificationId:guid}/read", MarkRead);
		api.MapPost("/read-all", MarkAllRead);
		return app;
	}

	private static async Task<IResult> List(
		int? page, int? pageSize, bool? unreadOnly, CurrentUser current,
		VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var currentPage = page ?? 1;
		var currentPageSize = pageSize ?? 20;
		if (currentPage < 1 || currentPageSize is < 1 or > 100)
			return ApiErrors.BadRequest("invalid_pagination", "page must be positive and pageSize must be between 1 and 100.");

		var query = db.Notifications.AsNoTracking().Where(x => x.UserId == userId);
		if (unreadOnly == true) query = query.Where(x => x.ReadAt == null);
		var total = await query.CountAsync(ct);
		var items = await query.OrderByDescending(x => x.CreatedAt)
			.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize)
			.Select(x => new
			{
				x.Id, x.Type, x.Title, x.Body, x.ResourceType, x.ResourceId, x.CreatedAt, x.ReadAt
			})
			.ToListAsync(ct);
		return Results.Ok(new { items, page = currentPage, pageSize = currentPageSize, total });
	}

	private static async Task<IResult> UnreadCount(CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var count = await db.Notifications.CountAsync(x => x.UserId == userId && x.ReadAt == null, ct);
		return Results.Ok(new { unreadCount = count });
	}

	private static async Task<IResult> MarkRead(
		Guid notificationId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var now = DateTimeOffset.UtcNow;
		var changed = await db.Notifications
			.Where(x => x.Id == notificationId && x.UserId == userId && x.ReadAt == null)
			.ExecuteUpdateAsync(update => update.SetProperty(x => x.ReadAt, now), ct);
		if (changed == 0 && !await db.Notifications.AnyAsync(x => x.Id == notificationId && x.UserId == userId, ct))
			return ApiErrors.NotFound();
		return Results.Ok(new { notificationId, readAt = now });
	}

	private static async Task<IResult> MarkAllRead(CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId) return ApiErrors.Unauthorized();
		var now = DateTimeOffset.UtcNow;
		var changed = await db.Notifications.Where(x => x.UserId == userId && x.ReadAt == null)
			.ExecuteUpdateAsync(update => update.SetProperty(x => x.ReadAt, now), ct);
		return Results.Ok(new { updated = changed, readAt = now });
	}
}
