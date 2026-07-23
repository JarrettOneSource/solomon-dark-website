using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class SaveEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/saves", ListAsync).RequireAuthorization("cloud-save");
        app.MapPut("/api/saves/{slot:int}", PutAsync).RequireAuthorization("cloud-save");
        app.MapGet("/api/saves/{slot:int}", GetAsync).RequireAuthorization("cloud-save");
        app.MapDelete("/api/saves/{slot:int}", DeleteAsync).RequireAuthorization("cloud-save");
    }

    private static async Task<IResult> ListAsync(
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var userId = await ResolveUserIdAsync(context, db, cancellationToken);
        if (userId is null)
        {
            return ApiErrors.Unauthorized(
                "Link this Steam account to an SDR website account before using cloud saves.");
        }

        var saves = await db.CloudSaves.AsNoTracking()
            .Where(save => save.UserId == userId.Value)
            .OrderBy(save => save.Slot)
            .Select(save => new
            {
                save.Slot,
                save.Name,
                save.Size,
                save.UncompressedSize,
                save.FileCount,
                save.FormatVersion,
                save.Sha256,
                save.UpdatedAtUtc
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(saves);
    }

    private static async Task<IResult> PutAsync(
        int slot,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        if (slot is < 0 or > 7)
        {
            return ApiErrors.BadRequest("Save slots run from 0 through 7.");
        }

        var mediaType = context.Request.ContentType?.Split(';', 2)[0].Trim();
        if (!string.Equals(mediaType, "application/zip", StringComparison.OrdinalIgnoreCase))
        {
            return ApiErrors.UnsupportedMediaType("Cloud saves must use application/zip.");
        }

        if (context.Request.ContentLength > CloudSaveArchiveInspector.MaxArchiveBytes)
        {
            return ApiErrors.BadRequest("Cloud save archives may not exceed 16 MiB.");
        }

        byte[] bytes;
        try
        {
            bytes = await ReadBodyAsync(context.Request, cancellationToken);
        }
        catch (InvalidDataException exception)
        {
            return ApiErrors.BadRequest(exception.Message);
        }

        CloudSaveArchiveInspection inspection;
        try
        {
            inspection = CloudSaveArchiveInspector.Inspect(bytes, slot);
        }
        catch (InvalidDataException exception)
        {
            return ApiErrors.BadRequest(exception.Message);
        }

        var userId = await ResolveUserIdAsync(context, db, cancellationToken);
        if (userId is null)
        {
            return ApiErrors.Unauthorized(
                "Link this Steam account to an SDR website account before using cloud saves.");
        }

        var sha256 = await storage.SaveCloudSaveAsync(
            userId.Value,
            slot,
            bytes,
            cancellationToken);
        var save = await db.CloudSaves.SingleOrDefaultAsync(
            candidate => candidate.UserId == userId.Value && candidate.Slot == slot,
            cancellationToken);
        if (save is null)
        {
            save = new CloudSave { UserId = userId.Value, Slot = slot };
            db.CloudSaves.Add(save);
        }

        save.Name = inspection.Name;
        save.Size = bytes.Length;
        save.UncompressedSize = inspection.UncompressedSize;
        save.FileCount = inspection.FileCount;
        save.FormatVersion = inspection.FormatVersion;
        save.Sha256 = sha256;
        save.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(SavePayload(save));
    }

    private static async Task<IResult> GetAsync(
        int slot,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        if (slot is < 0 or > 7)
        {
            return ApiErrors.BadRequest("Save slots run from 0 through 7.");
        }

        var userId = await ResolveUserIdAsync(context, db, cancellationToken);
        if (userId is null)
        {
            return ApiErrors.Unauthorized(
                "Link this Steam account to an SDR website account before using cloud saves.");
        }

        var exists = await db.CloudSaves.AnyAsync(
            save => save.UserId == userId.Value && save.Slot == slot,
            cancellationToken);
        var path = storage.GetCloudSavePath(userId.Value, slot);
        if (!exists || !File.Exists(path))
        {
            return ApiErrors.NotFound("That cloud save slot is empty.");
        }

        return Results.File(
            path,
            "application/zip",
            $"solomon-dark-save-{slot + 1}.zip",
            enableRangeProcessing: true);
    }

    private static async Task<IResult> DeleteAsync(
        int slot,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        if (slot is < 0 or > 7)
        {
            return ApiErrors.BadRequest("Save slots run from 0 through 7.");
        }

        var userId = await ResolveUserIdAsync(context, db, cancellationToken);
        if (userId is null)
        {
            return ApiErrors.Unauthorized(
                "Link this Steam account to an SDR website account before using cloud saves.");
        }

        var save = await db.CloudSaves.SingleOrDefaultAsync(
            candidate => candidate.UserId == userId.Value && candidate.Slot == slot,
            cancellationToken);
        if (save is not null)
        {
            db.CloudSaves.Remove(save);
            await db.SaveChangesAsync(cancellationToken);
        }

        storage.DeleteCloudSave(userId.Value, slot);
        return Results.NoContent();
    }

    private static object SavePayload(CloudSave save) => new
    {
        save.Slot,
        save.Name,
        save.Size,
        save.UncompressedSize,
        save.FileCount,
        save.FormatVersion,
        save.Sha256,
        save.UpdatedAtUtc
    };

    private static async Task<int?> ResolveUserIdAsync(
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var websiteUserId = TokenService.GetUserId(context.User);
        if (websiteUserId is not null)
        {
            return await db.Users.AnyAsync(
                user => user.Id == websiteUserId.Value,
                cancellationToken)
                ? websiteUserId
                : null;
        }

        var linkedUserId = TokenService.GetLinkedUserId(context.User);
        var steamId = TokenService.GetSteamSessionId(context.User);
        if (linkedUserId is null || steamId is null)
        {
            return null;
        }

        return await db.Users.AnyAsync(
            user => user.Id == linkedUserId.Value && user.SteamId == steamId,
            cancellationToken)
            ? linkedUserId
            : null;
    }

    private static async Task<byte[]> ReadBodyAsync(
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[64 * 1024];
        while (true)
        {
            var read = await request.Body.ReadAsync(chunk, cancellationToken);
            if (read == 0)
            {
                break;
            }
            if (buffer.Length + read > CloudSaveArchiveInspector.MaxArchiveBytes)
            {
                throw new InvalidDataException("Cloud save archives may not exceed 16 MiB.");
            }
            await buffer.WriteAsync(chunk.AsMemory(0, read), cancellationToken);
        }

        if (buffer.Length == 0)
        {
            throw new InvalidDataException("Cloud save archives cannot be empty.");
        }
        return buffer.ToArray();
    }
}
