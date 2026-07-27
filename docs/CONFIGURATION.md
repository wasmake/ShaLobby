# Configuration Reference

## Location And Ownership

ShamooRuntime owns the eight persistent YAML files. With the generated Runtime settings, their exact
location is:

```text
<paper>/plugins/ShamooRuntime/data/shalobby/
```

Runtime creates every missing file automatically during ShaLobby's first startup and never replaces an
existing file during `ensure`. The files in `defaults/` are the release fixture for the embedded Runtime
defaults; administrators do not manually install them. The coordinated Runtime source currently
generates byte-identical files, and the optional cross-repository test is a required publication gate.

> **Destructive default warning:** these defaults are intentionally usable for a dedicated lobby, not a
> shared gameplay server. Before setting `managed-lobby.enabled: true`, back up the server, worlds, and
> player data and review every default. The initial configuration targets the existing world `world`,
> resets joining player state, enforces managed hotbar contents and world rules, and enables broad
> protection. Applying it unchanged to survival or another gameplay server can remove player state and
> disable expected gameplay.

Runtime is the authoritative YAML parser, validator, native preflight layer, and persistence owner.
After Runtime accepts one complete reload snapshot, its success response includes bounded
`messagesContent` from that exact snapshot. TypeScript parses and commits only that correlated content;
it performs no independent pre-reload file read.

## Common Rules

- Every file is UTF-8 and limited to 1 MiB.
- YAML uses SnakeYAML's safe constructor with duplicate keys disabled, at most 16 aliases, a nesting
  depth of 32, and bounded code points and collections.
- Unknown object keys are rejected. There is no schema-version or legacy-key compatibility layer.
- IDs match `[a-z][a-z0-9_-]{0,63}`.
- Permission nodes match `[A-Za-z0-9._-]{1,128}`.
- General text is at most 4096 characters unless a narrower limit is stated.
- Numbers must be finite. Integer fields reject fractional values.
- Runtime validates all cross-file references and native Paper registries before activation.
- IDs are unique in their own collections. Menu slots are unique within a menu, and hotbar item slots
  are unique across `items.yml`; Runtime rejects duplicates in both cases.
- Materials, sounds, particles, managed worlds, and game rules must resolve against Paper 1.21.8.
- An invalid candidate rejects the complete reload; no individual file becomes partially active.

The eight root schemas are exactly:

| File             | Only allowed root keys                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `config.yml`     | `join`, `void-rescue-y`, `protection`, `portal-cooldown-ms`, `enforcement-ticks`, `worlds`, `visibility`, `transfers` |
| `messages.yml`   | `messages`, `titles`, `sounds`, `particles`                                                                           |
| `items.yml`      | `items`                                                                                                               |
| `menus.yml`      | `menus`                                                                                                               |
| `scoreboard.yml` | `sidebar`                                                                                                             |
| `servers.yml`    | `servers`                                                                                                             |
| `spawn.yml`      | `spawn`                                                                                                               |
| `portals.yml`    | `portals`                                                                                                             |

## `config.yml`

### `join`

`join` is optional. Its exact keys are:

| Key                | Type       | Parser default | Current generated value |
| ------------------ | ---------- | -------------- | ----------------------- |
| `suppress-message` | boolean    | `true`         | `true`                  |
| `teleport`         | boolean    | `true`         | `true`                  |
| `reset`            | boolean    | `true`         | `true`                  |
| `welcome-title`    | ID or null | null           | `bienvenida`            |
| `welcome-sound`    | ID or null | null           | `bienvenida`            |
| `welcome-particle` | ID or null | null           | `bienvenida`            |
| `welcome-message`  | ID or null | null           | `bienvenida`            |

Welcome IDs must reference the corresponding collection in `messages.yml`. Reset places the player in
Adventure mode and clears inventory, armor, offhand, effects, experience, velocity, fire/fall state,
flight, and health/hunger state before restoring managed items.

### Root settings

| Key                  | Type and range        | Parser default | Current generated value |
| -------------------- | --------------------- | -------------- | ----------------------- |
| `void-rescue-y`      | number, `-2048..2048` | `-80`          | `-80`                   |
| `portal-cooldown-ms` | integer, `0..600000`  | `1000`         | `2500`                  |
| `enforcement-ticks`  | integer, `20..12000`  | `200`          | `200`                   |

Void rescue only teleports when the one global spawn is configured. Enforcement reapplies world
settings, managed items, and void rescue at its interval. Sidebar animation has its own interval.

### `protection`

| Key                 | Type       | Parser default    | Current generated value   |
| ------------------- | ---------- | ----------------- | ------------------------- |
| `enabled`           | boolean    | `true`            | `true`                    |
| `bypass-permission` | permission | `shalobby.bypass` | `lobby.protection.bypass` |

