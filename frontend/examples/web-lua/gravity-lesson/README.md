# Gravity Lesson

This intermediate example adds one ranked skill, two child skills, and three
small spells. Each spell demonstrates one prefab: area, projectile, or channel.
The real level-up picker, Skill Book, and mod quickbar discover the definitions;
the package contains no browser code.

Read [`scripts/main.lua`](scripts/main.lua) in sections. The first half is normal
declarative content. The `lesson_streak` reducer shows participant-run state,
schema migration, deterministic named random, and returned intents. The smaller
`demonstration_counter` shows session state. `begin_lesson` demonstrates delayed
and repeated rules whose timers are owned by the run.

From `frontend/`:

```sh
npm run sdmod -- check examples/web-lua/gravity-lesson
npm run sdmod -- test examples/web-lua/gravity-lesson
npm run sdmod -- pack examples/web-lua/gravity-lesson /tmp/gravity-lesson.sdmod
```

Upload and subscribe on the Website, then gain a level. Choose Gravity Student
to unlock Gravity Well. Later offers expose Pebble Practice and Beam Practice.
Bind unlocked spells in the Skill Book and cast them with the mod quickbar.

The icons and sounds are human-made CC0 assets from Kenney. See
[`ASSETS.md`](ASSETS.md).
