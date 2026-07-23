using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class BoneyardEndpoints
{
    private const int MaxDraftsPerUser = 32;
    private const int MaxDraftNameLength = 80;
    private const int MaxDocumentBytes = 2 * 1024 * 1024;
    private const int MaxCompiledBytes = 4 * 1024 * 1024;
    private const long UpdateRequestLimit = 9L * 1024 * 1024;

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/boneyards", ListAsync).RequireAuthorization();
        app.MapPost("/api/boneyards", CreateAsync).RequireAuthorization();
        app.MapGet("/api/boneyards/{id:int}", GetAsync).RequireAuthorization();
        app.MapPut("/api/boneyards/{id:int}", UpdateAsync)
            .RequireAuthorization()
            .WithMetadata(new RequestSizeLimitAttribute(UpdateRequestLimit));
        app.MapDelete("/api/boneyards/{id:int}", DeleteAsync).RequireAuthorization();
        app.MapPost("/api/boneyards/{id:int}/publish", PublishAsync).RequireAuthorization();
    }

    private static async Task<IResult> ListAsync(
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this draft owner.");
        }

        var drafts = await db.BoneyardDrafts.AsNoTracking()
            .Where(draft => draft.UserId == userId.Value)
            .OrderByDescending(draft => draft.UpdatedAtUtc)
            .ThenByDescending(draft => draft.Id)
            .ToArrayAsync(cancellationToken);
        return Results.Ok(drafts.Select(ToSummary).ToArray());
    }

    private static async Task<IResult> CreateAsync(
        CreateBoneyardDraftRequest request,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this draft owner.");
        }

        var nameError = ValidateDraftName(request.Name, out var name);
        if (nameError is not null)
        {
            return ApiErrors.BadRequest(nameError);
        }

        if (await db.BoneyardDrafts.CountAsync(
                draft => draft.UserId == userId.Value,
                cancellationToken) >= MaxDraftsPerUser)
        {
            return ApiErrors.Conflict($"A wizard may keep at most {MaxDraftsPerUser} Boneyard drafts.");
        }

        var document = "{}"u8.ToArray();
        var now = DateTime.UtcNow;
        var draft = new BoneyardDraft
        {
            UserId = userId.Value,
            Name = name,
            DocumentSize = document.LongLength,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        try
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            db.BoneyardDrafts.Add(draft);
            await db.SaveChangesAsync(cancellationToken);
            await storage.SaveBoneyardDraftDocumentAsync(
                draft.UserId,
                draft.Id,
                document,
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            if (draft.Id > 0)
            {
                storage.DeleteBoneyardDraft(draft.UserId, draft.Id);
            }
            throw;
        }

        return Results.Json(
            ToFull(draft, JsonDocumentFrom(document), null),
            statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> GetAsync(
        int id,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        var draft = await FindOwnedDraftAsync(id, context, db, cancellationToken);
        if (draft is null)
        {
            return ApiErrors.NotFound("That Boneyard draft is not in your folio.");
        }

        var document = await storage.ReadBoneyardDraftDocumentAsync(
            draft.UserId,
            draft.Id,
            cancellationToken);
        if (document is null)
        {
            return ApiErrors.NotFound("The document for that Boneyard draft is missing.");
        }

        var compiled = draft.CompiledSize is null
            ? null
            : await storage.ReadBoneyardDraftCompiledAsync(
                draft.UserId,
                draft.Id,
                cancellationToken);
        if (draft.CompiledSize is not null && compiled is null)
        {
            return ApiErrors.NotFound("The compiled file for that Boneyard draft is missing.");
        }

        return Results.Ok(ToFull(draft, JsonDocumentFrom(document), compiled));
    }

    private static async Task<IResult> UpdateAsync(
        int id,
        JsonElement request,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        if (request.ValueKind != JsonValueKind.Object)
        {
            return ApiErrors.BadRequest("A Boneyard draft update must be a JSON object.");
        }

        var hasName = request.TryGetProperty("name", out var nameProperty);
        var hasDocument = request.TryGetProperty("document", out var documentProperty);
        var hasCompiled = request.TryGetProperty("compiledBoneyard", out var compiledProperty);
        if (!hasName && !hasDocument && !hasCompiled)
        {
            return ApiErrors.BadRequest(
                "Provide a name, document, or compiledBoneyard value to update.");
        }

        string? name = null;
        if (hasName)
        {
            var rawName = nameProperty.ValueKind == JsonValueKind.String
                ? nameProperty.GetString()
                : null;
            var nameError = ValidateDraftName(rawName, out name);
            if (nameError is not null)
            {
                return ApiErrors.BadRequest(nameError);
            }
        }

        byte[]? document = null;
        if (hasDocument)
        {
            document = Encoding.UTF8.GetBytes(documentProperty.GetRawText());
            if (document.Length > MaxDocumentBytes)
            {
                return ApiErrors.BadRequest("Boneyard draft documents may not exceed 2 MiB.");
            }
        }

        byte[]? compiled = null;
        var clearCompiled = false;
        if (hasCompiled)
        {
            if (compiledProperty.ValueKind == JsonValueKind.Null)
            {
                clearCompiled = true;
            }
            else if (compiledProperty.ValueKind != JsonValueKind.String)
            {
                return ApiErrors.BadRequest("compiledBoneyard must be a base64 string or null.");
            }
            else
            {
                var encoded = compiledProperty.GetString() ?? string.Empty;
                var maxEncodedLength = ((MaxCompiledBytes + 2) / 3) * 4;
                if (encoded.Length > maxEncodedLength)
                {
                    return ApiErrors.BadRequest("Compiled Boneyards may not exceed 4 MiB.");
                }

                try
                {
                    compiled = Convert.FromBase64String(encoded);
                }
                catch (FormatException)
                {
                    return ApiErrors.BadRequest("compiledBoneyard is not valid base64.");
                }

                if (compiled.Length > MaxCompiledBytes)
                {
                    return ApiErrors.BadRequest("Compiled Boneyards may not exceed 4 MiB.");
                }
            }
        }

        var draft = await FindOwnedDraftAsync(id, context, db, cancellationToken);
        if (draft is null)
        {
            return ApiErrors.NotFound("That Boneyard draft is not in your folio.");
        }

        if (name is not null)
        {
            draft.Name = name;
        }

        if (document is not null)
        {
            await storage.SaveBoneyardDraftDocumentAsync(
                draft.UserId,
                draft.Id,
                document,
                cancellationToken);
            draft.DocumentSize = document.LongLength;
        }

        if (compiled is not null)
        {
            await storage.SaveBoneyardDraftCompiledAsync(
                draft.UserId,
                draft.Id,
                compiled,
                cancellationToken);
            draft.CompiledSize = compiled.LongLength;
        }
        else if (clearCompiled)
        {
            storage.DeleteBoneyardDraftCompiled(draft.UserId, draft.Id);
            draft.CompiledSize = null;
        }

        draft.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var savedDocument = document ?? await storage.ReadBoneyardDraftDocumentAsync(
            draft.UserId,
            draft.Id,
            cancellationToken);
        var savedCompiled = draft.CompiledSize is null
            ? null
            : compiled ?? await storage.ReadBoneyardDraftCompiledAsync(
                draft.UserId,
                draft.Id,
                cancellationToken);
        if (savedDocument is null || (draft.CompiledSize is not null && savedCompiled is null))
        {
            return ApiErrors.NotFound("The saved files for that Boneyard draft are missing.");
        }

        return Results.Ok(ToFull(draft, JsonDocumentFrom(savedDocument), savedCompiled));
    }

    private static async Task<IResult> DeleteAsync(
        int id,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        var draft = await FindOwnedDraftAsync(id, context, db, cancellationToken);
        if (draft is null)
        {
            return ApiErrors.NotFound("That Boneyard draft is not in your folio.");
        }

        db.BoneyardDrafts.Remove(draft);
        await db.SaveChangesAsync(cancellationToken);
        storage.DeleteBoneyardDraft(draft.UserId, draft.Id);
        return Results.NoContent();
    }

    private static async Task<IResult> PublishAsync(
        int id,
        PublishBoneyardDraftRequest request,
        HttpContext context,
        AppDb db,
        StorageService storage,
        ModPublishingService publisher,
        CancellationToken cancellationToken)
    {
        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this draft owner.");
        }

        if (request.Name is null || request.Summary is null || request.Description is null)
        {
            return ApiErrors.BadRequest("Publication requires name, summary, and description.");
        }

        var draft = await db.BoneyardDrafts.AsNoTracking().SingleOrDefaultAsync(
            candidate => candidate.Id == id && candidate.UserId == userId.Value,
            cancellationToken);
        if (draft is null)
        {
            return ApiErrors.NotFound("That Boneyard draft is not in your folio.");
        }

        if (draft.CompiledSize is null)
        {
            return ApiErrors.BadRequest("Compile the Boneyard before publishing it.");
        }

        var waveText = string.IsNullOrWhiteSpace(request.WaveText) ? null : request.WaveText;
        if (waveText is not null)
        {
            if (waveText.Length > WaveScheduleValidator.MaxWaveTextBytes)
            {
                return ApiErrors.BadRequest("Wave schedules may not exceed 256 KiB.");
            }
            var waveError = WaveScheduleValidator.Validate(waveText);
            if (waveError is not null)
            {
                return ApiErrors.BadRequest(waveError);
            }
        }

        var compiled = await storage.ReadBoneyardDraftCompiledAsync(
            draft.UserId,
            draft.Id,
            cancellationToken);
        if (compiled is null)
        {
            return ApiErrors.BadRequest("The compiled Boneyard is missing from draft storage.");
        }

        try
        {
            var slug = await publisher.PublishBoneyardAsync(
                userId.Value,
                request.Name,
                request.Slug,
                request.Summary,
                request.Description,
                compiled,
                waveText,
                cancellationToken);
            var mod = await ModEndpoints.LoadModAsync(db, slug, cancellationToken);
            return Results.Json(
                ModEndpoints.ToDetail(mod!),
                statusCode: StatusCodes.Status201Created);
        }
        catch (ModPackageValidationException exception)
        {
            return ApiErrors.BadRequest(exception.Message);
        }
        catch (ModPublishingException exception)
        {
            return ApiErrors.Error(exception.StatusCode, exception.Message);
        }
    }

    private static async Task<BoneyardDraft?> FindOwnedDraftAsync(
        int id,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var userId = TokenService.GetUserId(context.User);
        return userId is null
            ? null
            : await db.BoneyardDrafts.SingleOrDefaultAsync(
                draft => draft.Id == id && draft.UserId == userId.Value,
                cancellationToken);
    }

    private static string? ValidateDraftName(string? rawName, out string name)
    {
        name = rawName?.Trim() ?? string.Empty;
        if (name.Length == 0 || name.Length > MaxDraftNameLength)
        {
            return $"Draft names must be 1-{MaxDraftNameLength} characters.";
        }

        return null;
    }

    private static object ToSummary(BoneyardDraft draft) => new
    {
        draft.Id,
        draft.Name,
        updatedAt = draft.UpdatedAtUtc,
        documentSize = draft.DocumentSize,
        compiledSize = draft.CompiledSize
    };

    private static object ToFull(
        BoneyardDraft draft,
        JsonElement document,
        byte[]? compiled) => new
    {
        draft.Id,
        draft.Name,
        document,
        compiledBoneyard = compiled is null ? null : Convert.ToBase64String(compiled),
        documentSize = draft.DocumentSize,
        compiledSize = draft.CompiledSize,
        createdAt = draft.CreatedAtUtc,
        updatedAt = draft.UpdatedAtUtc
    };

    private static JsonElement JsonDocumentFrom(ReadOnlyMemory<byte> bytes)
    {
        using var document = JsonDocument.Parse(bytes);
        return document.RootElement.Clone();
    }

    public sealed record CreateBoneyardDraftRequest(string? Name);

    public sealed record PublishBoneyardDraftRequest(
        string? Name,
        string? Slug,
        string? Summary,
        string? Description,
        string? WaveText);
}
