using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class RuntimeEventEndpoints
{
    private const long RequestLimit = 16 * 1024;

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/internal/runtime-events", SubmitAsync)
            .AllowAnonymous()
            .WithMetadata(new RequestSizeLimitAttribute(RequestLimit));
    }

    private static async Task<IResult> SubmitAsync(
        HttpContext context,
        IConfiguration configuration,
        RuntimeEventService events,
        CancellationToken cancellationToken)
    {
        if (context.Connection.RemoteIpAddress is not { } remoteAddress ||
            !IPAddress.IsLoopback(remoteAddress) ||
            !MatchesSecret(
                context.Request.Headers.Authorization.ToString(),
                configuration["RuntimeEvents:Secret"]))
        {
            return Results.NotFound();
        }
        if (context.Request.ContentType?.StartsWith(
                "application/json",
                StringComparison.OrdinalIgnoreCase) != true)
        {
            return ApiErrors.UnsupportedMediaType("Runtime events must use application/json.");
        }

        RuntimeEventRequest? request;
        try
        {
            request = await context.Request.ReadFromJsonAsync<RuntimeEventRequest>(
                cancellationToken);
        }
        catch (JsonException)
        {
            return ApiErrors.BadRequest("The runtime event is not valid JSON.");
        }
        catch (BadHttpRequestException)
        {
            return ApiErrors.BadRequest("The runtime event could not be read.");
        }

        if (!IsValid(request))
        {
            return ApiErrors.BadRequest("The runtime event is invalid.");
        }

        await events.AppendAsync(
            "game-host",
            request!.Component,
            request.Event,
            request.Message,
            request.Details,
            request.OccurredAtUtc.UtcDateTime,
            cancellationToken);
        return Results.Accepted();
    }

    private static bool IsValid(RuntimeEventRequest? request)
    {
        if (request is null ||
            request.SchemaVersion != 1 ||
            !IsEventName(request.Component, 64) ||
            !IsEventName(request.Event, 96) ||
            !IsText(request.Message, 256) ||
            request.Details.ValueKind != JsonValueKind.Object ||
            Encoding.UTF8.GetByteCount(request.Details.GetRawText()) >
                RuntimeEventService.MaximumDetailsBytes)
        {
            return false;
        }

        var now = DateTimeOffset.UtcNow;
        return request.OccurredAtUtc >= now.AddMinutes(-5) &&
            request.OccurredAtUtc <= now.AddMinutes(1);
    }

    private static bool MatchesSecret(string authorization, string? configuredSecret)
    {
        const string prefix = "Bearer ";
        if (configuredSecret is not { Length: >= 32 } ||
            !authorization.StartsWith(prefix, StringComparison.Ordinal))
        {
            return false;
        }

        var supplied = authorization[prefix.Length..];
        var expectedHash = SHA256.HashData(Encoding.UTF8.GetBytes(configuredSecret));
        var suppliedHash = SHA256.HashData(Encoding.UTF8.GetBytes(supplied));
        return CryptographicOperations.FixedTimeEquals(expectedHash, suppliedHash);
    }

    private static bool IsEventName(string? value, int maximumLength) =>
        value is { Length: > 0 } &&
        value.Length <= maximumLength &&
        value.All(character =>
            char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-');

    private static bool IsText(string? value, int maximumLength) =>
        value is { Length: > 0 } &&
        value.Length <= maximumLength &&
        value.All(character => !char.IsControl(character) || character is '\r' or '\n' or '\t');

    private sealed record RuntimeEventRequest(
        int SchemaVersion,
        string Component,
        string Event,
        string Message,
        DateTimeOffset OccurredAtUtc,
        JsonElement Details);
}
