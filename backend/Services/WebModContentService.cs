using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;

namespace SolomonDarkRevived.Services;

public sealed record WebModBoneyard(string Target, string BytesBase64);
public sealed record WebModPackageFile(
    string Path,
    string Kind,
    string ContentType,
    string BytesBase64,
    int ByteLength,
    string Sha256);

public sealed record WebResolvedMod(
    string Id,
    string Name,
    string Slug,
    string Version,
    string ContentSha256,
    int Priority,
    string? EntryScript,
    IReadOnlyList<WebModBoneyard> Boneyards,
    IReadOnlyList<WebModPackageFile> Files);

public sealed record WebSessionContent(
    string ManifestSha256,
    IReadOnlyList<WebResolvedMod> Mods);

public sealed record WebDisabledMod(string Name, string Slug, string Error);

public sealed record WebModContentResolution(
    WebSessionContent Content,
    IReadOnlyList<WebDisabledMod> DisabledMods);

public sealed class WebModContentException(string message) : Exception(message);

public sealed class WebModContentService(
    AppDb db,
    StorageService storage,
    ILogger<WebModContentService> logger)
{
    public const int MaxActiveMods = 128;
    public const int MaxActiveLuaMods = 8;
    private const int MaxEntryScriptBytes = 256 * 1024;
    private const int MaxBoneyardBytes = 8 * 1024 * 1024;
    private const int MaxPackageFileBytes = 16 * 1024 * 1024;
    private const int MaxPackageFiles = 256;
    private const int MaxPackageFilesBytes = 32 * 1024 * 1024;
    private const int MaxProvisionedContentBytes = 32 * 1024 * 1024;

    public async Task<WebModContentResolution> ResolveAsync(
        int? userId,
        bool recordDownloads = false,
        CancellationToken cancellationToken = default)
    {
        if (userId is null)
        {
            return new WebModContentResolution(
                new WebSessionContent(new string('0', 64), []),
                []);
        }

        var subscriptions = await db.ModSubscriptions
            .Where(subscription => subscription.UserId == userId && subscription.Enabled)
            .Include(subscription => subscription.Mod)
                .ThenInclude(mod => mod.Versions)
            .AsSplitQuery()
            .OrderBy(subscription => subscription.Id)
            .ToArrayAsync(cancellationToken);
        var disabled = new List<WebDisabledMod>();
        var subscriptionsByModId = subscriptions.ToDictionary(
            subscription => subscription.ModId);

        foreach (var subscription in subscriptions.Skip(MaxActiveMods))
        {
            Disable(
                subscription,
                $"{subscription.Mod.Name} was disabled because at most {MaxActiveMods} mods may be active at once.",
                disabled);
        }

        var loaded = new List<LoadedPackage>(Math.Min(subscriptions.Length, MaxActiveMods));
        foreach (var subscription in subscriptions.Take(MaxActiveMods))
        {
            try
            {
                loaded.Add(await LoadPackageAsync(subscription.Mod, cancellationToken));
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception) when (IsPackageLoadFailure(exception))
            {
                var error = exception is WebModContentException
                    ? exception.Message
                    : $"{subscription.Mod.Name} could not load its stored package.";
                Disable(subscription, error, disabled);
                logger.LogWarning(
                    exception,
                    "Disabled invalid active mod {ModId} ({ModSlug}).",
                    subscription.ModId,
                    subscription.Mod.Slug);
            }
        }

        var duplicateIds = loaded
            .GroupBy(package => package.Id, StringComparer.OrdinalIgnoreCase)
            .SelectMany(group => group.Skip(1))
            .ToArray();
        foreach (var package in duplicateIds)
        {
            Disable(
                subscriptionsByModId[package.ModId],
                $"{package.Name} was disabled because another active mod uses package id {package.Id}.",
                disabled);
        }
        loaded.RemoveAll(package => duplicateIds.Contains(package));

        IReadOnlyList<LoadedPackage> ordered;
        while (true)
        {
            var packageIds = loaded
                .Select(package => package.Id)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var missingDependencies = loaded
                .Select(package => new
                {
                    Package = package,
                    Missing = package.RequiredMods.FirstOrDefault(required => !packageIds.Contains(required))
                })
                .Where(candidate => candidate.Missing is not null)
                .ToArray();
            if (missingDependencies.Length > 0)
            {
                foreach (var candidate in missingDependencies)
                {
                    Disable(
                        subscriptionsByModId[candidate.Package.ModId],
                        $"{candidate.Package.Name} requires {candidate.Missing}. Subscribe to and enable it first.",
                        disabled);
                }
                loaded.RemoveAll(package => missingDependencies.Any(candidate =>
                    candidate.Package.ModId == package.ModId));
                continue;
            }

            var dependencyOrder = DependencyOrder(loaded);
            if (dependencyOrder.Rejected.Count > 0)
            {
                foreach (var package in dependencyOrder.Rejected)
                {
                    Disable(
                        subscriptionsByModId[package.ModId],
                        $"{package.Name} was disabled because its active mod dependency graph is invalid.",
                        disabled);
                }
                loaded.RemoveAll(package => dependencyOrder.Rejected.Contains(package));
                continue;
            }

            var luaOverflow = dependencyOrder.Ordered
                .Where(package => package.EntryScript is not null)
                .Skip(MaxActiveLuaMods)
                .ToArray();
            if (luaOverflow.Length > 0)
            {
                foreach (var package in luaOverflow)
                {
                    Disable(
                        subscriptionsByModId[package.ModId],
                        $"{package.Name} was disabled because at most {MaxActiveLuaMods} Lua mods may be active at once.",
                        disabled);
                }
                loaded.RemoveAll(package => luaOverflow.Contains(package));
                continue;
            }

            var totalBytes = dependencyOrder.Ordered.Sum(PackageByteCount);
            if (totalBytes > MaxProvisionedContentBytes)
            {
                var package = dependencyOrder.Ordered[^1];
                Disable(
                    subscriptionsByModId[package.ModId],
                    $"{package.Name} was disabled because the active mod set is too large for one web game session.",
                    disabled);
                loaded.Remove(package);
                continue;
            }

            ordered = dependencyOrder.Ordered;
            break;
        }

        if (disabled.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        if (recordDownloads && ordered.Count > 0)
        {
            var modIds = ordered.Select(package => package.ModId).ToArray();
            var versionIds = ordered.Select(package => package.VersionId).ToArray();
            await db.Mods.Where(mod => modIds.Contains(mod.Id))
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(mod => mod.Downloads, mod => mod.Downloads + 1),
                    cancellationToken);
            await db.ModVersions.Where(version => versionIds.Contains(version.Id))
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(
                        version => version.Downloads,
                        version => version.Downloads + 1),
                    cancellationToken);
            var downloadedAtUtc = DateTime.UtcNow;
            db.ModDownloadEvents.AddRange(modIds.Select(modId => new ModDownloadEvent
            {
                ModId = modId,
                DownloadedAtUtc = downloadedAtUtc
            }));
            await db.SaveChangesAsync(cancellationToken);
            await db.ModDownloadEvents
                .Where(download => download.DownloadedAtUtc < downloadedAtUtc.AddDays(-180))
                .ExecuteDeleteAsync(cancellationToken);
        }
        var resolved = new List<WebResolvedMod>(ordered.Count);
        foreach (var package in ordered)
        {
            var files = new List<WebModPackageFile>(package.Files.Count);
            foreach (var file in package.Files)
            {
                var stored = await storage.SaveGameContentAsync(
                    file.Bytes,
                    file.ContentType,
                    cancellationToken);
                files.Add(new WebModPackageFile(
                    file.Path,
                    file.Kind,
                    file.ContentType,
                    Convert.ToBase64String(file.Bytes),
                    stored.ByteLength,
                    stored.Sha256));
            }
            resolved.Add(new WebResolvedMod(
                package.Id,
                package.Name,
                package.Slug,
                package.Version,
                package.ContentSha256,
                package.Priority,
                package.EntryScript,
                package.Boneyards.Select(boneyard => new WebModBoneyard(
                    boneyard.Target,
                    Convert.ToBase64String(boneyard.Bytes))).ToArray(),
                files));
        }
        return new WebModContentResolution(
            new WebSessionContent(ManifestSha256(resolved), resolved),
            disabled);
    }

    private static void Disable(
        ModSubscription subscription,
        string error,
        ICollection<WebDisabledMod> disabled)
    {
        if (!subscription.Enabled)
        {
            return;
        }
        subscription.Enabled = false;
        subscription.UpdatedAtUtc = DateTime.UtcNow;
        disabled.Add(new WebDisabledMod(subscription.Mod.Name, subscription.Mod.Slug, error));
    }

    private static bool IsPackageLoadFailure(Exception exception) => exception is
        WebModContentException or
        IOException or
        UnauthorizedAccessException or
        JsonException or
        DecoderFallbackException or
        InvalidDataException or
        InvalidOperationException or
        KeyNotFoundException or
        ArgumentException;

    private static int PackageByteCount(LoadedPackage package) =>
        Encoding.UTF8.GetByteCount(package.EntryScript ?? string.Empty) +
        package.Boneyards.Sum(boneyard => boneyard.ByteCount) +
        package.Files.Sum(file => file.ByteCount);

    private async Task<LoadedPackage> LoadPackageAsync(
        Mod mod,
        CancellationToken cancellationToken)
    {
        var version = mod.Versions
            .Where(candidate =>
                !string.IsNullOrWhiteSpace(candidate.ManifestVersion) &&
                !string.IsNullOrWhiteSpace(candidate.PackageSha256) &&
                !string.IsNullOrWhiteSpace(candidate.ContentSha256) &&
                !string.IsNullOrWhiteSpace(candidate.FileName))
            .OrderByDescending(candidate => candidate.CreatedAtUtc)
            .ThenByDescending(candidate => candidate.Id)
            .FirstOrDefault();
        if (version is null || string.IsNullOrWhiteSpace(mod.PackageId))
        {
            throw new WebModContentException($"{mod.Name} has no runnable web-port package.");
        }

        var packagePath = storage.GetModFilePath(version.FileName);
        await using var packageStream = File.OpenRead(packagePath);
        ModPackageInspection inspection;
        try
        {
            inspection = await ModPackageInspector.InspectAsync(packageStream, cancellationToken);
        }
        catch (ModPackageValidationException exception)
        {
            throw new WebModContentException(
                $"{mod.Name} has an incompatible package: {exception.Message}");
        }
        if (!string.Equals(inspection.PackageId, mod.PackageId, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(inspection.ManifestVersion, version.ManifestVersion, StringComparison.Ordinal) ||
            !string.Equals(inspection.PackageSha256, version.PackageSha256, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(inspection.ContentSha256, version.ContentSha256, StringComparison.OrdinalIgnoreCase))
        {
            throw new WebModContentException($"{mod.Name} failed its stored package identity check.");
        }

        packageStream.Position = 0;
        using var archive = new ZipArchive(packageStream, ZipArchiveMode.Read, leaveOpen: true);
        var manifestEntry = archive.GetEntry("manifest.json")!;
        using var manifestDocument = await ReadJsonAsync(manifestEntry, cancellationToken);
        var manifest = manifestDocument.RootElement;
        var entryScript = await ReadEntryScriptAsync(manifest, archive, cancellationToken);
        var boneyards = await ReadBoneyardsAsync(manifest, archive, cancellationToken);
        var files = await ReadPackageFilesAsync(archive, cancellationToken);
        return new LoadedPackage(
            mod.Id,
            version.Id,
            inspection.PackageId,
            mod.Name,
            mod.Slug,
            inspection.ManifestVersion,
            inspection.ContentSha256.ToLowerInvariant(),
            inspection.Priority,
            inspection.RequiredMods,
            entryScript,
            boneyards,
            files);
    }

    private static async Task<JsonDocument> ReadJsonAsync(
        ZipArchiveEntry entry,
        CancellationToken cancellationToken)
    {
        await using var stream = entry.Open();
        return await JsonDocument.ParseAsync(
            stream,
            new JsonDocumentOptions { MaxDepth = 16 },
            cancellationToken);
    }

    private static async Task<string?> ReadEntryScriptAsync(
        JsonElement manifest,
        ZipArchive archive,
        CancellationToken cancellationToken)
    {
        if (!manifest.TryGetProperty("runtime", out var runtime) ||
            !runtime.TryGetProperty("entryScript", out var entryScriptElement) ||
            entryScriptElement.ValueKind != JsonValueKind.String)
        {
            return null;
        }
        var path = entryScriptElement.GetString()!;
        var entry = archive.GetEntry(path) ??
            throw new WebModContentException($"The mod entry script is missing: {path}");
        if (entry.Length > MaxEntryScriptBytes)
        {
            throw new WebModContentException($"The mod entry script is too large: {path}");
        }
        await using var stream = entry.Open();
        using var reader = new StreamReader(
            stream,
            new UTF8Encoding(false, true),
            detectEncodingFromByteOrderMarks: false,
            leaveOpen: false);
        return await reader.ReadToEndAsync(cancellationToken);
    }

    private static async Task<IReadOnlyList<LoadedBoneyard>> ReadBoneyardsAsync(
        JsonElement manifest,
        ZipArchive archive,
        CancellationToken cancellationToken)
    {
        if (!manifest.TryGetProperty("overlays", out var overlays) ||
            overlays.ValueKind != JsonValueKind.Array)
        {
            return [];
        }
        var boneyards = new List<LoadedBoneyard>();
        foreach (var overlay in overlays.EnumerateArray())
        {
            var target = overlay.GetProperty("target").GetString()!;
            if (!target.EndsWith(".boneyard", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            var source = overlay.GetProperty("source").GetString()!;
            var entry = archive.GetEntry(source) ??
                throw new WebModContentException($"The mod Boneyard is missing: {source}");
            if (entry.Length > MaxBoneyardBytes)
            {
                throw new WebModContentException($"The mod Boneyard is too large: {source}");
            }
            await using var stream = entry.Open();
            using var buffer = new MemoryStream((int)entry.Length);
            await stream.CopyToAsync(buffer, cancellationToken);
            boneyards.Add(new LoadedBoneyard(target, buffer.ToArray()));
        }
        return boneyards;
    }

    private static async Task<IReadOnlyList<LoadedPackageFile>> ReadPackageFilesAsync(
        ZipArchive archive,
        CancellationToken cancellationToken)
    {
        var entries = archive.Entries
            .Select(entry => (Entry: entry, Asset: PackageAsset(entry.FullName)))
            .Where(candidate => candidate.Asset is not null)
            .OrderBy(candidate => candidate.Entry.FullName, StringComparer.Ordinal)
            .ToArray();
        if (entries.Length > MaxPackageFiles)
        {
            throw new WebModContentException(
                $"A web mod may provision at most {MaxPackageFiles} typed asset files.");
        }
        var files = new List<LoadedPackageFile>(entries.Length);
        var totalBytes = 0;
        foreach (var candidate in entries)
        {
            var entry = candidate.Entry;
            var asset = candidate.Asset!;
            if (entry.Length <= 0 || entry.Length > MaxPackageFileBytes)
            {
                throw new WebModContentException(
                    $"The mod asset file has an invalid size: {entry.FullName}");
            }
            totalBytes = checked(totalBytes + (int)entry.Length);
            if (totalBytes > MaxPackageFilesBytes)
            {
                throw new WebModContentException(
                    "The mod asset files exceed the 32 MiB web-session limit.");
            }
            await using var source = entry.Open();
            using var destination = new MemoryStream((int)entry.Length);
            await source.CopyToAsync(destination, cancellationToken);
            files.Add(new LoadedPackageFile(
                entry.FullName,
                asset.Value.Kind,
                asset.Value.ContentType,
                destination.ToArray()));
        }
        return files;
    }

    private static (string Kind, string ContentType)? PackageAsset(string path)
    {
        var extension = Path.GetExtension(path);
        if (path.StartsWith("sprites/", StringComparison.Ordinal) ||
            path.StartsWith("art/", StringComparison.Ordinal))
        {
            return extension switch
            {
                ".png" => ("image", "image/png"),
                ".bundle" => ("sprite-bundle", "application/vnd.solomon-dark.sprite-bundle"),
                ".json" => ("art-metadata", "application/json"),
                _ => null
            };
        }
        if (path.StartsWith("audio/", StringComparison.Ordinal))
        {
            return extension switch
            {
                ".ogg" => ("audio", "audio/ogg"),
                ".wav" => ("audio", "audio/wav"),
                ".mp3" => ("audio", "audio/mpeg"),
                _ => null
            };
        }
        if (path.StartsWith("levels/", StringComparison.Ordinal))
        {
            return extension switch
            {
                ".boneyard" => ("boneyard", "application/vnd.solomon-dark.boneyard"),
                ".json" => ("level-metadata", "application/json"),
                _ => null
            };
        }
        if (path.StartsWith("scenes/", StringComparison.Ordinal) && extension == ".json")
        {
            return ("scene", "application/json");
        }
        return null;
    }

    private static DependencyOrderResult DependencyOrder(
        IReadOnlyList<LoadedPackage> packages)
    {
        var emitted = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var ordered = new List<LoadedPackage>(packages.Count);
        while (ordered.Count < packages.Count)
        {
            var next = packages
                .Where(package => !emitted.Contains(package.Id) &&
                    package.RequiredMods.All(emitted.Contains))
                .OrderBy(package => package.Priority)
                .ThenBy(package => package.Id, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();
            if (next is null)
            {
                return new DependencyOrderResult(
                    ordered,
                    packages.Where(package => !emitted.Contains(package.Id)).ToArray());
            }
            emitted.Add(next.Id);
            ordered.Add(next);
        }
        return new DependencyOrderResult(ordered, []);
    }

    private static string ManifestSha256(IReadOnlyList<WebResolvedMod> mods)
    {
        if (mods.Count == 0) return new string('0', 64);
        var canonical = string.Concat(mods.Select(mod =>
            $"{mod.Id}\0{mod.Version}\0{mod.ContentSha256}\n"));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)))
            .ToLowerInvariant();
    }

    private sealed record LoadedBoneyard(string Target, byte[] Bytes)
    {
        public int ByteCount => Bytes.Length;
    }

    private sealed record LoadedPackageFile(
        string Path,
        string Kind,
        string ContentType,
        byte[] Bytes)
    {
        public int ByteCount => Bytes.Length;
    }

    private sealed record LoadedPackage(
        int ModId,
        int VersionId,
        string Id,
        string Name,
        string Slug,
        string Version,
        string ContentSha256,
        int Priority,
        IReadOnlyList<string> RequiredMods,
        string? EntryScript,
        IReadOnlyList<LoadedBoneyard> Boneyards,
        IReadOnlyList<LoadedPackageFile> Files);

    private sealed record DependencyOrderResult(
        IReadOnlyList<LoadedPackage> Ordered,
        IReadOnlyList<LoadedPackage> Rejected);
}
