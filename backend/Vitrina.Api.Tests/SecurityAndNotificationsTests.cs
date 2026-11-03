using Xunit;
using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Features.Notifications;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Tests;

public sealed class SecurityAndNotificationsTests
{
	[Fact]
	public void VitrinaDbContext_ModelContainsEvaluationEntities()
	{
		var options = new DbContextOptionsBuilder<VitrinaDbContext>()
			.UseNpgsql("Host=localhost;Database=vitrina;Username=postgres;Password=not-used")
			.Options;

		using var db = new VitrinaDbContext(options);

		Assert.NotNull(db.Model.FindEntityType(typeof(CaseAward)));
		Assert.NotNull(db.Model.FindEntityType(typeof(CaseResultPublication)));
		var userEntity = db.Model.FindEntityType(typeof(UserAccount));
		Assert.NotNull(userEntity?.FindProperty(nameof(UserAccount.PrivacyAcceptedAt)));
		Assert.NotNull(userEntity?.FindProperty(nameof(UserAccount.PrivacyPolicyVersion)));
	}

	[Fact]
	public void SessionHash_UsesSha256Hex()
	{
		var hash = SessionService.Hash("vitrina-test-token");

		Assert.Equal(64, hash.Length);
		Assert.Equal(hash, hash.ToUpperInvariant());
		Assert.Equal(hash, SessionService.Hash("vitrina-test-token"));
		Assert.NotEqual(hash, SessionService.Hash("another-token"));
	}

	[Fact]
	public void CsrfToken_IsUrlSafeAndHasExpectedEntropyLength()
	{
		var token = new CsrfService().CreateToken();

		Assert.Equal(43, token.Length);
		Assert.DoesNotContain("+", token);
		Assert.DoesNotContain("/", token);
		Assert.DoesNotContain("=", token);
	}

	[Fact]
	public void NotificationGroup_IsStableAndUserScoped()
	{
		var userId = Guid.Parse("6e79f3d4-7a93-4a76-9c48-78e9e2df42b1");

		Assert.Equal("user:6e79f3d47a934a769c4878e9e2df42b1", NotificationsHub.UserGroup(userId));
		Assert.NotEqual(NotificationsHub.UserGroup(userId), NotificationsHub.UserGroup(Guid.NewGuid()));
	}
}
