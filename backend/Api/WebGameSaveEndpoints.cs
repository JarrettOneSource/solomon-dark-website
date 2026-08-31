using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class WebGameSaveEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/game/saves/{slot:int}", GetAsync).RequireAuthorization();
        app.MapPut("/api/game/saves/{slot:int}", PutAsync).RequireAuthorization();
        app.MapDelete("/api/game/saves/{slot:int}", DeleteAsync).RequireAuthorization();
    }

    private static async Task<IResult> GetAsync(
        int slot,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        if (slot != 0)
        {
            return ApiErrors.BadRequest("The browser game currently supports only save slot 0.");
        }
        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("A website account is required for browser cloud saves.");
        }
        var save = await db.WebGameSaves.AsNoTracking().SingleOrDefaultAsync(
            candidate => candidate.UserId == userId.Value && candidate.Slot == slot,
            cancellationToken);
        return Results.Ok(new { save = save is null ? null : Payload(save) });
    }

    private static async Task<IResult> PutAsync(
        int slot,
        WebGameSaveWriteRequest request,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        if (slot != 0)
        {
            return ApiErrors.BadRequest("The browser game currently supports only save slot 0.");
        }
        if (request.ExpectedRevision < 0)
        {
            return ApiErrors.BadRequest("The expected save revision must not be negative.");
        }
        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("A website account is required for browser cloud saves.");
        }

        try
        {
            WebGameSaveInspector.Inspect(request.Document);
        }
        catch (InvalidDataException exception)
        {
            return ApiErrors.BadRequest(exception.Message);
        }

        var save = await db.WebGameSaves.SingleOrDefaultAsync(
            candidate => candidate.UserId == userId.Value && candidate.Slot == slot,
            cancellationToken);
        var currentRevision = save?.Revision ?? 0;
        if (currentRevision != request.ExpectedRevision)
        {
            return Conflict(currentRevision);
        }
        if (save is null)
        {
            save = new WebGameSave { UserId = userId.Value, Slot = slot };
            db.WebGameSaves.Add(save);
        }
        save.Document = request.Document!;
        save.Revision = currentRevision + 1;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(await CurrentRevisionAsync(db, userId.Value, slot, cancellationToken));
        }
        catch (DbUpdateException)
        {
            return Conflict(await CurrentRevisionAsync(db, userId.Value, slot, cancellationToken));
        }
        return Results.Ok(Payload(save));
    }

    private static async Task<IResult> DeleteAsync(
        int slot,
        int expectedRevision,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        if (slot != 0)
        {
            return ApiErrors.BadRequest("The browser game currently supports only save slot 0.");
        }
        if (expectedRevision < 0)
        {
            return ApiErrors.BadRequest("The expected save revision must not be negative.");
        }
        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("A website account is required for browser cloud saves.");
        }
        var save = await db.WebGameSaves.SingleOrDefaultAsync(
            candidate => candidate.UserId == userId.Value && candidate.Slot == slot,
            cancellationToken);
        var currentRevision = save?.Revision ?? 0;
        if (currentRevision != expectedRevision)
        {
            return Conflict(currentRevision);
        }
        if (save is not null)
        {
            db.WebGameSaves.Remove(save);
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(await CurrentRevisionAsync(db, userId.Value, slot, cancellationToken));
            }
        }
        return Results.NoContent();
    }

    private static object Payload(WebGameSave save) => new
    {
        save.Slot,
        save.Revision,
        save.Document
    };

    private static IResult Conflict(int currentRevision) => Results.Conflict(new
    {
        error = "The browser game save changed in another session.",
        currentRevision
    });

    private static async Task<int> CurrentRevisionAsync(
        AppDb db,
        int userId,
        int slot,
        CancellationToken cancellationToken) =>
        await db.WebGameSaves.AsNoTracking()
            .Where(save => save.UserId == userId && save.Slot == slot)
            .Select(save => (int?)save.Revision)
            .SingleOrDefaultAsync(cancellationToken) ?? 0;

    public sealed record WebGameSaveWriteRequest(string? Document, int ExpectedRevision);
}
