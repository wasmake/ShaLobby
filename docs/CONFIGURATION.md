# Configuration

ShaLobby uses eight UTF-8 YAML files under its persistent `data` directory:

- `config.yml`: join flow, protection, worlds, visibility, and cooldowns
- `messages.yml`: Spanish text, titles, sounds, and particles
- `items.yml`: managed hotbar items and actions
- `menus.yml`: inventory menus and slot actions
- `scoreboard.yml`: sidebar, typewriter shop bossbar, and static player-list header/footer
- `servers.yml`: Bungee-compatible proxy destinations
- `spawn.yml`: optional persisted lobby spawn
- `portals.yml`: cuboids, priority, permission, cooldown, and action

The files in `defaults/` are copied into the build artifact. Runtime seeds only missing persistent
files, so upgrades do not replace administrator edits.

`/lobby reload` parses a complete candidate before replacing the active configuration. Spawn and
portal administration writes use the same policy-confined persistent store.

Sidebar placeholders are `%player%`, `%online%`, `%world%`, `%x%`, `%y%`, `%z%`, `%ping%`, and
`%visibility%`.

The `presentation` section in `scoreboard.yml` controls per-player Adventure bossbars and a static
tab header/footer. Bossbar frames support `%online%`, use `frame-ticks` while typing, and hold the
last frame for `last-frame-ticks`. The static tab text supports `%player%` and `%online%`. The
shipped Spanish presentation is used when an older persistent file has no `presentation` section.
Legacy tab frame arrays remain accepted, but only their first entry is used.
