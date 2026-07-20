using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using SolomonDarkRevived.Api;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

var builder = WebApplication.CreateBuilder(args);
var isDevelopment = builder.Environment.IsDevelopment();
builder.Logging.AddFilter(
    "System.Net.Http.HttpClient.SteamTicketVerifier",
    LogLevel.Warning);

var configuredStorageRoot = builder.Configuration["Storage:Root"];
if (string.IsNullOrWhiteSpace(configuredStorageRoot))
{
    configuredStorageRoot = "data";
}

var storageRoot = Path.IsPathRooted(configuredStorageRoot)
    ? configuredStorageRoot
    : Path.Combine(builder.Environment.ContentRootPath, configuredStorageRoot);
var storage = new StorageService(storageRoot);
builder.Services.AddSingleton(storage);
builder.Services.AddDbContext<AppDb>(options =>
    options.UseSqlite($"Data Source={storage.DatabasePath}"));

var jwtSecret = builder.Configuration["Jwt:Secret"];
var generatedJwtSecret = false;
if (string.IsNullOrWhiteSpace(jwtSecret))
{
    if (isDevelopment)
    {
        throw new InvalidOperationException("Jwt:Secret must be configured in Development.");
    }

    jwtSecret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    generatedJwtSecret = true;
}

var jwtExpiryDays = builder.Configuration.GetValue<int?>("Jwt:ExpiryDays") ?? 7;
builder.Services.AddSingleton(new TokenService(jwtSecret, jwtExpiryDays));
builder.Services.AddSingleton<LobbyJoinTicketService>();
builder.Services.AddHttpClient<SteamOpenIdService>(client =>
    client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddHttpClient<SteamTicketVerifier>(client =>
{
    client.BaseAddress = new Uri("https://api.steampowered.com/");
    client.Timeout = TimeSpan.FromSeconds(10);
});

// SQLite round-trips lose DateTimeKind, so DB-read timestamps would serialize
// without the trailing Z and browsers would misparse them as local time.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new UtcDateTimeJsonConverter()));
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            NameClaimType = "unique_name"
        };
        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(
                    new { error = "A valid bearer token is required." });
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(
                    new { error = "This bearer may not enter here." });
            }
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.DefaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder(
            JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .RequireAssertion(context => TokenService.GetUserId(context.User) is not null)
        .Build();
    options.AddPolicy("lobby-viewer", policy => policy
        .RequireAuthenticatedUser()
        .RequireAssertion(context =>
            TokenService.GetUserId(context.User) is not null ||
            TokenService.GetSteamSessionId(context.User) is not null));
});
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownProxies.Clear();
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Add(IPAddress.Loopback);
    options.KnownProxies.Add(IPAddress.IPv6Loopback);
});

if (isDevelopment)
{
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("vite", policy => policy
            .WithOrigins("http://localhost:5173", "http://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod());
    });
}

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        var requestPath = context.HttpContext.Request.Path.Value;
        var message = requestPath?.EndsWith(
                "/comments",
                StringComparison.OrdinalIgnoreCase) == true
            ? "The ink must dry before you add another marginal note. Try again in a minute."
            : string.Equals(
                requestPath,
                "/api/auth/steam/session",
                StringComparison.OrdinalIgnoreCase)
                ? "Too many Steam authentication attempts; try again in a minute."
                : "Too many match announcements; try again in a minute.";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { error = message },
            cancellationToken);
    };
    options.AddPolicy("lobby-announcements", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                AutoReplenishment = true
            }));
    options.AddPolicy("lobby-passwords", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                AutoReplenishment = true
            }));
    options.AddPolicy("steam-ticket-auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                AutoReplenishment = true
            }));
    options.AddPolicy("mod-comments", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                AutoReplenishment = true
            }));
});

var app = builder.Build();

if (generatedJwtSecret)
{
    app.Logger.LogWarning(
        "Jwt:Secret was not configured; generated an ephemeral key and sessions will not survive restart.");
}

app.UseForwardedHeaders();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    await DatabaseSchema.EnsureCurrentAsync(db);
}

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var statusCode = exception is BadHttpRequestException badRequest
            ? badRequest.StatusCode
            : StatusCodes.Status500InternalServerError;
        context.Response.StatusCode = statusCode;
        await context.Response.WriteAsJsonAsync(new
        {
            error = statusCode == StatusCodes.Status500InternalServerError
                ? "The server lost its place in the Annals."
                : "The request could not be read."
        });
    });
});

app.UseStatusCodePages(async statusContext =>
{
    var context = statusContext.HttpContext;
    if (!context.Request.Path.StartsWithSegments("/api"))
    {
        return;
    }

    var message = context.Response.StatusCode switch
    {
        StatusCodes.Status400BadRequest => "The request could not be read.",
        StatusCodes.Status401Unauthorized => "A valid bearer token is required.",
        StatusCodes.Status403Forbidden => "This bearer may not enter here.",
        StatusCodes.Status404NotFound => "No such API route exists.",
        StatusCodes.Status405MethodNotAllowed => "That method is not allowed here.",
        StatusCodes.Status413PayloadTooLarge => "The request body is too large.",
        StatusCodes.Status415UnsupportedMediaType => "That content type is not supported.",
        StatusCodes.Status429TooManyRequests => "Too many requests; try again shortly.",
        _ => "The request could not be completed."
    };
    await context.Response.WriteAsJsonAsync(new { error = message });
});

var frontendFiles = new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        if (string.Equals(context.File.Name, "index.html", StringComparison.OrdinalIgnoreCase))
        {
            context.Context.Response.Headers.CacheControl = "no-cache";
        }
    }
};
app.UseDefaultFiles();
app.UseStaticFiles(frontendFiles);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(storage.ScreenshotsPath),
    RequestPath = "/uploads/screenshots"
});

app.UseRouting();
if (isDevelopment)
{
    app.UseCors("vite");
}

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

AuthEndpoints.Map(app);
SteamAuthEndpoints.Map(app);
ModEndpoints.Map(app);
LobbyEndpoints.Map(app);
SaveEndpoints.Map(app);
StatsEndpoints.Map(app);

app.MapMethods(
    "/api/{**path}",
    ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    () => ApiErrors.NotFound("No such API route exists."));
app.MapFallbackToFile("index.html", frontendFiles);

app.Run();

internal sealed class UtcDateTimeJsonConverter : System.Text.Json.Serialization.JsonConverter<DateTime>
{
    public override DateTime Read(
        ref System.Text.Json.Utf8JsonReader reader,
        Type typeToConvert,
        System.Text.Json.JsonSerializerOptions options) => reader.GetDateTime();

    public override void Write(
        System.Text.Json.Utf8JsonWriter writer,
        DateTime value,
        System.Text.Json.JsonSerializerOptions options) =>
        writer.WriteStringValue(DateTime.SpecifyKind(value, DateTimeKind.Utc));
}
