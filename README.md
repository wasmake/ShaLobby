# ShaLobby

ShaLobby is a TypeScript lobby plugin for Paper, backed by ShamooRuntime's owner-gated
`managed-lobby` capability. It provides managed worlds, join reset and presentation, one optional
global spawn, protected hotbar items and menus, a sidebar, player visibility, BungeeCord transfer
requests, and configurable portals.

## Current Status

The ShaLobby source implementation is complete. The coordinated ShamooRuntime bridge, its upstream
`@shamoo/paper` API, and ShamooTS command-parser inference exist in coordinated source work, but they
have **not** been published in the `0.1.0-rc.1` packages or Runtime release. Installing the public
`rc.1` Runtime does not provide `host.paperManagedLobby`, and its compiler does not infer omitted
command parsers.

This checkout is not independently releasable with the public artifacts. Coordinated source has the
matching omission-only bridge contract, correlated `messagesContent`, and byte-identical defaults.
Source parity is complete; coordinated compiler/API/Runtime publication and supported Paper process
certification remain pending.

For reproducible source checks against the published packages, ShaLobby currently carries a bounded
internal direct-host adapter in `src/managed-lobby.ts`. It validates and copies data-only requests and
applies one copied result boundary around `host.paperManagedLobby`. Replace it with the upstream
`@shamoo/paper` export only after a matching Runtime and API are published together.

Command declarations intentionally omit explicit parsers. A release build must use the current
coordinated ShamooTS compiler, which infers `string`, `number`, `boolean`, and `Player`. Public `rc.1`
`shamooc` can complete `pnpm check` but emits its old descriptor defaults after those parser omissions;
that output is not the release artifact. Dependency versions remain pinned until the coordinated
packages are published.

Do not describe this as an `rc.1` deployment. A working server requires a coordinated Runtime build
that contains the bridge.

## Requirements

| Component        | Requirement                                                        |
| ---------------- | ------------------------------------------------------------------ |
| Operating system | Linux x86-64                                                       |
| Java             | 21                                                                 |
| Server           | Paper 1.21.8                                                       |
| Runtime          | Coordinated Paper ShamooRuntime build with `managed-lobby`         |
| Proxy transfers  | Bungee-compatible plugin messaging and matching proxy server names |
| Development      | Node.js 22 or newer and pnpm 11 or newer                           |

The platform restriction comes from the pinned Javet Node native runtime. This managed-lobby feature
supports standard Paper 1.21.8 only; generic ShamooRuntime Folia support is unrelated. Other operating
systems, architectures, Paper versions, Velocity-only hosting, and the published `rc.1` Runtime are not
supported combinations for ShaLobby.

## Administrator Quick Start

The full procedure is in Spanish in [Admin Guide](docs/ADMIN.md). The essential flow is:

> **Destructive default warning:** use ShaLobby only on a dedicated lobby Paper server. Before enabling
> the bridge, back up the server, worlds, and player data and review all eight checked-in defaults. The
> generated configuration immediately manages the existing world named `world`, resets joining player
> state, enforces the managed hotbar and world rules, and enables broad lobby protection. Enabling these
> defaults on a survival or other gameplay server can remove inventory/state and block normal gameplay.

1. Install the coordinated ShamooRuntime Paper JAR.
2. Enable the owner-gated capability in `<paper>/plugins/ShamooRuntime/config.yml`:

   ```yaml
   managed-lobby:
     enabled: true
     owner: shalobby
     data-directory: data
     maximum-pending-actions: 64
   ```

   This setting makes the capability eligible for the configured owner. ShaLobby's TypeScript enable
   phase accepts and prepares configuration; native activation remains in standby until Runtime opens
   invocation admission for that generation.

3. Install ShaLobby's three build files in
   `<paper>/plugins/ShamooRuntime/plugins/shalobby/`:

   ```text
   index.js
   index.js.map
   shamoo-plugin.json
   ```

4. Start Paper. Runtime automatically creates all eight polished defaults on first startup. Do not
   manually copy `defaults/` into the server.
5. Stand in the managed default world `world` and run `/lobby setspawn`. The world name is
   configurable in `config.yml`.
