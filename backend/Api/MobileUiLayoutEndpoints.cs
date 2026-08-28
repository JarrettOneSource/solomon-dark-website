using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class MobileUiLayoutEndpoints
{
    private const int DocumentVersion = 2;
    private const int CodeLength = 8;
    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const double MinimumScale = 0.4;
    private const double MaximumScale = 3;

    private static readonly string[] ElementIds =
    [
        "pause",
        "diagnostics",
        "meters",
        "leftJoystick",
        "rightJoystick",
        "slot1",
        "slot2",
        "slot3",
        "slot4",
        "slot5",
        "slot6",
        "slot7",
        "slot8",
        "inventory",
        "skillbook",
        "xp",
        "healthPotion",
        "manaPotion"
    ];

    public static void Map(WebApplication app)
    {
        app.MapPost("/api/game/layouts", PublishAsync)
            .RequireAuthorization();
        app.MapGet("/api/game/layouts/{code}", GetAsync);
    }

    private static async Task<IResult> PublishAsync(
        PublishMobileUiLayoutRequest request,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var authorId = TokenService.GetUserId(context.User);
        if (authorId is null)
        {
            return ApiErrors.Unauthorized("A Website account is required to share a layout.");
        }

        var author = await db.Users
            .SingleOrDefaultAsync(user => user.Id == authorId.Value, cancellationToken);
        if (author is null)
        {
            return ApiErrors.Unauthorized("This enrollment no longer exists.");
        }

        if (!TryCanonicalize(request.Layout, out var document, out var validationError))
        {
            return ApiErrors.BadRequest(validationError);
        }

        SharedMobileUiLayout? layout = null;
        for (var attempt = 0; attempt < 5; attempt += 1)
        {
            var code = GenerateCode();
            if (await db.SharedMobileUiLayouts.AnyAsync(
                    candidate => candidate.Code == code,
                    cancellationToken))
            {
                continue;
            }

            layout = new SharedMobileUiLayout
            {
                Author = author,
                AuthorId = author.Id,
                Code = code,
                CreatedAtUtc = DateTime.UtcNow,
                Document = document
            };
            db.SharedMobileUiLayouts.Add(layout);
            try
            {
                await db.SaveChangesAsync(cancellationToken);
                break;
            }
            catch (DbUpdateException exception)
                when (exception.InnerException is SqliteException { SqliteErrorCode: 19 })
            {
                db.Entry(layout).State = EntityState.Detached;
                layout = null;
            }
        }

        if (layout is null)
        {
            return ApiErrors.Error(
                StatusCodes.Status503ServiceUnavailable,
                "The Dark Cloud could not assign a layout code. Try again.");
        }

        return Results.Created(
            $"/api/game/layouts/{FormatCode(layout.Code)}",
            Response(layout));
    }

    private static async Task<IResult> GetAsync(
        string code,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var normalized = NormalizeCode(code);
        if (normalized is null)
        {
            return ApiErrors.NotFound("No shared layout has that code.");
        }

        var layout = await db.SharedMobileUiLayouts
            .AsNoTracking()
            .Include(candidate => candidate.Author)
            .SingleOrDefaultAsync(candidate => candidate.Code == normalized, cancellationToken);
        return layout is null
            ? ApiErrors.NotFound("No shared layout has that code.")
            : Results.Ok(Response(layout));
    }

    private static object Response(SharedMobileUiLayout layout)
    {
        using var parsed = JsonDocument.Parse(layout.Document);
        return new
        {
            code = FormatCode(layout.Code),
            layout = parsed.RootElement.Clone(),
            author = new { username = layout.Author.Username },
            createdAtUtc = layout.CreatedAtUtc
        };
    }

    private static bool TryCanonicalize(
        JsonElement candidate,
        out string document,
        out string error)
    {
        document = string.Empty;
        error = "A complete version-2 mobile UI layout is required.";
        if (candidate.ValueKind != JsonValueKind.Object
            || !HasExactProperties(candidate, "version", "elements")
            || !candidate.TryGetProperty("version", out var version)
            || !version.TryGetInt32(out var versionNumber)
            || versionNumber != DocumentVersion
            || !candidate.TryGetProperty("elements", out var elements)
            || elements.ValueKind != JsonValueKind.Object
            || !HasExactProperties(elements, ElementIds))
        {
            return false;
        }

        var transforms = new Dictionary<string, MobileUiTransform>(ElementIds.Length);
        foreach (var id in ElementIds)
        {
            if (!elements.TryGetProperty(id, out var value)
                || !TryReadTransform(value, out var transform))
            {
                error = $"The {id} layout transform is invalid.";
                return false;
            }
            transforms.Add(id, transform);
        }

        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteNumber("version", DocumentVersion);
            writer.WritePropertyName("elements");
            writer.WriteStartObject();
            foreach (var id in ElementIds)
            {
                var transform = transforms[id];
                writer.WritePropertyName(id);
                writer.WriteStartObject();
                writer.WriteNumber("rotation", transform.Rotation);
                writer.WriteNumber("scale", transform.Scale);
                writer.WriteNumber("x", transform.X);
                writer.WriteNumber("y", transform.Y);
                writer.WriteEndObject();
            }
            writer.WriteEndObject();
            writer.WriteEndObject();
        }
        document = Encoding.UTF8.GetString(stream.ToArray());
        error = string.Empty;
        return true;
    }

    private static bool TryReadTransform(
        JsonElement candidate,
        out MobileUiTransform transform)
    {
        transform = default;
        if (candidate.ValueKind != JsonValueKind.Object
            || !HasExactProperties(candidate, "rotation", "scale", "x", "y")
            || !TryReadFinite(candidate, "rotation", out var rotation)
            || !TryReadFinite(candidate, "scale", out var scale)
            || !TryReadFinite(candidate, "x", out var x)
            || !TryReadFinite(candidate, "y", out var y)
            || rotation < -180 || rotation > 180
            || scale < MinimumScale || scale > MaximumScale
            || x < 0 || x > 100
            || y < 0 || y > 100)
        {
            return false;
        }

        transform = new MobileUiTransform(rotation, scale, x, y);
        return true;
    }

    private static bool TryReadFinite(
        JsonElement candidate,
        string propertyName,
        out double value)
    {
        value = 0;
        return candidate.TryGetProperty(propertyName, out var property)
            && property.ValueKind == JsonValueKind.Number
            && property.TryGetDouble(out value)
            && double.IsFinite(value);
    }

    private static bool HasExactProperties(
        JsonElement candidate,
        params string[] expected)
    {
        var names = candidate.EnumerateObject()
            .Select(property => property.Name)
            .Order(StringComparer.Ordinal)
            .ToArray();
        return names.SequenceEqual(expected.Order(StringComparer.Ordinal), StringComparer.Ordinal);
    }

    private static string GenerateCode()
    {
        Span<char> code = stackalloc char[CodeLength];
        for (var index = 0; index < code.Length; index += 1)
        {
            code[index] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        }
        return new string(code);
    }

    private static string? NormalizeCode(string code)
    {
        Span<char> normalized = stackalloc char[CodeLength];
        var length = 0;
        foreach (var character in code)
        {
            if (character is '-' or ' ') continue;
            var upper = char.ToUpperInvariant(character);
            if (length >= normalized.Length || !CodeAlphabet.Contains(upper))
            {
                return null;
            }
            normalized[length] = upper;
            length += 1;
        }
        return length == CodeLength ? new string(normalized) : null;
    }

    private static string FormatCode(string code) => $"{code[..4]}-{code[4..]}";

    public sealed record PublishMobileUiLayoutRequest(JsonElement Layout);

    private readonly record struct MobileUiTransform(
        double Rotation,
        double Scale,
        double X,
        double Y);
}