Protection is currently all-or-nothing. There are no separate block, inventory, damage, hunger,
weather, vehicle, projectile, entity, explosion, or portal toggles. The bypass applies to restrictions
caused by a player and authorizes portal editing. Environmental protection in managed worlds is not
bypassed by a player permission. Generation-tagged lobby items and menus remain protected even for a
bypassing player.

### `worlds`

`worlds` is an optional list of at most 32 unique world names. Each entry allows exactly:

| Key          | Required | Type                                 |
| ------------ | -------- | ------------------------------------ |
| `name`       | yes      | nonblank text, at most 64 characters |
| `time`       | no       | integer `0..24000` or null           |
| `storm`      | no       | boolean or null                      |
| `thundering` | no       | boolean or null                      |
| `game-rules` | no       | map of at most 64 Paper game rules   |

Game-rule names match `[A-Za-z0-9_]{1,64}` and values are booleans or 32-bit integers. Runtime checks
that each name exists and that the value has the rule's native type. Every configured managed world
must already be loaded when a candidate is prepared.

The generated configuration manages only `world`, fixes time and weather, and sets the exact game-rule
values visible in `defaults/config.yml`.

### `visibility`

| Key                | Type                      | Parser default   | Current generated value  |
| ------------------ | ------------------------- | ---------------- | ------------------------ |
| `default`          | `all`, `staff`, or `none` | `all`            | `all`                    |
| `staff-permission` | permission                | `shalobby.staff` | `lobby.visibility.staff` |

`cycle` is accepted only as an action target. Its order is `all -> staff -> none -> all`.

### `transfers`

`transfers` allows only `cooldown-ms`, an integer from `0` through `600000`. Its parser and generated
default are both `3000`. This is one per-player transfer cooldown shared by `connect` actions.

## `messages.yml`

### `messages`

`messages` is an optional map of at most 256 ID keys to strings of at most 4096 characters. Runtime
uses MiniMessage and currently resolves a message by ID for the join welcome. TypeScript also stages
this map from the correlated reload response as the configurable command-message catalog.

The current TypeScript command keys are:

```text
prefix
command-error
player-required
invalid-arguments
spawn-requested
spawn-player-requested
spawn-set
reload-complete
items-given
items-reset
menu-opened
portal-wand
portal-created
portal-deleted
portal-list
portal-info
portal-enabled
portal-disabled
portal-pos1
portal-pos2
portal-destination
portal-visualization-enabled
portal-visualization-disabled
status
debug
unavailable
unknown
invalid
overloaded
```

Missing command keys use the compiled Spanish fallbacks in `src/messages.ts`. `%prefix%` expands from
the configured `prefix` or its compiled fallback. Command handlers provide only context-specific
values such as `%player%`, `%menu%`, `%portal%`, `%count%`, `%enabled%`, `%destination%`, `%world%`,
`%x%`, `%y%`, `%z%`, `%admission%`, `%pending%`, `%maximum%`, `%generation%`, `%directory%`, and other
bounded status fields. Unknown tokens remain unchanged. Dynamic values escape backslashes and `<`
before MiniMessage rendering. The generation and directory are used only by `/lobby debug`; both
diagnostic routes require the administrator permission `lobby.command.debug`.

The command-message keys remaining after the native Spanish presentation IDs must exactly equal the
compiled fallback keys and values. The defaults contract test enforces that equality, so obsolete
command keys cannot silently remain in generated YAML.

### `titles`

`titles` is an optional list of at most 64 unique IDs:

| Key              | Required | Type and parser default          |
| ---------------- | -------- | -------------------------------- |
| `id`             | yes      | ID                               |
| `title`          | no       | text, `''`                       |
| `subtitle`       | no       | text, `''`                       |
| `fade-in-ticks`  | no       | integer `0..1200`, default `10`  |
| `stay-ticks`     | no       | integer `0..12000`, default `70` |
| `fade-out-ticks` | no       | integer `0..1200`, default `20`  |

The generated IDs are `bienvenida` and `perfil`.

### `sounds`

`sounds` is an optional list of at most 64 unique IDs:

| Key      | Required | Type and parser default                   |
| -------- | -------- | ----------------------------------------- |
| `id`     | yes      | ID                                        |
| `sound`  | yes      | Paper sound enum or namespaced identifier |
| `volume` | no       | number `0..16`, default `1`               |
| `pitch`  | no       | number `0..2`, default `1`                |

The generated IDs are `bienvenida`, `clic`, and `confirmacion`.

### `particles`

`particles` is an optional list of at most 64 unique IDs:

