using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;

namespace SolomonDarkRevived.Services;

public sealed record WebModBoneyard(string Target, string BytesBase64);

public sealed record WebResolvedMod(
    string Id,
    string Name,
    string Slug,
    string Version,
    string ContentSha256,
    int Priority,
    string? EntryScript,
    IReadOnlyList<WebModBoneyard> Boneyards);

public sealed record WebSessionContent(
    string ManifestSha256,
    IReadOnlyList<WebResolvedMod> Mods);

public sealed class WebModContentException(string message) : Exception(message);

public sealed class WebModContentService(AppDb db, StorageService storage)
{
    public const int MaxActiveMods = 128;
    public const int MaxActiveLuaMods = 8;
    private const int MaxEntryScriptBytes = 256 * 1024;
    private const int MaxBoneyardBytes = 8 * 1024 * 1024;
    private const int MaxProvisionedContentBytes = 32 * 1024 * 1024;

    public async Task<WebSessionContent> ResolveAsync(
        int? userId,
        bool recordDownloads = false,
        CancellationToken cancellationToken = default)
    {
        if (userId is null)
        {
            return new WebSessionContent(new string('0', 64), []);
        }

        var subscriptions = await db.ModSubscriptions.AsNoTracking()
            .Where(subscription => subscription.UserId == userId && subscription.Enabled)
            .Include(subscription => subscription.Mod)
                .ThenInclude(mod => mod.Versions)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);
        if (subscriptions.Length > MaxActiveMods)
        {
            throw new WebModContentException($"At most {MaxActiveMods} mods may be active at once.");
        }

        var loaded = new List<LoadedPackage>(subscriptions.Length);
        foreach (var subscription in subscriptions)
        {
            loaded.Add(await LoadPackageAsync(subscription.Mod, cancellationToken));
        }
        if (loaded.Count(package => package.EntryScript is not null) > MaxActiveLuaMods)
        {
            throw new WebModContentException(
                $"At most {MaxActiveLuaMods} Lua mods may be active at once.");
        }
        var ordered = DependencyOrder(loaded);
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
        var totalBytes = ordered.Sum(package =>
            Encoding.UTF8.GetByteCount(package.EntryScript ?? string.Empty) +
            package.Boneyards.Sum(boneyard => boneyard.ByteCount));
        if (totalBytes > MaxProvisionedContentBytes)
        {
            throw new WebModContentException(
                "The active mod set is too large for one web game session.");
        }

        var resolved = ordered.Select(package => new WebResolvedMod(
            package.Id,
            package.Name,
            package.Slug,
            package.Version,
            package.ContentSha256,
            package.Priority,
            package.EntryScript,
            package.Boneyards.Select(boneyard => new WebModBoneyard(
                boneyard.Target,
                Convert.ToBase64String(boneyard.Bytes))).ToArray())).ToArray();
        return new WebSessionContent(ManifestSha256(resolved), resolved);
    }

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
        var inspection = await ModPackageInspector.InspectAsync(packageStream, cancellationToken);
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
            boneyards);
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

    private static IReadOnlyList<LoadedPackage> DependencyOrder(
        IReadOnlyList<LoadedPackage> packages)
    {
        var byId = new Dictionary<string, LoadedPackage>(StringComparer.OrdinalIgnoreCase);
        foreach (var package in packages)
        {
            if (!byId.TryAdd(package.Id, package))
            {
                throw new WebModContentException($"The active mod id is duplicated: {package.Id}");
            }
        }
        foreach (var package in packages)
        {
            var missing = package.RequiredMods.FirstOrDefault(required => !byId.ContainsKey(required));
            if (missing is not null)
            {
                throw new WebModContentException(
                    $"{package.Name} requires {missing}. Subscribe to and enable it first.");
            }
        }

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
                throw new WebModContentException("The active mod dependency graph contains a cycle.");
            }
            emitted.Add(next.Id);
            ordered.Add(next);
        }
        return ordered;
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
        IReadOnlyList<LoadedBoneyard> Boneyards);
}
