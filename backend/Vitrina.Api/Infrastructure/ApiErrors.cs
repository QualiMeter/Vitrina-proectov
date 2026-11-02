namespace Vitrina.Api.Infrastructure;

public static class ApiErrors
{
	public static IResult BadRequest(string code, string message) => Error(400, code, message);
	public static IResult Unauthorized(string code = "unauthorized", string message = "Authentication is required.") =>
		Error(401, code, message);
	public static IResult Forbidden(string code, string message) => Error(403, code, message);
	public static IResult NotFound(string code = "not_found", string message = "Resource was not found.") =>
		Error(404, code, message);
	public static IResult Conflict(string code, string message) => Error(409, code, message);

	private static IResult Error(int status, string code, string message) =>
		Results.Json(new { code, message, requestId = Guid.NewGuid().ToString("N") }, statusCode: status);
}