6. Optionally edit the generated YAML and run `/lobby reload`.

With `data-directory: data` and owner `shalobby`, the exact persistent default path is:

```text
<paper>/plugins/ShamooRuntime/data/shalobby
```

A changed relative `data-directory` remains under `plugins/ShamooRuntime`; an absolute value uses
that root. Runtime always appends the owner. The final resolved owner directory and the watched
`plugins.directory` must not contain or overlap one another in either direction.

## First-Start Defaults

Runtime ensures exactly these files and never replaces an existing file during `ensure`:

| File             | Current generated content                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `config.yml`     | Managed world `world`, join reset/welcome, protection, enforcement, visibility, and cooldowns |
| `messages.yml`   | Spanish messages, two titles, three sounds, and two data-free particles                       |
| `items.yml`      | Five managed hotbar items in slots `0`, `1`, `4`, `7`, and `8`                                |
| `menus.yml`      | `game-selector`, `lobby-selector`, `profile`, and `settings`                                  |
| `scoreboard.yml` | Enabled animated sidebar with local player/session data                                       |
| `servers.yml`    | Six enabled Bungee server IDs and targets                                                     |
| `spawn.yml`      | `spawn: { configured: false }`                                                                |
| `portals.yml`    | Three disabled example portals in `world`                                                     |

The checked-in `defaults/` files are the coordinated-release fixture, not an installation step. The
coordinated Runtime source generates them byte for byte, and the cross-repository parity gate protects
that completed source match. Review proxy targets, world names, and portal bounds before opening the
lobby. The exact schema is in [Configuration](docs/CONFIGURATION.md).

## Spawn Semantics

There is exactly one optional global spawn:

```yaml
spawn: { configured: false }
```

After `/lobby setspawn`, Runtime atomically persists:

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

There are no spawn lists, names, aliases, random choices, or per-world spawn definitions. Without a
configured spawn, join handling remains at Paper's native join location and the rest of the managed
lobby remains active; explicit spawn commands/actions and void rescue have no destination. Runtime
does not invent a temporary world fallback. A configured spawn must reference a loaded managed
world.

## Commands

All routes are declared in TypeScript. The current compiler infers every command parser from its
decorated parameter type, including the framework's online-player parser for `Player`.

| Command                                                 | Sender | Permission                   | Result                                                 |
| ------------------------------------------------------- | ------ | ---------------------------- | ------------------------------------------------------ |
| `/lobby`, `/spawn`, `/hub`                              | Player | `lobby.command.spawn`        | Equivalent standalone routes for the configured spawn  |
| `/lobby spawn <player>`                                 | Any    | `lobby.command.spawn.others` | Request another online player's spawn teleport         |
| `/lobby setspawn`                                       | Player | `lobby.command.setspawn`     | Persist the player's current managed-world location    |
| `/lobby reload`                                         | Any    | `lobby.command.reload`       | Reload all eight files and the command message catalog |
| `/lobby items give [player]`                            | Any    | `lobby.command.items`        | Restore the configured managed hotbar                  |
| `/lobby items reset [player]`                           | Any    | `lobby.command.items`        | Restore the configured managed hotbar                  |
| `/lobby menu open <menu> [player]`                      | Any    | `lobby.command.menu`         | Open a configured protected menu                       |
| `/lobby status`, `/lobby debug`                         | Any    | `lobby.command.debug`        | Show admin-only bounded Runtime diagnostics            |
| `/lobby portal wand`                                    | Player | `lobby.command.portal`       | Give the portal selection wand                         |
| `/lobby portal setpos1`, `/lobby portal setpos2`        | Player | `lobby.command.portal`       | Capture a selection corner at the player's block       |
| `/lobby portal create <portal> [server]`                | Player | `lobby.command.portal`       | Persist a selected portal; supports bounded options    |
| `/lobby portal delete <portal>`                         | Player | `lobby.command.portal`       | Delete a portal                                        |
| `/lobby portal list`                                    | Any    | `lobby.command.portal`       | List the count and a bounded truthful ID prefix        |
| `/lobby portal info <portal>`                           | Any    | `lobby.command.portal`       | Show bounded portal details                            |
| `/lobby portal enable <portal>`                         | Player | `lobby.command.portal`       | Enable a portal                                        |
| `/lobby portal disable <portal>`                        | Player | `lobby.command.portal`       | Disable a portal                                       |
| `/lobby portal setdestination server <portal> <server>` | Player | `lobby.command.portal`       | Set a Bungee server action                             |
| `/lobby portal setdestination spawn <portal>`           | Player | `lobby.command.portal`       | Set the global spawn action                            |
| `/lobby portal setdestination menu <portal> <menu>`     | Player | `lobby.command.portal`       | Set a menu action                                      |
| `/lobby portal visualize <true\|false>`                 | Player | `lobby.command.portal`       | Toggle bounded editor visualization                    |

