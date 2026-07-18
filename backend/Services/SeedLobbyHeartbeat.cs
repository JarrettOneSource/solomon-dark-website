using System.Data.Common;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;

namespace SolomonDarkRevived.Services;

public sealed class SeedLobbyHeartbeat(
    IServiceScopeFactory scopeFactory,
    ILogger<SeedLobbyHeartbeat> logger) : BackgroundService
{
    private const string ManifestSha256 =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    private static readonly TimeSpan InitialDelay = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan TickInterval = TimeSpan.FromSeconds(45);
    private static readonly string ProcessSecret = RandomHex(32);
    private static readonly string ProcessPasswordSalt = RandomHex(16);
    private static readonly string ProcessPasswordHash = RandomHex(32);
    private static readonly SeedLobbyDefinition[] LobbyDefinitions =
    [
        new(
            LobbyId: "109775240000000101",
            HostSteamId: "76561199000000101",
            HostPlayer: "Machinimbus",
            Privacy: "public",
            Players: 3,
            Phase: "session",
            BoneyardId: "mount-awful",
            BoneyardName: "Mount Awful",
            Difficulty: "Grim",
            BaseWave: 23,
            BaseElapsedSeconds: 1380,
            StatusText: null),
        new(
            LobbyId: "109775240000000102",
            HostSteamId: "76561199000000102",
            HostPlayer: "Shlorio the Dowser",
            Privacy: "public",
            Players: 1,
            Phase: "hub",
            BoneyardId: "dratmoor",
            BoneyardName: "Dratmoor",
            Difficulty: null,
            BaseWave: null,
            BaseElapsedSeconds: null,
            StatusText: "Gathering by the gates — three chairs unclaimed."),
        new(
            LobbyId: "109775240000000103",
            HostSteamId: "76561199000000103",
            HostPlayer: "Fomentius",
            Privacy: "passwordProtected",
            Players: 2,
            Phase: "session",
            BoneyardId: "heck-hollow",
            BoneyardName: "Heck Hollow",
            Difficulty: "Merciless",
            BaseWave: 41,
            BaseElapsedSeconds: 2520,
            StatusText: null),
        new(
            LobbyId: "109775240000000104",
            HostSteamId: "76561199000000104",
            HostPlayer: "Provokatus the Annalist",
            Privacy: "public",
            Players: 4,
            Phase: "results",
            BoneyardId: "peasant-provinces",
            BoneyardName: "Peasant Provinces of Man",
            Difficulty: "Stately",
            BaseWave: 57,
            BaseElapsedSeconds: 3960,
            StatusText: null)
    ];
    private static readonly string[] LobbyIds =
        LobbyDefinitions.Select(definition => definition.LobbyId).ToArray();

    private int _tickCount;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(InitialDelay, stoppingToken);
            while (!stoppingToken.IsCancellationRequested)
            {
                await RunTickAsync(stoppingToken);
                await Task.Delay(TickInterval, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    private async Task RunTickAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            if (!await db.Users.AnyAsync(
                    user => user.Username == "Luthacus",
                    cancellationToken))
            {
                return;
            }

            _tickCount++;
            var now = DateTime.UtcNow;
            var existingLobbies = await db.Lobbies
                .Where(lobby => LobbyIds.Contains(lobby.LobbyId))
                .ToDictionaryAsync(lobby => lobby.LobbyId, cancellationToken);

            foreach (var definition in LobbyDefinitions)
            {
                if (!existingLobbies.TryGetValue(definition.LobbyId, out var lobby))
                {
                    lobby = new LobbySession
                    {
                        LobbyId = definition.LobbyId,
                        FirstSeenUtc = now,
                        Wave = definition.BaseWave,
                        ElapsedSeconds = definition.BaseElapsedSeconds
                    };
                    ApplyDefinition(lobby, definition, now);
                    db.Lobbies.Add(lobby);
                    continue;
                }

                ApplyDefinition(lobby, definition, now);
                ApplyLiveliness(lobby, definition);
            }

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            logger.LogDebug(exception, "Seed lobby heartbeat update raced another database operation.");
        }
        catch (DbException exception)
        {
            logger.LogDebug(exception, "Seed lobby heartbeat database operation failed transiently.");
        }
    }

    private static void ApplyDefinition(
        LobbySession lobby,
        SeedLobbyDefinition definition,
        DateTime now)
    {
        lobby.HostSteamId = definition.HostSteamId;
        lobby.HostPlayer = definition.HostPlayer;
        lobby.Privacy = definition.Privacy;
        lobby.Secret = ProcessSecret;
        lobby.PasswordSalt = definition.Privacy == "passwordProtected"
            ? ProcessPasswordSalt
            : null;
        lobby.PasswordHash = definition.Privacy == "passwordProtected"
            ? ProcessPasswordHash
            : null;
        lobby.FriendSteamIdsJson = "[]";
        lobby.Players = definition.Players;
        lobby.MaxPlayers = 4;
        lobby.AppId = 480;
        lobby.ProtocolVersion = 4;
        lobby.ManifestSha256 = ManifestSha256;
        lobby.LoaderVersion = "0.72.5";
        lobby.Phase = definition.Phase;
        lobby.BoneyardId = definition.BoneyardId;
        lobby.BoneyardName = definition.BoneyardName;
        lobby.BoneyardSha256 = null;
        lobby.Difficulty = definition.Difficulty;
        lobby.StatusText = definition.StatusText;
        lobby.LastSeenUtc = now;
    }

    private void ApplyLiveliness(LobbySession lobby, SeedLobbyDefinition definition)
    {
        if (definition.Phase == "session" &&
            definition.BaseWave is int baseWave &&
            definition.BaseElapsedSeconds is int baseElapsedSeconds)
        {
            var wave = lobby.Wave ?? baseWave;
            var elapsedSeconds = (lobby.ElapsedSeconds ?? baseElapsedSeconds) + 45;
            if (_tickCount % 3 == 0)
            {
                wave++;
            }

            if (wave > baseWave + 30)
            {
                wave = baseWave;
                elapsedSeconds = baseElapsedSeconds;
            }

            lobby.Wave = wave;
            lobby.ElapsedSeconds = elapsedSeconds;
            return;
        }

        lobby.Wave = definition.BaseWave;
        lobby.ElapsedSeconds = definition.BaseElapsedSeconds;
    }

    private static string RandomHex(int byteCount) =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(byteCount)).ToLowerInvariant();

    private sealed record SeedLobbyDefinition(
        string LobbyId,
        string HostSteamId,
        string HostPlayer,
        string Privacy,
        int Players,
        string Phase,
        string BoneyardId,
        string BoneyardName,
        string? Difficulty,
        int? BaseWave,
        int? BaseElapsedSeconds,
        string? StatusText);
}
