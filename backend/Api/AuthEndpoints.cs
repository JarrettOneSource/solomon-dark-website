using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class AuthEndpoints
{
    private static readonly Regex UsernamePattern = new(
        "^[A-Za-z0-9_-]{3,24}$",
        RegexOptions.CultureInvariant);

    private static readonly Regex EmailPattern = new(
        "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
        RegexOptions.CultureInvariant);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/auth/register", RegisterAsync);
        app.MapPost("/api/auth/login", LoginAsync);
        app.MapGet("/api/auth/me", MeAsync).RequireAuthorization();
        app.MapPut("/api/auth/school", SetSchoolAsync).RequireAuthorization();
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request,
        AppDb db,
        IPasswordHasher<User> passwordHasher,
        TokenService tokens,
        CancellationToken cancellationToken)
    {
        var username = request.Username?.Trim() ?? string.Empty;
        var email = request.Email?.Trim() ?? string.Empty;
        var password = request.Password ?? string.Empty;

        if (!UsernamePattern.IsMatch(username))
        {
            return ApiErrors.BadRequest("Names must be 3–24 characters using only letters, numbers, underscores, or hyphens.");
        }

        if (email.Length > 254 || !EmailPattern.IsMatch(email))
        {
            return ApiErrors.BadRequest("Enter a valid email address.");
        }

        if (password.Length < 8)
        {
            return ApiErrors.BadRequest("Passwords must be at least 8 characters.");
        }

        if (await db.Users.AnyAsync(user => user.Username == username, cancellationToken))
        {
            return ApiErrors.Conflict("That name is already written in the Annals.");
        }

        if (await db.Users.AnyAsync(user => user.Email == email, cancellationToken))
        {
            return ApiErrors.Conflict("That email is already enrolled.");
        }

        var user = new User
        {
            Username = username,
            Email = email,
            CreatedAtUtc = DateTime.UtcNow
        };
        user.PasswordHash = passwordHasher.HashPassword(user, password);
        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return ApiErrors.Conflict("That name or email is already enrolled.");
        }

        return Results.Json(
            new { token = tokens.Create(user), user = UserPayload(user) },
            statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        AppDb db,
        IPasswordHasher<User> passwordHasher,
        TokenService tokens,
        CancellationToken cancellationToken)
    {
        var nameOrEmail = request.UsernameOrEmail?.Trim() ?? string.Empty;
        var password = request.Password ?? string.Empty;
        var user = await db.Users.SingleOrDefaultAsync(
            candidate => candidate.Username == nameOrEmail || candidate.Email == nameOrEmail,
            cancellationToken);

        if (user is null ||
            passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password) == PasswordVerificationResult.Failed)
        {
            return ApiErrors.Unauthorized("Wrong name or password. The Annals are unforgiving.");
        }

        return Results.Ok(new { token = tokens.Create(user), user = UserPayload(user) });
    }

    private static async Task<IResult> MeAsync(
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this bearer.");
        }

        var user = await db.Users.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == userId.Value, cancellationToken);
        if (user is null)
        {
            return ApiErrors.Unauthorized("This enrollment no longer exists.");
        }

        var modCount = await db.Mods.CountAsync(mod => mod.AuthorId == user.Id, cancellationToken);
        var saveCount = await db.CloudSaves.CountAsync(save => save.UserId == user.Id, cancellationToken);

        return Results.Ok(new { user = UserPayload(user), modCount, saveCount });
    }

    private static async Task<IResult> SetSchoolAsync(
        SchoolRequest request,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        if (!IsValidSchool(request.School))
        {
            return ApiErrors.BadRequest("The College recognizes five schools. That is not one of them.");
        }

        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this bearer.");
        }

        var user = await db.Users
            .SingleOrDefaultAsync(candidate => candidate.Id == userId.Value, cancellationToken);
        if (user is null)
        {
            return ApiErrors.Unauthorized("This enrollment no longer exists.");
        }

        user.School = request.School;
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { user = UserPayload(user) });
    }

    private static bool IsValidSchool(string? school) =>
        school is null or "fire" or "air" or "water" or "ether" or "earth";

    private static object UserPayload(User user) => new
    {
        user.Id,
        user.Username,
        user.Email,
        user.School,
        user.SteamId,
        user.CreatedAtUtc
    };

    public sealed record RegisterRequest(string? Username, string? Email, string? Password);
    public sealed record LoginRequest(string? UsernameOrEmail, string? Password);
    public sealed record SchoolRequest(string? School);
}

internal static class ApiErrors
{
    public static IResult BadRequest(string message) => Error(StatusCodes.Status400BadRequest, message);
    public static IResult Unauthorized(string message) => Error(StatusCodes.Status401Unauthorized, message);
    public static IResult Forbidden(string message) => Error(StatusCodes.Status403Forbidden, message);
    public static IResult NotFound(string message) => Error(StatusCodes.Status404NotFound, message);
    public static IResult Conflict(string message) => Error(StatusCodes.Status409Conflict, message);
    public static IResult UnsupportedMediaType(string message) => Error(StatusCodes.Status415UnsupportedMediaType, message);

    public static IResult Error(int statusCode, string message) =>
        Results.Json(new { error = message }, statusCode: statusCode);
}