`portal create` accepts `--permission`/`-p`, `--priority`/`-r`, `--cooldown`/`-c`,
`--enabled`/`-e`, and `--visualize`/`-v`. Portal writes additionally require the configured protection
bypass permission and a player in a managed world. Read-only `list` and `info` do not.

`/spawn` and `/hub` are independently registered top-level commands that perform the same operation as
`/lobby`; they are not native aliases of `/lobby`. If another plugin owns either label, inspect server
startup command-registration warnings and `/help <command>`, then remove or rename the conflicting
route in that plugin or use `/lobby`. ShaLobby has no alias list that can resolve a registration
collision.

Both status routes require `lobby.command.debug`. `status` shows state, native activity, invocation
admission, pending/maximum work, spawn state, and object counts; its server count includes all configured
`servers.yml` entries, whether enabled or disabled. `debug` additionally shows the Runtime generation
and resolved persistent directory; do not grant this permission to ordinary users because that path is
operationally sensitive. An uninitialized bridge still reports its safe generation/admission/queue
diagnostics; unavailable configuration counts are rendered as `n/a`, and only `debug` includes the
directory.

## Permissions

These are the exact permission nodes referenced by current TypeScript command routes:

- `lobby.command.spawn`
- `lobby.command.spawn.others`
- `lobby.command.setspawn`
- `lobby.command.reload`
- `lobby.command.items`
- `lobby.command.menu`
- `lobby.command.debug`
- `lobby.command.portal`

Runtime configuration also uses:

- `lobby.protection.bypass`: bypass all player-caused protection and authorize portal editing.
- `lobby.visibility.staff`: classify targets visible in `staff` mode and permit passive configured
  portal visualization.
- `lobby.portal.survival`, `lobby.portal.skyblock`, and `lobby.portal.minigames`: current example
  per-portal entry permissions.

The Runtime owner `shalobby` is a plugin identity, not a Bukkit permission or wildcard grant.

## Runtime Behavior

Runtime owns authoritative YAML parsing, strict validation, cross-references, native registry/world
preflight, Paper events and effects, and durable atomic persistence. It scopes behavior to worlds in
`config.yml.worlds` and applies protection as one all-or-nothing switch plus bypass.

TypeScript owns plugin lifecycle, command declarations and handlers, safe command replies, the
configurable command-message catalog, reload serialization, and bounded data-only bridge requests.
It does not receive Bukkit objects or general filesystem/native access.

The native Runtime listeners currently provide these concrete behaviors:

- Main-hand right-click-air and right-click-block execute configured managed-item actions; left-click
  remains inert except for portal-wand selection.
- Menus are player-, generation-, inventory-, and token-bound. Click/drag protection remains after a
  live session is invalidated, including for bypass players.
- Join and managed respawn apply the configured spawn semantics, managed hotbar, sidebar, and visibility
  refresh; join setup runs only after a configured asynchronous teleport succeeds.
- Movement portals select in memory, defer the action to the entity scheduler, and revalidate bridge
  ownership, online/managed state, portal/action identity, permission, occupancy, containment, and
  highest priority before execution.
- Sidebar updates reclaim the managed scoreboard if another plugin replaces it, then restore the
  scoreboard observed immediately before the latest reclaim when ownership ends.
- Join, quit, managed-world entry/exit, respawn, reload, and handoff refresh visibility so both the
  changing player and remaining viewers converge on the configured mode.

