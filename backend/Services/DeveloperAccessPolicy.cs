namespace SolomonDarkRevived.Services;

public sealed class DeveloperAccessPolicy
{
    private readonly HashSet<int> userIds;

    public DeveloperAccessPolicy(IConfiguration configuration)
    {
        var configured = configuration["DeveloperAccess:UserIds"] ?? string.Empty;
        userIds = configured
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(value => int.TryParse(value, out var userId) && userId > 0
                ? userId
                : throw new InvalidOperationException(
                    "DeveloperAccess:UserIds must be a comma-separated list of positive user IDs."))
            .ToHashSet();
    }

    public bool Allows(int? userId) => userId is not null && userIds.Contains(userId.Value);
}
