namespace SolomonDarkRevived.Services;

/// <summary>
/// Validates an authored data/wave.txt schedule with the same acceptance rules
/// as the mod loader's wave reader (wave_intelligence.cpp), so a published
/// package can never fail Lua-engine initialization on players' machines:
/// WAVE/ENDWAVE blocks, NEXT/SPAWN/SPAWNDELAY/WAVEDELAY/MAXENEMIES/ZOMBIEWAVE
/// directives, GROUP/FORMATION monster lines, the eight retail enemy tokens,
/// and a positive spawn budget with at least one enemy entry per wave.
/// </summary>
public static class WaveScheduleValidator
{
    public const int MaxWaveTextBytes = 256 * 1024;
    private const int MaxCompositionRows = 20;

    private static readonly HashSet<string> EnemyTokens = new(StringComparer.Ordinal)
    {
        "SKELETON",
        "SKELETONARCHER",
        "SKELETONMAGE",
        "IMP",
        "ZOMBIE",
        "WRAITH",
        "DEMON",
        "COFFIN",
    };

    /// <summary>Returns null when the schedule is acceptable, otherwise a
    /// player-readable reason.</summary>
    public static string? Validate(string text)
    {
        text = text.TrimStart('﻿');
        if (text.Length == 0)
        {
            return "The wave schedule is empty.";
        }

        var waveCount = 0;
        var inWave = false;
        var inGroup = false;
        var spawn = 0;
        var enemyLines = 0;
        var distinctEnemies = new HashSet<string>(StringComparer.Ordinal);

        string? FinishWave(int lineNumber)
        {
            if (!inWave)
            {
                return null;
            }
            if (spawn <= 0)
            {
                return $"Wave ending near line {lineNumber} has no positive SPAWN budget.";
            }
            if (enemyLines == 0)
            {
                return $"Wave ending near line {lineNumber} has no enemy entries.";
            }
            if (distinctEnemies.Count > MaxCompositionRows)
            {
                return $"Wave ending near line {lineNumber} uses too many distinct enemy types.";
            }
            waveCount++;
            inWave = false;
            inGroup = false;
            spawn = 0;
            enemyLines = 0;
            distinctEnemies.Clear();
            return null;
        }

        var lines = text.Split('\n');
        for (var index = 0; index < lines.Length; index++)
        {
            var lineNumber = index + 1;
            var line = lines[index].Trim().ToUpperInvariant();
            if (line.Length == 0 || line[0] is '#' or ';')
            {
                continue;
            }

            bool Directive(string name) =>
                line == name || line.StartsWith(name + ":", StringComparison.Ordinal);

            if (Directive("WAVE"))
            {
                var error = FinishWave(lineNumber);
                if (error is not null)
                {
                    return error;
                }
                inWave = true;
                continue;
            }
            if (line == "ENDWAVE")
            {
                var error = FinishWave(lineNumber);
                if (error is not null)
                {
                    return error;
                }
                continue;
            }
            if (!inWave)
            {
                return $"Wave schedule content before the first WAVE at line {lineNumber}.";
            }
            if (line is "GROUP" or "FORMATION")
            {
                inGroup = true;
                continue;
            }
            if (line == "ZOMBIEWAVE")
            {
                continue;
            }
            if (Directive("NEXT"))
            {
                inGroup = false;
                continue;
            }
            if (Directive("SPAWN"))
            {
                inGroup = false;
                if (!int.TryParse(Value(line), out spawn))
                {
                    return $"Invalid SPAWN value at line {lineNumber}.";
                }
                continue;
            }
            if (Directive("SPAWNDELAY") || Directive("WAVEDELAY"))
            {
                inGroup = false;
                if (!TryParseRange(Value(line)))
                {
                    return $"Invalid delay range at line {lineNumber}.";
                }
                continue;
            }
            if (Directive("MAXENEMIES"))
            {
                inGroup = false;
                if (!int.TryParse(Value(line), out var maxEnemies) || maxEnemies < 0)
                {
                    return $"Invalid MAXENEMIES value at line {lineNumber}.";
                }
                continue;
            }
            if (!inGroup)
            {
                return $"Unknown wave directive at line {lineNumber}: {line}";
            }

            var separator = line.IndexOf(':');
            var token = (separator < 0 ? line : line[..separator]).Trim();
            if (!EnemyTokens.Contains(token))
            {
                return $"Unknown wave enemy token at line {lineNumber}: {token}";
            }
            enemyLines++;
            distinctEnemies.Add(token);
        }

        var finalError = FinishWave(lines.Length);
        if (finalError is not null)
        {
            return finalError;
        }
        if (waveCount == 0)
        {
            return "The wave schedule declares no waves.";
        }
        return null;
    }

    private static string Value(string line)
    {
        var separator = line.IndexOf(':');
        return separator < 0 ? string.Empty : line[(separator + 1)..].Trim();
    }

    private static bool TryParseRange(string value)
    {
        var separator = value.IndexOf('-');
        return separator > 0 &&
               int.TryParse(value[..separator].Trim(), out var minimum) &&
               int.TryParse(value[(separator + 1)..].Trim(), out var maximum) &&
               minimum >= 0 &&
               maximum >= minimum;
    }
}