With protection enabled, synchronous native cancellation covers player damage, food/exhaustion and
hostile targeting; inventory click/drag/move/pickup, drop/pickup/swap/consume/item damage; item and
bucket interactions; armor stands, entities, hangings, leash and shear; block break/place/dispense,
farmland interaction, fertilization and cauldrons; TNT priming, fire/burn/fade/form/grow/spread, moisture,
leaves, sponge absorption, fluids and pistons; block/entity explosions and entity block changes;
projectiles, portals, vehicles, structures, weather and thunder. Player-caused checks honor bypass;
environmental checks and managed artifacts remain protected as documented.

These listeners are Runtime-owned by design. Generic ShamooTS event DTOs cannot safely preserve the
synchronous cancellation and direct player/inventory/world mutation required by Paper events, and an
asynchronous JavaScript round trip would introduce races. TypeScript therefore requests bounded native
actions but does not own gameplay listeners.

A successful TypeScript enable means the configuration candidate and command catalog were accepted.
It does not itself prove native activation: the coordinated Runtime keeps the candidate in standby and
activates it only after invocation admission opens. `ready` plus `active=true` in admin status is the
post-admission native state.

Reload is transactional for a stable file generation: Runtime snapshots all eight files, parses and
preflights the complete candidate, checks that the snapshot did not change, and swaps native state
only after success. The successful reload response includes bounded `messagesContent` from that same
accepted snapshot; TypeScript validates and commits only that correlated text. A Runtime rejection
preserves both the active Runtime configuration and previous command catalog, while a malformed success
response fails closed and preserves the previous command catalog. See [Runtime](docs/RUNTIME.md).

## Transfers And Placeholders

`connect` resolves an enabled `servers.yml` ID and sends the configured `target` through the Bungee
`Connect` subchannel. Sending the plugin message is only a request; it does not prove proxy acceptance,
server health, or player connection.

The only built-in Runtime presentation placeholders are `%player%`, `%online%`, `%world%`, `%x%`,
`%y%`, `%z%`, `%ping%`, and `%visibility%`. `%online%` is the local Paper player count. There are no
built-in rank, coins, proxy status, capacity, or network-wide online values, and the defaults do not
fabricate them.

## Intentional Limits

- Runtime deliberately rejects arbitrary console commands, reflective Bukkit access, proxy pings,
  external placeholder providers, and particles that require custom data.
- Protection has no per-event toggles; it is currently all-or-nothing plus bypass.
- Spawn is one optional global location, with no native fallback when unconfigured.
- Bungee `Connect` has no acknowledgement and no automatic retry.
- Player visibility state, cooldowns, portal selections, and visualization toggles are in memory.
- Configuration applies only to explicitly managed worlds.
- Runtime artifact replacement and YAML reload are separate lifecycle transactions.
- Script-generation replacement may remain hot, but live disable, reload, or replacement of the
  ShamooRuntime Java plugin is unsupported; stop the full server before replacing Runtime.

Only the first managed-bridge activation during one Java Runtime lifetime may apply `join.reset` to
players who were already online. Later YAML reloads and hot script-generation handoffs reconcile the
managed hotbar, sidebar, visibility, world policy, and generation artifacts without clearing ordinary
inventory, potion effects, experience, flight, or staff state. A truly cold reset for already-online
players requires stopping the server; reconnecting players then receive normal destructive join-reset
semantics and must be treated accordingly.

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs Prettier verification, ESLint, TypeScript checking, Vitest, and public `rc.1`
`shamooc`. A successful build produces exactly the three files in `dist/` shown above and proves the
ShaLobby source gate, not release-correct inferred route parsers or process compatibility. The final
artifact must be rebuilt with the current coordinated compiler and its `shamoo-plugin.json` route
parsers inspected. Tests also hash two consecutive public-compiler builds and require identical output.

## Documentation

- [Administrator Guide](docs/ADMIN.md)
- [Configuration Reference](docs/CONFIGURATION.md)
- [Runtime Operations](docs/RUNTIME.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)
- [Implementation Plan And Status](docs/PLAN.md)
