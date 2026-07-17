# Solomon timeline fact-check

Fact-checked on July 16, 2026 against the current copy in `Home.tsx` and
`About.tsx`. Dates below use the U.S. App Store where a storefront matters.

## Bottom line

- The two original games are correctly dated to 2010. *Solomon's Keep* reached
  the U.S. App Store on April 2, and *Solomon's Boneyard* on September 7. The
  contemporary TouchArcade pieces appeared on April 6 and September 8,
  respectively.
- *Solomon Dark* was publicly cancelled in February 2015, not 2016.
- 2016 is the year Raptisoft briefly released the playable but unfinished
  Windows build. Fans began mirroring it immediately.
- Community preservation did not begin in 2024. Public mirrors existed in 2016,
  and the current `JayMcArthur/Raptisoft-Solomon` GitHub archive was created on
  June 9, 2022.
- The public history of the SDR modding repository begins on April 9, 2026, not
  in 2025. A private or unpublished 2025 start would need separate evidence.
- The community archive does contain `0.71.0`, `0.72.0`, and `0.72.5`. That
  verifies the three named builds, but not that no other build ever existed or
  survives elsewhere.

## Claim-by-claim findings

### The 2010 games

**Verdict: correct year; the exact releases were several months apart.**

Apple's U.S. version history dates *Solomon's Keep* 1.0 to **April 2, 2010**.
TouchArcade reviewed it four days later, on April 6. Sources:
[App Store](https://apps.apple.com/us/app/solomons-keep/id365183754),
[TouchArcade review](https://toucharcade.com/2010/04/06/solomons-keep-get-your-pointy-wizard-hat-ready/).

Apple's U.S. version history dates *Solomon's Boneyard* 1.0 to **September 7,
2010**. TouchArcade's database and launch review use September 8. That one-day
difference should be presented as a source/storefront difference rather than
silently choosing the TouchArcade date. Sources:
[App Store](https://apps.apple.com/us/app/solomons-boneyard/id387497198),
[TouchArcade game entry](https://toucharcade.com/games/solomons-boneyard),
[TouchArcade review](https://toucharcade.com/2010/09/08/solomons-boneyard-review-endless-survival-prequel-to-solomons-keep/).

The `About.tsx` opening, “In 2010, Raptisoft's *Solomon's Keep*…,” is therefore
sound. “*Solomon's Boneyard* followed” is also correct in release order. The
numeric phrase “into a million pockets” is **not substantiated** by the App
Store pages or the contemporary coverage found for this review. It should be
removed unless the project has a separate first-party download or sales source.

### Cancellation versus the playable beta

**Verdict: the site currently combines two different events and assigns the
wrong event to 2016.**

In a Raptisoft forum announcement from **February 2015**, John Raptis said the
project was dead after a year-long patent problem and other intervening events.
TouchArcade reported the cancellation on February 16, 2015. Sources:
[Raptisoft announcement](https://www.raptisoft-forums.com/discussion/2/new-forums),
[TouchArcade coverage](https://toucharcade.com/2015/02/16/solomon-dark-is-dead-long-live-solomon/).

Raptisoft later opened a beta thread in September 2016 and made the unfinished
Windows game available for a limited Halloween release. TouchArcade linked the
download on **October 31, 2016** and described a playable build without the
completed story mode. This was a post-cancellation release of unfinished work,
not the date of cancellation. Sources:
[Raptisoft beta thread](https://www.raptisoft-forums.com/discussion/230/solomon-dark-beta),
[TouchArcade beta coverage](https://toucharcade.com/2016/10/31/what-happened-to-solomon-dark-try-the-beta-and-find-out/).

Accordingly, both “Solomon Dark is cancelled” in the `Home.tsx` 2016 timeline
entry and “in 2016 it was cancelled” in `About.tsx` should change. The accurate
sequence is **cancelled publicly in 2015; unfinished playable build released in
2016**.

### Community preservation and surviving versions

**Verdict: the versions are correct, but 2024 is not.**

Fans posted persistent mirrors in November 2016, directly after Raptisoft's
one-day release. That establishes community preservation by 2016:
[Raptisoft forum mirror thread](https://www.raptisoft-forums.com/discussion/264/solomon-dark-download-links-and-gameplay-trailer).

The current GitHub preservation repository was created on **June 9, 2022**.
GitHub's repository record and its earliest visible commit place it on that
date:
[GitHub API repository record](https://api.github.com/repos/JayMcArthur/Raptisoft-Solomon),
[earliest commit](https://github.com/JayMcArthur/Raptisoft-Solomon/commit/c95bdd09e260f3b9ed676471c39c1a68e0caf637).
An October 2022 forum announcement then directed players to that archive and
listed versions `0.71.0`, `0.72.0`, and `0.72.5`:
[forum announcement](https://www.raptisoft-forums.com/discussion/1465/solomon-dark-download-links),
[GitHub version folders](https://github.com/JayMcArthur/Raptisoft-Solomon/tree/main/Solomon%20Dark).
The evidence verifies that the archive contains those three builds; it does not
establish that they are an exhaustive list of every build ever made or every
copy that may survive elsewhere.

Therefore:

- use **2016** if the timeline event means “fans first preserved the released
  build by mirroring it”; or
- use **2022** if it means “the present GitHub archive was established.”

There is no basis in these sources for using 2024 as the start of preservation.

### SDR mod loader

**Verdict: 2025 is not supported by the public repository history.**

The oldest commit in `JarrettOneSource/solomons-dark-modding` is “Initial
Solomon's Dark modding workspace,” dated **April 9, 2026**:
[repository](https://github.com/JarrettOneSource/solomons-dark-modding),
[initial commit](https://github.com/JarrettOneSource/solomons-dark-modding/commit/9a67bbcc852223a8b7af2f85c4a60f10c3798eb5).

That supports a 2026 date for the public project. It does not prove that every
feature named in the current line—Lua runtime, overlays, and native mods—was
already present on the first day. “The public SDR modding workspace begins” is
the defensible milestone. If a private 2025 prototype existed, the site would
need a dated artifact before claiming that year.

## Suggested corrected `Home.tsx` timeline copy

This version preserves the site's short, story-like format while keeping the
events distinct:

```text
2010 — Solomon's Keep reaches the App Store in April; Solomon's Boneyard follows in September.
2015 — Raptisoft publicly confirms that Solomon Dark will not be completed.
2016 — Raptisoft briefly releases the unfinished Windows build; fans begin preserving it.
2022 — A community GitHub archive gathers surviving builds 0.71.0, 0.72.0, and 0.72.5.
2026 — The public SDR modding workspace begins; multiplayer beta follows. Boneyards open. You are here.
```

Combining the two current 2026 milestones also avoids creating duplicate year
keys if this is later pasted into the existing `key={year}` mapping.

## Suggested corrected story prose

### `Home.tsx` “The Story So Far”

> In 2015, after years of anticipation, Raptisoft confirmed that Solomon Dark—the planned third Solomon game—would not be completed. On Halloween 2016, Raptisoft briefly released the unfinished Windows build. Fans mirrored it, and the surviving builds later became the foundation for this project: a community revival built by people who refused to let the magic fade.

### `About.tsx`

> In April 2010, Raptisoft's *Solomon's Keep* brought a wizard college, a dread tower, and the necromancer Solomon Dark to iPhone. *Solomon's Boneyard* followed that September—leaner, meaner, and endless. Then came the promise of a third game: *Solomon Dark*, where the College would finally send its brightest to settle the matter.
>
> It never received a finished commercial release. Raptisoft publicly declared the project dead in February 2015 after a year-long patent issue and other setbacks. On Halloween 2016, Raptisoft briefly released the unfinished Windows build. Fans mirrored it, and a community archive now preserves builds 0.71.0, 0.72.0, and 0.72.5.

The rest of the existing `About.tsx` passage can continue from “That is where
we begin.”
