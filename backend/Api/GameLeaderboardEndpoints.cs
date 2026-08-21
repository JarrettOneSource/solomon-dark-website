using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static partial class GameLeaderboardEndpoints
{
    private const int MaximumEntries = 100;

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/game/leaderboards", ListAsync);
        app.MapPost("/api/game/leaderboards", SubmitAsync)
            .RequireAuthorization()
            .RequireRateLimiting("leaderboard-submissions");
    }

    private static async Task<IResult> ListAsync(
        string? board,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        var normalizedBoard = NormalizeBoard(board);
        if (normalizedBoard is null)
        {
            return ApiErrors.BadRequest("That leaderboard does not exist.");
        }

        var source = db.GameLeaderboardEntries
            .AsNoTracking()
            .Include(entry => entry.User);
        IOrderedQueryable<GameLeaderboardEntry> ordered = normalizedBoard switch
        {
            "wave" => source
                .OrderByDescending(entry => entry.Wave)
                .ThenByDescending(entry => entry.Awesomeness)
                .ThenByDescending(entry => entry.Id),
            "kills" => source
                .OrderByDescending(entry => entry.MonstersKilled)
                .ThenByDescending(entry => entry.Awesomeness)
                .ThenByDescending(entry => entry.Id),
            "time" => source
                .OrderByDescending(entry => entry.ElapsedTicks)
                .ThenByDescending(entry => entry.Awesomeness)
                .ThenByDescending(entry => entry.Id),
            _ => source
                .OrderByDescending(entry => entry.Awesomeness)
                .ThenByDescending(entry => entry.Id)
        };
        var entries = await ordered.Take(MaximumEntries).ToListAsync(cancellationToken);
        return Results.Ok(new
        {
            board = normalizedBoard,
            items = entries.Select((entry, index) => Payload(entry, index + 1))
        });
    }

    private static async Task<IResult> SubmitAsync(
        SubmitLeaderboardEntryRequest request,
        HttpContext context,
        AppDb db,
        GameLeaderboardReceiptVerifier receiptVerifier,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("A valid bearer token is required.");
        }
        if (!receiptVerifier.Configured)
        {
            return ApiErrors.Error(
                StatusCodes.Status503ServiceUnavailable,
                "Global leaderboard submission is unavailable.");
        }
        var receipt = receiptVerifier.Verify(request.Receipt, userId.Value);
        if (receipt is null)
        {
            return ApiErrors.BadRequest("The authoritative leaderboard receipt is invalid.");
        }
        var error = Validate(receipt);
        if (error is not null)
        {
            return ApiErrors.BadRequest(error);
        }

        var user = await db.Users
            .SingleOrDefaultAsync(candidate => candidate.Id == userId.Value, cancellationToken);
        if (user is null)
        {
            return ApiErrors.Unauthorized("This enrollment no longer exists.");
        }

        var runId = receipt.RunId!.Trim();
        var existing = await db.GameLeaderboardEntries
            .Include(entry => entry.User)
            .SingleOrDefaultAsync(
                entry => entry.UserId == user.Id && entry.RunId == runId,
                cancellationToken);
        if (existing is not null)
        {
            return Results.Ok(Payload(existing));
        }

        var entry = new GameLeaderboardEntry
        {
            UserId = user.Id,
            User = user,
            RunId = runId,
            WizardName = receipt.WizardName!.Trim(),
            Element = receipt.Element!,
            Discipline = receipt.Discipline!,
            HeadingIndex = receipt.HeadingIndex,
            PortraitScale = receipt.PortraitScale,
            Level = receipt.Level,
            Awesomeness = receipt.Awesomeness,
            ElapsedTicks = receipt.ElapsedTicks,
            Wave = receipt.Wave,
            MonstersKilled = receipt.MonstersKilled,
            AwesomestKill = NormalizeOptionalText(receipt.AwesomestKill),
            HighestSkillsJson = JsonSerializer.Serialize(receipt.HighestSkills),
            PerksUsedJson = JsonSerializer.Serialize(receipt.PerksUsed),
            CompletedAtUtc = receipt.CompletedAtUtc
        };
        db.GameLeaderboardEntries.Add(entry);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            db.Entry(entry).State = EntityState.Detached;
            existing = await db.GameLeaderboardEntries
                .Include(candidate => candidate.User)
                .SingleOrDefaultAsync(
                    candidate => candidate.UserId == user.Id && candidate.RunId == runId,
                    cancellationToken);
            if (existing is null)
            {
                throw;
            }
            return Results.Ok(Payload(existing));
        }
        return Results.Created("/api/game/leaderboards", Payload(entry));
    }

    private static object Payload(GameLeaderboardEntry entry, int? rank = null) => new
    {
        rank,
        accountUsername = entry.User.Username,
        entry.RunId,
        entry.WizardName,
        entry.Element,
        entry.Discipline,
        entry.HeadingIndex,
        entry.PortraitScale,
        entry.Level,
        entry.Awesomeness,
        entry.ElapsedTicks,
        entry.Wave,
        entry.MonstersKilled,
        entry.AwesomestKill,
        highestSkills = JsonSerializer.Deserialize<GameLeaderboardReceiptSkill[]>(
            entry.HighestSkillsJson) ?? [],
        perksUsed = JsonSerializer.Deserialize<int[]>(entry.PerksUsedJson) ?? [],
        entry.CompletedAtUtc
    };

    private static string? Validate(GameLeaderboardReceipt request)
    {
        if (request.RunId is null || !RunId().IsMatch(request.RunId.Trim()))
        {
            return "The completed run id is invalid.";
        }
        if (!ValidText(request.WizardName, 32))
        {
            return "The wizard name is invalid.";
        }
        if (request.Element is not ("air" or "earth" or "ether" or "fire" or "water"))
        {
            return "The wizard element is invalid.";
        }
        if (request.Discipline is not ("arcane" or "body" or "mind"))
        {
            return "The wizard discipline is invalid.";
        }
        if (request.HeadingIndex is < 0 or > 23 ||
            request.PortraitScale is < 0.85 or > 1 ||
            request.Level is < 1 or > 10_000 ||
            request.Awesomeness is < 0 or > 2_000_000_000 ||
            request.ElapsedTicks is < 0 or > 60_480_000 ||
            request.Wave is < 0 or > 1_000_000 ||
            request.MonstersKilled is < 0 or > 2_000_000_000)
        {
            return "The completed run statistics are outside their supported limits.";
        }
        if (request.AwesomestKill is not null && !ValidText(request.AwesomestKill, 64))
        {
            return "The awesomest kill is invalid.";
        }
        if (request.HighestSkills is null ||
            request.HighestSkills.Length > 3 ||
            request.HighestSkills.Any(skill => skill.SkillId is < 0 or > 255 || skill.Rank is < 1 or > 100) ||
            request.HighestSkills.Select(skill => skill.SkillId).Distinct().Count() != request.HighestSkills.Length)
        {
            return "The highest-skill list is invalid.";
        }
        if (request.PerksUsed is null ||
            request.PerksUsed.Length > 9 ||
            request.PerksUsed.Any(perk => perk is < 0 or > 255) ||
            request.PerksUsed.Distinct().Count() != request.PerksUsed.Length)
        {
            return "The perk list is invalid.";
        }
        if (request.CompletedAtUtc.Kind != DateTimeKind.Utc ||
            request.CompletedAtUtc < new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc) ||
            request.CompletedAtUtc > DateTime.UtcNow.AddMinutes(5))
        {
            return "The completion time is invalid.";
        }
        return null;
    }

    private static string? NormalizeBoard(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(normalized) ? "awesomeness" : normalized switch
        {
            "awesomeness" or "wave" or "kills" or "time" => normalized,
            _ => null
        };
    }

    private static string? NormalizeOptionalText(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrEmpty(normalized) ? null : normalized;
    }

    private static bool ValidText(string? value, int maximumLength)
    {
        var normalized = value?.Trim();
        return !string.IsNullOrEmpty(normalized) &&
               normalized.Length <= maximumLength &&
               !normalized.Any(char.IsControl);
    }

    [GeneratedRegex("^[A-Za-z0-9_-]{1,64}$", RegexOptions.CultureInvariant)]
    private static partial Regex RunId();

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    public sealed record SubmitLeaderboardEntryRequest(string? Receipt);
}