| Key        | Required | Type and parser default                      |
| ---------- | -------- | -------------------------------------------- |
| `id`       | yes      | ID                                           |
| `particle` | yes      | Paper particle enum or namespaced identifier |
| `count`    | no       | integer `0..1000`, default `1`               |
| `offset-x` | no       | number `0..128`, default `0`                 |
| `offset-y` | no       | number `0..128`, default `0`                 |
| `offset-z` | no       | number `0..128`, default `0`                 |
| `speed`    | no       | number `0..16`, default `0`                  |

The generated IDs are `bienvenida` and `destello`. Runtime supports only particles whose Paper data
type is `Void`; arbitrary particle data is intentionally outside the bridge.

## `items.yml`

`items` is an optional list of at most 36 entries. Each entry allows exactly:

| Key           | Required | Type and parser default                                            |
| ------------- | -------- | ------------------------------------------------------------------ |
| `id`          | yes      | unique ID                                                          |
| `slot`        | yes      | unique integer `0..35`                                             |
| `material`    | yes      | Paper item material                                                |
| `amount`      | no       | integer `1..99`, default `1`, and no larger than native stack size |
| `name`        | no       | MiniMessage text, default `''`                                     |
| `lore`        | no       | up to 32 MiniMessage strings, default `[]`                         |
| `cooldown-ms` | no       | integer `0..600000`, default `0`                                   |
| `action`      | no       | action object, default `{ type: none }`                            |

The generated IDs and slots are `selector-juegos: 0`, `selector-lobbies: 1`, `perfil: 4`,
`visibilidad: 7`, and `ajustes: 8`. Runtime tags managed items with owner-generation PDC data, restores
them during enforcement, and prevents moving or consuming them independently of general protection.

## `menus.yml`

`menus` is an optional list of at most 64 entries:

| Key     | Required | Type                                          |
| ------- | -------- | --------------------------------------------- |
| `id`    | yes      | unique ID                                     |
| `rows`  | yes      | integer `1..6`                                |
| `title` | yes      | MiniMessage text; an empty string is accepted |
| `slots` | no       | list with at most `rows * 9` entries          |

Each `slots` entry allows exactly:

| Key        | Required | Type and parser default                                    |
| ---------- | -------- | ---------------------------------------------------------- |
| `slot`     | yes      | unique integer `0..rows*9-1`                               |
| `material` | yes      | Paper item material                                        |
| `amount`   | no       | integer `1..99`, default `1`, bounded by native stack size |
| `name`     | no       | MiniMessage text, default `''`                             |
| `lore`     | no       | up to 32 MiniMessage strings, default `[]`                 |
| `action`   | no       | action object, default `{ type: none }`                    |

The generated menu IDs are `game-selector`, `lobby-selector`, `profile`, and `settings`, each with
three rows. Menus are protected, player- and generation-scoped inventories.

## Action Schema

Every item, menu slot, and portal action is an object with exactly `type` and, only when required,
`target`:

| `type`       | `target`                           | Native result                                                      |
| ------------ | ---------------------------------- | ------------------------------------------------------------------ |
| `none`       | forbidden                          | No operation                                                       |
| `spawn`      | forbidden                          | Teleport to the one configured global spawn; no-op if unconfigured |
| `menu`       | required menu ID                   | Close the current menu and open the target one tick later          |
| `visibility` | `all`, `staff`, `none`, or `cycle` | Update in-memory viewer mode                                       |
| `connect`    | required enabled server ID         | Send its configured Bungee `target` after transfer cooldown        |
| `title`      | required title ID                  | Show the configured title                                          |
| `sound`      | required sound ID                  | Play the configured sound                                          |
| `particle`   | required particle ID               | Spawn the configured data-free particle                            |

There is no `command`, `console`, proxy-ping, status-query, or external-placeholder action type.

## `scoreboard.yml`

`sidebar` is optional and allows exactly:

| Key              | Type and parser default                                  |
| ---------------- | -------------------------------------------------------- |
| `enabled`        | boolean, default `false`                                 |
| `title`          | MiniMessage fallback frame, default `<gold>Lobby</gold>` |
| `title-frames`   | up to 32 MiniMessage strings, default `[]`               |
| `lines`          | up to 15 MiniMessage strings, default `[]`               |
| `interval-ticks` | integer `5..1200`, default `20`                          |

If `title-frames` is nonempty, it takes precedence over `title`; otherwise `title` supplies one frame.
The generated sidebar is enabled, has four frames, 15 lines, and a 20-tick interval. Runtime uses a
private scoreboard per managed player and updates changed components.

The complete built-in Runtime placeholder set is:

| Placeholder         | Value                                         |
| ------------------- | --------------------------------------------- |
| `%player%`          | Player name                                   |
| `%online%`          | Players currently online on this Paper server |
| `%world%`           | Current world name                            |
| `%x%`, `%y%`, `%z%` | Current block coordinates                     |
| `%ping%`            | Current Paper player ping                     |
| `%visibility%`      | `all`, `staff`, or `none`                     |

