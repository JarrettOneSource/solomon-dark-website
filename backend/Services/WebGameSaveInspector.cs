using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SolomonDarkRevived.Services;

public sealed record WebGameSaveInspection(int FormatVersion, long Size, string Sha256);

public static class WebGameSaveInspector
{
    public const int FormatVersion = 25;
    private static readonly int[] LegacyFormatVersions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
    public const int MaxDocumentBytes = 16 * 1024 * 1024;
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
            throw new InvalidDataException("Browser game saves may not exceed 16 MiB.");
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
                    version >= 17
                        ? [
                            "continuation",
                            "integrity",
                            "mods",
                            "modState",
                            "nativeSource",
                            "profile",
                            "schemaVersion"
                        ]
                        : [
                            "continuation",
                            "integrity",
                            "mods",
                            "modState",
                            "profile",
                            "schemaVersion"
                        ]);
                if (version >= 17)
                {
                    ValidateNativeSource(root.GetProperty("nativeSource"));
                }
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
                        version >= 10,
                        version >= 12);
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
        bool includesPartyRejoin,
        bool signedPartyRejoin)
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
                 !IsPartyRejoinToken(token.GetString(), signedPartyRejoin)))
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

    private static bool IsPartyRejoinToken(string? value, bool signed)
    {
        if (value is null) return false;
        if (!signed)
        {
            return value is { Length: 43 } && value.All(IsBase64UrlCharacter);
        }
        var parts = value.Split('.');
        return value.Length <= 8_192 &&
            parts.Length == 3 &&
            parts[0] is "sdrpr1" or "sdrpr2" &&
            parts[1].Length > 0 &&
            parts[2].Length == 43 &&
            parts[1].All(IsBase64UrlCharacter) &&
            parts[2].All(IsBase64UrlCharacter);
    }

    private static void ValidateNativeSource(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Null)
        {
            return;
        }
        var source = RequireObject(value, "browser game save native source");
        RequireExactProperties(
            source,
            "browser game save native source",
            "darkdataBase64",
            "darkdataSha256",
            "gamestateBase64",
            "gamestateSha256",
            "retainedFiles",
            "runName");
        RequireString(source, "darkdataBase64", 11 * 1024 * 1024);
        RequireString(source, "gamestateBase64", 11 * 1024 * 1024);
        RequireString(source, "darkdataSha256", 64);
        RequireString(source, "gamestateSha256", 64);
        RequireString(source, "runName", 64);
        var darkdata = source.GetProperty("darkdataBase64").GetString()!;
        var gamestate = source.GetProperty("gamestateBase64").GetString()!;
        var darkdataSha256 = source.GetProperty("darkdataSha256").GetString();
        var gamestateSha256 = source.GetProperty("gamestateSha256").GetString();
        if (darkdata.Length + gamestate.Length > 11 * 1024 * 1024 ||
            !IsSafeRunName(source.GetProperty("runName").GetString()))
        {
            throw new InvalidDataException("The browser game save native source is invalid.");
        }
        var totalBytes = DecodeNativeSourceFile(darkdata, darkdataSha256, allowEmpty: false);
        totalBytes += DecodeNativeSourceFile(gamestate, gamestateSha256, allowEmpty: false);
        var retainedFiles = source.GetProperty("retainedFiles");
        if (retainedFiles.ValueKind != JsonValueKind.Array || retainedFiles.GetArrayLength() > 253)
        {
            throw new InvalidDataException("The browser game save retained files are invalid.");
        }
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var retainedValue in retainedFiles.EnumerateArray())
        {
            var file = RequireObject(retainedValue, "browser game save retained file");
            RequireExactProperties(
                file,
                "browser game save retained file",
                "base64",
                "path",
                "sha256");
            var base64 = file.GetProperty("base64");
            var path = file.GetProperty("path");
            var sha256 = file.GetProperty("sha256");
            if (base64.ValueKind != JsonValueKind.String ||
                path.ValueKind != JsonValueKind.String ||
                sha256.ValueKind != JsonValueKind.String ||
                !IsSafeRetainedPath(path.GetString()) ||
                !paths.Add(path.GetString()!))
            {
                throw new InvalidDataException("The browser game save retained file is invalid.");
            }
            totalBytes += DecodeNativeSourceFile(
                base64.GetString()!,
                sha256.GetString(),
                allowEmpty: true);
        }
        if (totalBytes > 8 * 1024 * 1024)
        {
            throw new InvalidDataException("The browser game save native source is too large.");
        }
    }

    private static int DecodeNativeSourceFile(
        string base64,
        string? expectedSha256,
        bool allowEmpty)
    {
        if ((!allowEmpty && base64.Length == 0) ||
            (base64.Length > 0 && !IsBase64(base64)) ||
            !IsLowerSha256(expectedSha256))
        {
            throw new InvalidDataException("The browser game save native source is invalid.");
        }
        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(base64);
        }
        catch (FormatException error)
        {
            throw new InvalidDataException(
                "The browser game save native source is invalid.",
                error);
        }
        var actualSha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        if (!string.Equals(Convert.ToBase64String(bytes), base64, StringComparison.Ordinal) ||
            !string.Equals(actualSha256, expectedSha256, StringComparison.Ordinal))
        {
            throw new InvalidDataException("The browser game save native source hash is invalid.");
        }
        return bytes.Length;
    }

    private static bool IsSafeRetainedPath(string? value)
    {
        if (value is not { Length: > 0 and <= 512 } ||
            value.Contains('\\') ||
            value.Contains(':') ||
            value.StartsWith('/') ||
            value.EndsWith('/') ||
            value.Any(char.IsControl))
        {
            return false;
        }
        var parts = value.Split('/');
        if (parts.Any(part => part.Length == 0 || part is "." or "..") ||
            !value.StartsWith("solomondark/", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("solomondark/darkdata.cfg", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("solomondark/settings.txt", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
        return !(parts.Length >= 4 &&
            parts[0].Equals("solomondark", StringComparison.OrdinalIgnoreCase) &&
            parts[1].Equals("savegames", StringComparison.OrdinalIgnoreCase) &&
            parts[^1].Equals("gamestate.sav", StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsBase64(string value)
    {
        if (value.Length == 0 || value.Length % 4 != 0)
        {
            return false;
        }
        var padding = value.EndsWith("==", StringComparison.Ordinal)
            ? 2
            : value.EndsWith('=') ? 1 : 0;
        return value[..(value.Length - padding)].All(character =>
                character is >= 'A' and <= 'Z' or
                >= 'a' and <= 'z' or
                >= '0' and <= '9' or
                '+' or '/') &&
            value[(value.Length - padding)..].All(character => character == '=');
    }

    private static bool IsLowerSha256(string? value) =>
        value is { Length: 64 } &&
        value.All(character =>
            character is >= '0' and <= '9' or
            >= 'a' and <= 'f');

    private static bool IsSafeRunName(string? value) =>
        value is { Length: > 0 and <= 64 } &&
        value.All(character =>
            char.IsAsciiLetterOrDigit(character) ||
            character is '.' or '_' or '-');

    private static bool IsBase64UrlCharacter(char character) =>
        character is >= 'A' and <= 'Z' or
        >= 'a' and <= 'z' or
        >= '0' and <= '9' or
        '_' or '-';

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
