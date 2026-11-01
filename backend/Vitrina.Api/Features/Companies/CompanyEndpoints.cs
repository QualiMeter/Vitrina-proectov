using Microsoft.EntityFrameworkCore;
using Vitrina.Api.Data;
using Vitrina.Api.Domain;
using Vitrina.Api.Infrastructure;

namespace Vitrina.Api.Features.Companies;

public static class CompanyEndpoints
{
	public static IEndpointRouteBuilder MapCompanyEndpoints(this IEndpointRouteBuilder app)
	{
		var group = app.MapGroup("/api/v1").WithTags("Companies");
		group.MapGet("/public/companies/{companyId:guid}", GetPublic);
		group.MapGet("/companies", ListPrivate);
		group.MapPost("/companies", Create);
		group.MapGet("/companies/{companyId:guid}", GetPrivate);
		return app;
	}

	private static async Task<IResult> GetPublic(Guid companyId, VitrinaDbContext db, CancellationToken ct)
	{
		var company = await db.Companies.AsNoTracking().SingleOrDefaultAsync(x => x.Id == companyId, ct);
		return company is null ? ApiErrors.NotFound() :
			Results.Ok(new { companyId = company.Id, company.Name, company.Description });
	}

	private static async Task<IResult> ListPrivate(
		int page, int pageSize, string? search, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();
		var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId && !x.IsBlocked, ct);
		if (user is null || (!user.GlobalRoles.Contains("UNIVERSITY_STAFF") && !user.GlobalRoles.Contains("PLATFORM_ADMIN") && !user.GlobalPermissions.Contains("companies.listAll")))
			return ApiErrors.Forbidden("company_registry_forbidden", "Only university staff can browse the company registry.");

		page = Math.Max(1, page);
		pageSize = Math.Clamp(pageSize == 0 ? 20 : pageSize, 1, 100);
		var query = db.Companies.AsNoTracking();
		if (!string.IsNullOrWhiteSpace(search))
		{
			var term = search.Trim();
			query = query.Where(x => x.Name.Contains(term) || x.ContactEmail.Contains(term));
		}
		var total = await query.CountAsync(ct);
		var items = await query.OrderBy(x => x.Name).Skip((page - 1) * pageSize).Take(pageSize)
			.Select(x => new { companyId = x.Id, x.Name, x.Description, x.ContactEmail }).ToListAsync(ct);
		return Results.Ok(new { items, page, pageSize, total });
	}

	private static async Task<IResult> Create(
		CreateCompanyRequest request, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();

		var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, ct);
		if (user is null || (!user.GlobalRoles.Contains("UNIVERSITY_STAFF") && !user.GlobalRoles.Contains("PLATFORM_ADMIN") && !user.GlobalPermissions.Contains("companies.create")))
			return ApiErrors.Forbidden("company_creation_forbidden", "Only authorized university staff can create companies.");

		if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 200 ||
			string.IsNullOrWhiteSpace(request.ContactEmail))
			return ApiErrors.BadRequest("validation_failed", "Company name and contact email are required.");

		var company = new Company
		{
			Name = request.Name.Trim(),
			Description = request.Description?.Trim() ?? "",
			ContactEmail = request.ContactEmail.Trim().ToLowerInvariant(),
			CreatedByUserId = userId
		};
		company.Members.Add(new CompanyMember
		{
			UserId = userId,
			Role = "OWNER",
			Permissions = ["companies.readPrivate", "companies.update", "companies.invite", "students.read", "cases.manage"]
		});
		db.Companies.Add(company);
		db.AuditEntries.Add(new AuditEntry
		{
			ActorUserId = userId, Action = "company.created",
			ResourceType = "Company", ResourceId = company.Id
		});
		await db.SaveChangesAsync(ct);
		return Results.Created($"/api/v1/companies/{company.Id}", new
		{
			companyId = company.Id, company.Name, company.Description, company.ContactEmail
		});
	}

	private static async Task<IResult> GetPrivate(
		Guid companyId, CurrentUser current, VitrinaDbContext db, CancellationToken ct)
	{
		if (current.Id is not Guid userId)
			return ApiErrors.Unauthorized();

		var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId && !x.IsBlocked, ct);
		if (user is null) return ApiErrors.Unauthorized();
		var isStaff = user.GlobalRoles.Contains("UNIVERSITY_STAFF") || user.GlobalRoles.Contains("PLATFORM_ADMIN") || user.GlobalPermissions.Contains("companies.readPrivate");
		var membership = await db.CompanyMembers.AsNoTracking()
			.SingleOrDefaultAsync(x => x.CompanyId == companyId && x.UserId == userId, ct);
		if (!isStaff && (membership is null || !membership.Permissions.Contains("companies.readPrivate")))
			return ApiErrors.Forbidden("company_access_denied", "You do not have permission to view private company data.");
		var company = await db.Companies.AsNoTracking()
			.Where(x => x.Id == companyId)
			.Select(x => new { companyId = x.Id, x.Name, x.Description, x.ContactEmail })
			.SingleOrDefaultAsync(ct);
		return company is null ? ApiErrors.NotFound() : Results.Ok(company);
	}
}

public sealed record CreateCompanyRequest(string Name, string? Description, string ContactEmail);