No rank, coins, proxy status, capacity, server health, or network-wide online provider exists. Unknown
Runtime placeholders remain literal because replacement is limited to these eight names.

## `servers.yml`

`servers` is an optional list of at most 64 entries:

| Key            | Required | Type and parser default                            |
| -------------- | -------- | -------------------------------------------------- |
| `id`           | yes      | unique ID used by actions                          |
| `enabled`      | no       | boolean, default `true`                            |
| `target`       | yes      | Bungee server name matching `[A-Za-z0-9._-]{1,64}` |
| `display-name` | no       | MiniMessage text, default is `id`                  |

The generated IDs and targets are `survival`, `skyblock`, `minigames`, `lobby-1`, `lobby-2`, and
`lobby-3`, all enabled. There are no aliases, addresses, credentials, maintenance flags, player counts,
capacity, pings, or status fields. A `connect` action can reference only an enabled ID; Runtime sends
the corresponding `target`.

## `spawn.yml`

`spawn` is required and has exactly one of two shapes.

Unconfigured, which is the generated default:

```yaml
spawn: { configured: false }
```

Configured:

```yaml
spawn:
  configured: true
  world: world
  x: 0.5
  y: 64.0
  z: 0.5
  yaw: 0.0
  pitch: 0.0
```

| Key      | Range when configured                            |
| -------- | ------------------------------------------------ |
| `world`  | loaded managed-world name, at most 64 characters |
| `x`, `z` | finite `-30000000..30000000`                     |
| `y`      | finite `-2048..2048`                             |
| `yaw`    | finite `-360..360`                               |
| `pitch`  | finite `-90..90`                                 |

All six location fields are required when `configured: true`; no other key is accepted when false.
The object is never a list and has no ID or per-world variant.

## `portals.yml`

`portals` is an optional list of at most 256 entries. Each entry allows exactly:

| Key           | Required | Type and parser default                                                                       |
| ------------- | -------- | --------------------------------------------------------------------------------------------- |
| `id`          | yes      | unique ID                                                                                     |
| `enabled`     | no       | boolean, default `true`                                                                       |
| `world`       | yes      | managed-world name, at most 64 characters                                                     |
| `min`         | yes      | coordinate object `{ x, y, z }`                                                               |
| `max`         | yes      | coordinate object `{ x, y, z }`                                                               |
| `permission`  | no       | permission node or null                                                                       |
| `priority`    | no       | integer `-10000..10000`, default `0`                                                          |
| `cooldown-ms` | no       | integer `0..600000`, default `config.yml.portal-cooldown-ms`                                  |
| `destination` | no       | enabled server ID or null; legacy mirror for `connect` only                                   |
| `action`      | no       | any native action; inferred as matching `connect` when `destination` exists, otherwise `none` |
| `visualize`   | no       | boolean, default `false`                                                                      |

Coordinate members use the same finite `x/z` range as spawn and `y` range `-2048..2048`. Every
minimum component must be less than or equal to its maximum. Native preflight also requires Y bounds
inside the loaded world's height.

Bounds are inclusive. Overlap is supported rather than rejected: the highest `priority` wins and an
ID ascending comparison breaks ties. Disabled portals are omitted from lookup. Each enabled portal
may index at most 4096 chunks, with at most 16384 aggregate enabled-portal chunk entries.

If `destination` is present, `action` must be `connect` with the identical target. `spawn` and `menu`
portal destinations have no legacy `destination` field and persist only their action. The generated
portals are `portal-survival`, `portal-skyblock`, and `portal-minigames`; all are disabled, use
priority `10`, cooldown `2500`, and matching example permissions and server actions.

Portal entry uses transition behavior. Crossing from outside to inside selects one portal, checks its
permission and per-player cooldown, records the cooldown, and queues the action. Remaining inside does
not repeat it; leave and re-enter to trigger another transition.

## Persistence And Reload

Runtime snapshots all eight files, parses and validates the candidate, preflights native resources,
checks that the snapshot remains unchanged, and only then swaps active native state. A successful
reload includes bounded `messagesContent` from that accepted snapshot. TypeScript serializes command
reloads, validates that field and commits the resulting command-message map; malformed, missing, or
oversized correlated content preserves the previous catalog.

Runtime-generated writes for spawn and portal administration use a same-directory temporary file,
file `fsync`, atomic rename, directory `fsync`, and an atomically written `<file>.bak` containing prior
bytes. Stale snapshots are rejected. Direct external editor writes do not receive these guarantees;
avoid concurrent saves while reloading.
