using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.WebUtilities;

namespace SolomonDarkRevived.Services;

public sealed class GameLeaderboardReceiptVerifier
{
    private const string Domain = "solomon-dark-leaderboard-v1.";
    private const int MaximumReceiptLength = 4096;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly byte[]? secret;

    public GameLeaderboardReceiptVerifier(IConfiguration configuration)
    {
        var configured = configuration["GameSessions:AdminSecret"]?.Trim();
        var bytes = string.IsNullOrEmpty(configured) ? null : Encoding.UTF8.GetBytes(configured);
        secret = bytes is { Length: >= 32 } ? bytes : null;
    }

    public bool Configured => secret is not null;

    public GameLeaderboardReceipt? Verify(string? receipt, int userId)
    {
        if (secret is null || string.IsNullOrEmpty(receipt) || receipt.Length > MaximumReceiptLength)
        {
            return null;
        }
        var separator = receipt.IndexOf('.');
        if (separator < 1 || separator != receipt.LastIndexOf('.') || separator == receipt.Length - 1)
        {
            return null;
        }
        var payloadPart = receipt[..separator];
        byte[] signature;
        byte[] payloadBytes;
        try
        {
            signature = WebEncoders.Base64UrlDecode(receipt[(separator + 1)..]);
            payloadBytes = WebEncoders.Base64UrlDecode(payloadPart);
        }
        catch (FormatException)
        {
            return null;
        }
        var signedBytes = Encoding.UTF8.GetBytes(Domain + payloadPart);
        var expected = HMACSHA256.HashData(secret, signedBytes);
        if (signature.Length != expected.Length ||
            !CryptographicOperations.FixedTimeEquals(signature, expected))
        {
            return null;
        }
        try
        {
            var payload = JsonSerializer.Deserialize<GameLeaderboardReceipt>(payloadBytes, JsonOptions);
            return payload is { Version: 1 } && payload.UserId == userId ? payload : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record GameLeaderboardReceipt(
    int Version,
    int UserId,
    string? RunId,
    string? WizardName,
    string? Element,
    string? Discipline,
    int HeadingIndex,
    double PortraitScale,
    int Level,
    int Awesomeness,
    int ElapsedTicks,
    int Wave,
    int MonstersKilled,
    string? AwesomestKill,
    GameLeaderboardReceiptSkill[]? HighestSkills,
    int[]? PerksUsed,
    DateTime CompletedAtUtc);

public sealed record GameLeaderboardReceiptSkill(int SkillId, int Rank);
