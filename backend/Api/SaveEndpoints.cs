using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class SaveEndpoints
{
    private const int MaxSaveBytes = 1024 * 1024;

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/saves", ListAsync).RequireAuthorization();
        app.MapPut("/api/saves/{slot:int}", PutAsync).RequireAuthorization();
        app.MapGet("/api/saves/{slot:int}", GetAsync).RequireAuthorization();
        app.MapDelete("/api/saves/{slot:int}", DeleteAsync).RequireAuthorization();
    }

    private static async Task<IResult> ListAsync(
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this save keeper.");
        }

        var saves = await db.CloudSaves.AsNoTracking()
            .Where(save => save.UserId == userId.Value)
            .OrderBy(save => save.Slot)
            .Select(save => new
            {
                save.Slot,
                save.Name,
                save.Size,
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
        if (!string.Equals(mediaType, "application/octet-stream", StringComparison.OrdinalIgnoreCase))
        {
            return ApiErrors.UnsupportedMediaType("Cloud saves must use application/octet-stream.");
        }

        var name = context.Request.Query.TryGetValue("name", out var suppliedName)
            ? suppliedName.ToString().Trim()
            : null;
        if (name?.Length > 40)
        {
            return ApiErrors.BadRequest("Save names may not exceed 40 characters.");
        }

        if (name?.Length == 0)
        {
            name = null;
        }

        if (context.Request.ContentLength > MaxSaveBytes)
        {
            return ApiErrors.BadRequest("Cloud saves may not exceed 1 MiB.");
        }

        var buffer = new byte[MaxSaveBytes + 1];
        var length = 0;
        while (length < buffer.Length)
        {
            var read = await context.Request.Body.ReadAsync(
                buffer.AsMemory(length, buffer.Length - length),
                cancellationToken);
            if (read == 0)
            {
                break;
            }

            length += read;
        }

        if (length == 0)
        {
            return ApiErrors.BadRequest("Cloud saves cannot be empty.");
        }

        if (length > MaxSaveBytes)
        {
            return ApiErrors.BadRequest("Cloud saves may not exceed 1 MiB.");
        }

        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this save keeper.");
        }

        var bytes = buffer.AsMemory(0, length).ToArray();
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

        save.Name = name;
        save.Size = length;
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

        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this save keeper.");
        }

        var exists = await db.CloudSaves.AnyAsync(
            save => save.UserId == userId.Value && save.Slot == slot,
            cancellationToken);
        var path = storage.GetCloudSavePath(userId.Value, slot);
        if (!exists || !File.Exists(path))
        {
            return ApiErrors.NotFound("That cloud save slot is empty.");
        }

        return Results.File(path, "application/octet-stream");
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

        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this save keeper.");
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
        save.Sha256,
        save.UpdatedAtUtc
    };
}
