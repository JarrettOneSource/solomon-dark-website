namespace SolomonDarkRevived.Services;

/// <summary>Each API process exposes slot zero within its configured game's namespace.</summary>
public sealed class WebGameSaveScope
{
    public int StorageSlot { get; }

    public WebGameSaveScope(IConfiguration configuration)
    {
        StorageSlot = configuration["GameSaves:Namespace"] switch
        {
            null or "primary" => 0,
            "rust" => 1,
            _ => throw new InvalidOperationException("GameSaves:Namespace must be primary or rust.")
        };
    }
}
