using Microsoft.AspNetCore.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using Serilog;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Infrastructure;
using Vitrina.Api.Features.Auth;
using Vitrina.Api.Features.Companies;
using Vitrina.Api.Features.Cases;
using Vitrina.Api.Features.Profiles;
using Vitrina.Api.Features.Teams;
using Vitrina.Api.Features.Applications;
using Vitrina.Api.Features.Execution;
using Vitrina.Api.Features.Submissions;
using Vitrina.Api.Features.Files;
using Vitrina.Api.Features.Nda;
using Vitrina.Api.Features.Evaluation;
using Vitrina.Api.Infrastructure.Storage;
using Vitrina.Api.Features.Notifications;
using Vitrina.Api.Infrastructure.Outbox;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Caching.Distributed;

var builder = WebApplication.CreateBuilder(args);
var maxUploadSize = builder.Configuration.GetValue<long>("Storage:MaxFileSizeBytes", 25 * 1024 * 1024);
builder.WebHost.ConfigureKestrel(options =>
{
	options.Limits.MaxRequestBodySize = maxUploadSize + 1024 * 1024;
});

builder.Host.UseSerilog((context, configuration) => configuration
	.ReadFrom.Configuration(context.Configuration)
	.Enrich.FromLogContext()
	.WriteTo.Console());

builder.Services.AddDbContext<VitrinaDbContext>(options =>
	options.UseNpgsql(
		builder.Configuration.GetConnectionString("Default")
			?? "Host=localhost;Port=5432;Database=vitrina;Username=postgres;Password=vitrina",
		npgsql => npgsql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)));

builder.Services.AddScoped<IPasswordHasher<UserAccount>, PasswordHasher<UserAccount>>();
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection("Storage"));
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
	options.MultipartBodyLengthLimit = maxUploadSize + 1024 * 1024;
});
builder.Services.AddSingleton<IPrivateObjectStorage, MinioPrivateObjectStorage>();
builder.Services.AddHostedService<DatabaseMigrationService>();
builder.Services.AddHostedService<StagedFileCleanupService>();
builder.Services.AddHostedService<OutboxWorker>();

var redisConnection = builder.Configuration.GetConnectionString("Redis")
	?? builder.Configuration["Redis:ConnectionString"];
if (!string.IsNullOrWhiteSpace(redisConnection))
{
	builder.Services.AddStackExchangeRedisCache(options =>
	{
		options.Configuration = redisConnection;
		options.InstanceName = "vitrina:";
	});
	builder.Services.AddSignalR().AddStackExchangeRedis(redisConnection, options =>
	{
		options.Configuration.ChannelPrefix = StackExchange.Redis.RedisChannel.Literal("vitrina");
	});
}
else
{
	builder.Services.AddDistributedMemoryCache();
	builder.Services.AddSignalR();
}
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<SessionService>();
builder.Services.AddScoped<CsrfService>();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<IAccessPolicy, AccessPolicy>();
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);

builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
	policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
			?? ["http://localhost:5173", "https://localhost:5173"])
		.AllowAnyHeader()
		.AllowAnyMethod()
		.AllowCredentials()));

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddHttpContextAccessor();
builder.Services.AddRateLimiter(options =>
{
	options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
	options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
		RateLimitPartition.GetTokenBucketLimiter(
			context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
			_ => new TokenBucketRateLimiterOptions
			{
				TokenLimit = 180,
				TokensPerPeriod = 90,
				ReplenishmentPeriod = TimeSpan.FromMinutes(1),
				QueueLimit = 0,
				AutoReplenishment = true
			}));
	options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
		context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
		_ => new FixedWindowRateLimiterOptions
		{
			PermitLimit = 10,
			Window = TimeSpan.FromMinutes(1),
			QueueLimit = 0,
			AutoReplenishment = true
		}));
	options.AddPolicy("api", context => RateLimitPartition.GetTokenBucketLimiter(
		context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
		_ => new TokenBucketRateLimiterOptions
		{
			TokenLimit = 120,
			TokensPerPeriod = 60,
			ReplenishmentPeriod = TimeSpan.FromMinutes(1),
			QueueLimit = 0,
			AutoReplenishment = true
		}));
});

var app = builder.Build();

var forwardedHeadersOptions = new ForwardedHeadersOptions
{
	ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
forwardedHeadersOptions.KnownIPNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);
app.UseWebSockets();
app.UseSerilogRequestLogging();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.Use(async (context, next) =>
{
	context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
	context.Response.Headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
	context.Response.Headers.TryAdd("X-Frame-Options", "DENY");
	context.Response.Headers.TryAdd("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
	await next();
});
app.UseCors();
app.UseRateLimiter();
app.UseMiddleware<RequestContextMiddleware>();
app.UseMiddleware<SessionAuthenticationMiddleware>();
app.UseMiddleware<CsrfMiddleware>();

if (app.Environment.IsDevelopment())
{
	app.MapOpenApi();
	app.MapScalarApiReference();
}

app.MapGet("/health/live", () => Results.Ok(new { status = "ok", service = "vitrina-api" }));
app.MapGet("/health/ready", async (VitrinaDbContext db, IDistributedCache cache, CancellationToken ct) =>
{
	try
	{
		if (!await db.Database.CanConnectAsync(ct))
			return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Service is not ready.");

		await cache.GetAsync("health:probe", ct);
		return Results.Ok(new { status = "ready", database = "ok", cache = "ok" });
	}
	catch (Exception)
	{
		// The readiness endpoint intentionally returns a generic response.
		return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Service is not ready.");
	}
});
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "vitrina-api" }));

app.MapAuthEndpoints();
app.MapCompanyEndpoints();
app.MapCompanyInvitationEndpoints();
app.MapCaseEndpoints();
app.MapProfileEndpoints();
app.MapTeamEndpoints();
app.MapApplicationEndpoints();
app.MapExecutionEndpoints();
app.MapSubmissionEndpoints();
app.MapFileEndpoints();
app.MapNdaEndpoints();
app.MapContractEvaluationEndpoints();
app.MapNotificationEndpoints();
app.MapHub<NotificationsHub>("/hubs/notifications");

app.Run();

