using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SolomonDarkRevived.Services;

public sealed record WebGameSaveInspection(int FormatVersion, long Size, string Sha256);

public static class WebGameSaveInspector
{
    public const int FormatVersion = 11;
    private static readonly int[] LegacyFormatVersions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    public const int MaxDocumentBytes = 8 * 1024 * 1024;
    private const int MaxNodes = 250_000;

    public static WebGameSaveInspection Inspect(string? document)
    {
        if (string.IsNullOrEmpty(document))
        {
            throw new InvalidDataException("The browser game save cannot be empty.");
        }

        var bytes = Encoding.UTF8.GetBytes(document);
        if (bytes.Length > MaxDocumentBytes)
        {
            throw new InvalidDataException("Browser game saves may not exceed 8 MiB.");
        }

        JsonDocument parsed;
        try
        {
            parsed = JsonDocument.Parse(
                bytes,
                new JsonDocumentOptions
                {
                    AllowTrailingCommas = false,
                    CommentHandling = JsonCommentHandling.Disallow,
                    MaxDepth = 64
                });
        }
        catch (JsonException)
        {
            throw new InvalidDataException("The browser game save is not valid JSON.");
        }

        var inspectedFormatVersion = 0;
        using (parsed)
        {
            var root = RequireObject(parsed.RootElement, "browser game save");
            if (!root.TryGetProperty("schemaVersion", out var schemaVersion) ||
                !schemaVersion.TryGetInt32(out var version) ||
                (version != FormatVersion && !LegacyFormatVersions.Contains(version)))
            {
                throw new InvalidDataException("The browser game save schema version is not supported.");
            }
            inspectedFormatVersion = version;
            if (version >= 5)
            {
                RequireExactProperties(
                    root,
                    "browser game save",
                    "continuation",
                    "integrity",
                    "mods",
                    "modState",
                    "profile",
                    "schemaVersion");
                RequireMember(root, "integrity", "global-clean", "local-only");
                var profile = RequireObject(root.GetProperty("profile"), "browser game save profile");
                RequireExactProperties(
                    profile,
                    "browser game save profile",
                    "economy",
                    "hagathaRuntime");
                RequireObject(profile.GetProperty("economy"), "browser game save profile economy");
                RequireObject(
                    profile.GetProperty("hagathaRuntime"),
                    "browser game save profile Hagatha runtime");
                var continuation = root.GetProperty("continuation");
                if (continuation.ValueKind == JsonValueKind.Object)
                {
                    RequireExactProperties(
                        continuation,
                        "browser game save continuation",
                        "loadedBoneyard",
                        "simulation",
                        "summary");
                    ValidateContinuation(
                        continuation.GetProperty("summary"),
                        continuation.GetProperty("simulation"),
                        continuation.GetProperty("loadedBoneyard"),
                        version >= 6,
                        version >= 10);
                }
                else if (continuation.ValueKind != JsonValueKind.Null)
                {
                    throw new InvalidDataException(
                        "The browser game save continuation must be an object or null.");
                }
            }
            else
            {
                RequireExactProperties(
                    root,
                    "browser game save",
                    version switch
                    {
                        1 => ["loadedBoneyard", "schemaVersion", "simulation", "summary"],
                        2 or 3 => ["loadedBoneyard", "mods", "modState", "schemaVersion", "simulation", "summary"],
                        4 => ["integrity", "loadedBoneyard", "mods", "modState", "schemaVersion", "simulation", "summary"],
                        _ => throw new InvalidDataException(
                            "The browser game save schema version is not supported.")
                    });
                if (version == 4) RequireMember(root, "integrity", "global-clean", "local-only");
                ValidateContinuation(
                    root.GetProperty("summary"),
                    root.GetProperty("simulation"),
                    root.GetProperty("loadedBoneyard"),
                    false,
                    false);
            }
            if (CountNodes(root, 0) > MaxNodes)
            {
                throw new InvalidDataException("The browser game save contains too many values.");
            }
        }

        return new WebGameSaveInspection(
            inspectedFormatVersion,
            bytes.Length,
            Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
    }

    private static void ValidateContinuation(
        JsonElement summaryValue,
        JsonElement simulation,
        JsonElement loadedBoneyard,
        bool includesActiveRun,
        bool includesPartyRejoin)
    {
        var summary = RequireObject(summaryValue, "browser game save summary");
        RequireExactProperties(
            summary,
            "browser game save summary",
            includesActiveRun
                ? includesPartyRejoin
                    ? ["activeRun", "character", "partyRejoinToken", "phase", "playerId", "savedAtTick", "worldKind"]
                    : ["activeRun", "character", "phase", "playerId", "savedAtTick", "worldKind"]
                : ["character", "phase", "playerId", "savedAtTick", "worldKind"]);
        if (includesActiveRun &&
            summary.GetProperty("activeRun").ValueKind is not JsonValueKind.True and not JsonValueKind.False)
        {
            throw new InvalidDataException("The browser game save active run is invalid.");
        }
        if (includesPartyRejoin)
        {
            var token = summary.GetProperty("partyRejoinToken");
            if (token.ValueKind != JsonValueKind.Null &&
                (token.ValueKind != JsonValueKind.String ||
                 !IsPartyRejoinToken(token.GetString())))
            {
                throw new InvalidDataException("The browser game save party rejoin token is invalid.");
            }
        }
        var character = RequireObject(
            summary.GetProperty("character"),
            "browser game save character");
        RequireExactProperties(
            character,
            "browser game save character",
            "discipline",
            "displayName",
            "element");
        RequireMember(character, "discipline", "arcane", "body", "mind");
        RequireMember(character, "element", "air", "earth", "ether", "fire", "water");
        RequireString(character, "displayName", 64);
        RequireString(summary, "playerId", 128);
        RequireMember(summary, "phase", "hub", "active");
        RequireMember(summary, "worldKind", "hub", "boneyard");
        if (!summary.GetProperty("savedAtTick").TryGetInt64(out var savedAtTick) ||
            savedAtTick < 0)
        {
            throw new InvalidDataException("The browser game save tick is invalid.");
        }
        if (simulation.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidDataException("The browser game save simulation is invalid.");
        }
        var worldKind = summary.GetProperty("worldKind").GetString();
        if ((worldKind == "hub" && loadedBoneyard.ValueKind != JsonValueKind.Null) ||
            (worldKind == "boneyard" && loadedBoneyard.ValueKind != JsonValueKind.Object))
        {
            throw new InvalidDataException("The browser game save world and Boneyard disagree.");
        }
    }

    private static bool IsPartyRejoinToken(string? value) =>
        value is { Length: 43 } && value.All(character =>
            character is >= 'A' and <= 'Z' or
            >= 'a' and <= 'z' or
            >= '0' and <= '9' or
            '_' or '-');

    private static JsonElement RequireObject(JsonElement value, string field)
    {
        if (value.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidDataException($"The {field} must be an object.");
        }
        return value;
    }

    private static void RequireExactProperties(
        JsonElement value,
        string field,
        params string[] expected)
    {
        var actual = value.EnumerateObject()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);
        if (actual.Count != expected.Length || expected.Any(name => !actual.Contains(name)))
        {
            throw new InvalidDataException($"The {field} has an invalid field set.");
        }
    }

    private static void RequireString(JsonElement value, string property, int maximumLength)
    {
        var member = value.GetProperty(property);
        if (member.ValueKind != JsonValueKind.String ||
            member.GetString() is not { Length: > 0 } text ||
            text.Length > maximumLength)
        {
            throw new InvalidDataException($"The browser game save {property} is invalid.");
        }
    }

    private static void RequireMember(
        JsonElement value,
        string property,
        params string[] members)
    {
        var member = value.GetProperty(property);
        if (member.ValueKind != JsonValueKind.String ||
            !members.Contains(member.GetString(), StringComparer.Ordinal))
        {
            throw new InvalidDataException($"The browser game save {property} is invalid.");
        }
    }

    private static int CountNodes(JsonElement value, int count)
    {
        count++;
        if (count > MaxNodes)
        {
            return count;
        }
        if (value.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in value.EnumerateArray())
            {
                count = CountNodes(item, count);
                if (count > MaxNodes)
                {
                    break;
                }
            }
        }
        else if (value.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in value.EnumerateObject())
            {
                count = CountNodes(property.Value, count);
                if (count > MaxNodes)
                {
                    break;
                }
            }
        }
        return count;
    }
}
