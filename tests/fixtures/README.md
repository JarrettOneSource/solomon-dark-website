# Boneyard upload fixture

`flat_multiplayer_test.boneyard` is the stock-game custom-level save used by
the Mod Loader contracts. It was captured from **Create New Boneyard** before
placing an editor prop. Its SHA-256 is pinned alongside the file.

The fixture is intentionally not zero bytes: it contains the complete native
SyncBuffer, Arena, RegionLayout, TriggerControl, and default TimeLine graphs.
Website integration tests use it to prove that real Boneyard-only and combined
Boneyard + Lua packages pass upload, exact resolution, lobby announcement, and
download.
