using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SolomonDarkRevived.Services;

public sealed record WebGameSaveInspection(long Size, string Sha256);

public static class WebGameSaveInspector
{
    public const int FormatVersion = 1;
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

        using (parsed)
        {
            var root = RequireObject(parsed.RootElement, "browser game save");
            RequireExactProperties(
                root,
                "browser game save",
                "loadedBoneyard",
                "schemaVersion",
                "simulation",
                "summary");
            if (!root.TryGetProperty("schemaVersion", out var schemaVersion) ||
                !schemaVersion.TryGetInt32(out var version) ||
                version != FormatVersion)
            {
                throw new InvalidDataException("The browser game save schema version is not supported.");
            }

            var summary = RequireObject(root.GetProperty("summary"), "browser game save summary");
            RequireExactProperties(
                summary,
                "browser game save summary",
                "character",
                "phase",
                "playerId",
                "savedAtTick",
                "worldKind");
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
            if (root.GetProperty("simulation").ValueKind != JsonValueKind.Object)
            {
                throw new InvalidDataException("The browser game save simulation is invalid.");
            }
            var worldKind = summary.GetProperty("worldKind").GetString();
            var loadedKind = root.GetProperty("loadedBoneyard").ValueKind;
            if ((worldKind == "hub" && loadedKind != JsonValueKind.Null) ||
                (worldKind == "boneyard" && loadedKind != JsonValueKind.Object))
            {
                throw new InvalidDataException("The browser game save world and Boneyard disagree.");
            }
            if (CountNodes(root, 0) > MaxNodes)
            {
                throw new InvalidDataException("The browser game save contains too many values.");
            }
        }

        return new WebGameSaveInspection(
            bytes.Length,
            Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
    }

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
