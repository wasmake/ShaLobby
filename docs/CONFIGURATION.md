# Configuration

ShaLobby uses eight UTF-8 YAML files under its persistent `data` directory:

- `config.yml`: join flow, protection, worlds, visibility, and cooldowns
- `messages.yml`: Spanish text, titles, sounds, and particles
- `items.yml`: managed hotbar items and actions
- `menus.yml`: inventory menus and slot actions
- `scoreboard.yml`: sidebar frames, lines, interval, and placeholders
- `servers.yml`: Bungee-compatible proxy destinations
- `spawn.yml`: optional persisted lobby spawn
- `portals.yml`: cuboids, priority, permission, cooldown, and action

The files in `defaults/` are copied into the build artifact. Runtime seeds only missing persistent
files, so upgrades do not replace administrator edits.

`/lobby reload` parses a complete candidate before replacing the active configuration. Spawn and
portal administration writes use the same policy-confined persistent store.

Sidebar placeholders are `%player%`, `%online%`, `%world%`, `%x%`, `%y%`, `%z%`, `%ping%`, and
`%visibility%`.
