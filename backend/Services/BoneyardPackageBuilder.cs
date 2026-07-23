using System.IO.Compression;
using System.Text;
using System.Text.Json;

namespace SolomonDarkRevived.Services;

internal static class BoneyardPackageBuilder
{
    public static MemoryStream Create(
        string launcherModId,
        string name,
        string slug,
        string version,
        ReadOnlySpan<byte> boneyard)
    {
        var fileName = PortableFileName(name, slug);
        var source = $"files/{fileName}";
        var target = $"sandbox/DarkCloud/mylevels/{fileName}";
        var manifest = new
        {
            id = launcherModId,
            name,
            version,
            priority = 100,
            overlays = new[]
            {
                new
                {
                    target,
                    source,
                    format = "boneyard"
                }
            },
            requiredMods = Array.Empty<string>()
        };

        var package = new MemoryStream();
        using (var archive = new ZipArchive(package, ZipArchiveMode.Create, leaveOpen: true))
        {
            var manifestEntry = archive.CreateEntry("manifest.json", CompressionLevel.Optimal);
            using (var writer = new StreamWriter(
                       manifestEntry.Open(),
                       new UTF8Encoding(encoderShouldEmitUTF8Identifier: false)))
            {
                writer.Write(JsonSerializer.Serialize(manifest));
            }

            var boneyardEntry = archive.CreateEntry(source, CompressionLevel.Optimal);
            using var destination = boneyardEntry.Open();
            destination.Write(boneyard);
        }

        package.Position = 0;
        return package;
    }

    private static string PortableFileName(string name, string slug)
    {
        var builder = new StringBuilder(Math.Min(name.Length, 100));
        foreach (var character in name)
        {
            if (builder.Length == 100)
            {
                break;
            }

            builder.Append(character < 0x20 || character is '<' or '>' or ':' or '"' or '/' or '\\' or '|' or '?' or '*'
                ? '-'
                : character);
        }

        var stem = builder.ToString().Trim().TrimEnd('.');
        if (stem.Length == 0 || IsWindowsDeviceName(stem))
        {
            stem = slug;
        }

        return $"{stem}.boneyard";
    }

    private static bool IsWindowsDeviceName(string value)
    {
        var stem = value.Split('.', 2)[0];
        if (stem.Equals("CON", StringComparison.OrdinalIgnoreCase) ||
            stem.Equals("PRN", StringComparison.OrdinalIgnoreCase) ||
            stem.Equals("AUX", StringComparison.OrdinalIgnoreCase) ||
            stem.Equals("NUL", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return stem.Length == 4 &&
               (stem.StartsWith("COM", StringComparison.OrdinalIgnoreCase) ||
                stem.StartsWith("LPT", StringComparison.OrdinalIgnoreCase)) &&
               stem[3] is >= '1' and <= '9';
    }
}
