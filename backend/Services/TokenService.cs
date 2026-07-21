using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using SolomonDarkRevived.Data;

namespace SolomonDarkRevived.Services;

public sealed class TokenService(string secret, int expiryDays)
{
    private const string SteamSessionType = "steam-directory";
    private const string SteamSessionTypeClaim = "sdr_token_type";
    private const string SteamIdClaim = "steam_id";
    private const string SteamAppIdClaim = "steam_appid";
    private static readonly TimeSpan SteamSessionLifetime = TimeSpan.FromMinutes(15);
    private readonly SymmetricSecurityKey _key = new(Encoding.UTF8.GetBytes(secret));
    private readonly int _expiryDays = expiryDays;

    public string Create(User user)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username)
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddDays(_expiryDays),
            signingCredentials: new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public IssuedSteamSession CreateSteamSession(string steamId)
    {
        var expiresAtUtc = DateTime.UtcNow.Add(SteamSessionLifetime);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, $"steam:{steamId}"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new Claim(SteamSessionTypeClaim, SteamSessionType),
            new Claim(SteamIdClaim, steamId),
            new Claim(SteamAppIdClaim, SteamApplication.AppIdText)
        };
        var token = new JwtSecurityToken(
            claims: claims,
            expires: expiresAtUtc,
            signingCredentials: new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));

        return new IssuedSteamSession(
            new JwtSecurityTokenHandler().WriteToken(token),
            steamId,
            expiresAtUtc);
    }

    public static int? GetUserId(ClaimsPrincipal principal)
    {
        var subject = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return int.TryParse(subject, out var userId) ? userId : null;
    }

    public static string? GetSteamSessionId(ClaimsPrincipal principal)
    {
        if (principal.FindFirstValue(SteamSessionTypeClaim) != SteamSessionType ||
            principal.FindFirstValue(SteamAppIdClaim) != SteamApplication.AppIdText)
        {
            return null;
        }

        var steamId = principal.FindFirstValue(SteamIdClaim);
        return ulong.TryParse(steamId, out var parsed) && parsed != 0
            ? parsed.ToString()
            : null;
    }

    public sealed record IssuedSteamSession(
        string Token,
        string SteamId,
        DateTime ExpiresAtUtc);
}
