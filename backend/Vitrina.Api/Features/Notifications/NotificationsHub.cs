using Microsoft.AspNetCore.SignalR;

namespace Vitrina.Api.Features.Notifications;

public sealed class NotificationsHub : Hub
{
	public override async Task OnConnectedAsync()
	{
		if (Context.GetHttpContext()?.Items["UserId"] is Guid userId)
			await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(userId));
		else
			Context.Abort();

		await base.OnConnectedAsync();
	}

	public static string UserGroup(Guid userId) => $"user:{userId:N}";
}
