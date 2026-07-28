# Runtime Operations

## Release Status

ShaLobby's TypeScript implementation builds and passes its source quality gate. The coordinated
ShamooRuntime `managed-lobby` bridge and the matching upstream `@shamoo/paper` API are not part of the
published `0.1.0-rc.1` artifacts. A public `rc.1` Runtime will load without the required
`host.paperManagedLobby` binding and cannot run ShaLobby.

The plugin therefore uses a bounded internal direct-host adapter for reproducible builds with the
currently published package set. Deployment still requires a coordinated Paper Runtime JAR built from
the bridge source. Do not infer compatibility from matching `rc.1` labels.

Coordinated Runtime and ShaLobby source have correlated `messagesContent`, the same omission-only request
fields, and byte-identical defaults. Current ShamooTS also infers command parsers from decorated
parameter types. Public `rc.1` `shamooc` predates that inference and can emit old string defaults after
parser omission, so a release artifact must be built with the current coordinated compiler and have its
route parsers inspected. Source parity is complete; coordinated publication and supported-host process
verification remain pending.

## Supported Host

| Component         | Required value                                          |
| ----------------- | ------------------------------------------------------- |
| OS and CPU        | Linux x86-64                                            |
| Java              | 21                                                      |
| Paper             | Exact 1.21.8 support target                             |
| ShaLobby identity | Manifest name `shalobby`                                |
| Runtime           | Coordinated Paper build containing `managed-lobby`      |
| Proxy             | Bungee-compatible plugin messaging for transfer actions |

The pinned Javet Node distribution creates the Linux x86-64 restriction. No support claim is made for
Windows, macOS, ARM64, another Paper version, Velocity-only hosting, or the published `rc.1` Runtime.
The managed-lobby feature supports standard Paper 1.21.8 only. Generic ShamooRuntime Folia support is a
separate capability and does not make this feature Folia-compatible.

## Runtime Configuration

Edit `<paper>/plugins/ShamooRuntime/config.yml` and preserve its other sections:

```yaml
managed-lobby:
  enabled: true
  owner: shalobby
  data-directory: data
  maximum-pending-actions: 64
```

| Key                       | Runtime default | Meaning                                                                        |
| ------------------------- | --------------- | ------------------------------------------------------------------------------ |
| `enabled`                 | `false`         | Exposes no bridge unless explicitly enabled                                    |
| `owner`                   | `shalobby`      | Exact manifest identity allowed to receive the host function                   |
| `data-directory`          | `data`          | Persistent root, relative to the Runtime data folder unless absolute           |
| `maximum-pending-actions` | `64`            | Shared bounded file/global/entity pending-work limit; accepted range `1..4096` |

The owner comparison uses the manifest plugin ID, not folder name, command permission, operator state,
or display name. A disabled feature or owner mismatch means the plugin receives no
`paperManagedLobby` host function.

Runtime appends the owner after resolving the configured root. That final owner directory and
`plugins.directory` must not overlap in either direction.

## Directory Layout

With both generated relative directory settings:

```text
<paper>/
  plugins/
    <coordinated-runtime-paper>.jar
    ShamooRuntime/
      config.yml
      plugins/
        shalobby/
          index.js
          index.js.map
          shamoo-plugin.json
      data/
        shalobby/
          config.yml
          messages.yml
          items.yml
          menus.yml
          scoreboard.yml
          servers.yml
          spawn.yml
          portals.yml
```

The exact persistent default path is
`<paper>/plugins/ShamooRuntime/data/shalobby`. Changing `data-directory` changes the root; Runtime
still appends `/shalobby`.

`plugins/shalobby` is the watched executable candidate and contains exactly three build artifacts.
`data/shalobby` is durable Runtime-owned configuration and survives artifact replacement. Never place
YAML in the watched plugin candidate.

## Installation And Startup

1. Verify the coordinated Runtime and ShaLobby source/build identities.
2. Stop Paper and install the coordinated Paper Runtime JAR.
3. Enable `managed-lobby` for owner `shalobby` with `data-directory: data`.
4. Install the three ShaLobby build files under `ShamooRuntime/plugins/shalobby/`.
5. Start Paper. ShaLobby calls `ensure`; Runtime creates every missing default among the eight files.
   Existing files are left untouched. Do not manually copy defaults.
6. Runtime reads all eight files, performs strict YAML and reference validation, and preflights Paper
   worlds, game rules, materials, sounds, and particles. TypeScript enable then reports configuration
   acceptance/standby; Runtime activates the native generation only after invocation admission opens.
7. Stand in configured managed world `world` and run `/lobby setspawn`.
8. Review generated server targets and disabled portal examples, then optionally run `/lobby reload`.

Only this first managed-bridge activation during the Java Runtime lifetime may apply `join.reset` to
players who were already online when activation occurs. Stop the full server before first enabling the
feature on a populated process and treat that cold activation as destructive. Later script-generation
handoffs and YAML reloads restore managed artifacts/presentation without clearing ordinary inventory,
effects, experience, flight, or staff state.

On a healthy post-admission startup, `/lobby status` reports `ready`, `active=true`, invocation
admission, pending/maximum work, `spawnConfigured`, and item/menu/server/portal counts. `/lobby debug`
adds the Runtime generation and persistent directory, whose returned final form is capped at 512
characters. The server count includes every configured entry, whether enabled or disabled. Both routes
are protected by `lobby.command.debug`, and only debug exposes the sensitive path. These commands report
local bridge state, not proxy or destination health.

Before configuration is initialized, both routes still return bounded generation, admission, and queue
diagnostics. Configuration-derived counts display as `n/a`; the persistent directory remains exclusive
to `/lobby debug`.

## First-Start Storage

The store manages exactly eight known basenames. Paths outside that set, traversal, symbolic links,
non-regular files, and files larger than 1 MiB fail closed. `ensure` creates missing files individually
with the polished defaults embedded in Runtime. It does not overwrite an existing administrator file.

The generated set has five hotbar items, four menus, six enabled server entries, an animated sidebar,
three disabled example portals, and `spawn: { configured: false }`.

There is no `effects.yml`, spawn list, aliases file, domain cache, or source-artifact configuration.

## Bridge Contract

`host.paperManagedLobby(request)` accepts exactly one copied data object and returns a Promise of a
copied data map. Every result has `ok` and `state`; failures also have a bounded `error`. Expected
failure states include `invalid`, `unknown`, `unavailable`, `overloaded`, and `error`.

The current failure envelope has no separately safe player-facing message. TypeScript therefore maps
only the broad state to configured Spanish feedback, logs the bounded error for operators, and never
parses or displays raw error text. In particular, `unavailable` can mean missing spawn, unmanaged player
context, incomplete portal selection, missing editor authorization, standby, or a closed bridge; the
user-facing wording does not falsely claim Runtime downtime or infer one cause.

The Runtime operations are:

| Operation | Behavior                                                                       |
| --------- | ------------------------------------------------------------------------------ |
| `ensure`  | Confine the data path and create missing defaults                              |
| `read`    | Read one known file or all eight                                               |
| `write`   | Validate a bounded file write, with reload enabled by default                  |
| `reload`  | Snapshot, parse, native-preflight, and apply all eight files                   |
| `status`  | Return bounded local generation/configuration state                            |
| `execute` | Run one exact native action for an online managed-world player or portal admin |

The ShaLobby internal adapter intentionally exposes only the requests its current lifecycle and
commands need: `ensure`, `reload`, `status`, and bounded execute actions. It
recursively rejects cycles, accessors, undefined values, non-finite numbers, non-plain objects,
oversized graphs, unknown keys, malformed IDs, malformed permissions, and noncanonical player UUIDs
before invoking Runtime.

The default transport establishes one broad copied-data and result-envelope boundary. Injected test
transports are typed to supply the same bounded envelope. ShaLobby then validates every successful
response for the exact emitted operation/action: expected state, required fields, types, ranges, counts,
portal shapes and action semantics. Malformed successes fail closed instead of producing placeholder
`?` or `0` output.

General Runtime execute actions are `setspawn`, `spawn`, `items`, `menu`, and `visibility`. Portal
administration actions are `portal-wand`, `portal-pos1`, `portal-pos2`, `portal-create`,
`portal-remove`, `portal-list`, `portal-info`, `portal-enable`, `portal-disable`,
`portal-destination`, and `portal-visualize`.

Portal destination requests are discriminated:

```javascript
{ operation: 'execute', action: 'portal-destination', player, id, type: 'server', target: 'survival' }
{ operation: 'execute', action: 'portal-destination', player, id, type: 'spawn' }
{ operation: 'execute', action: 'portal-destination', player, id, type: 'menu', target: 'game-selector' }
```

Server and menu targets must pass current configuration lookup. Spawn requires `target` to be omitted;
present `target`, including `null`, is invalid. Every optional `portal-create` field is likewise
omission-only and rejects explicit `null`.

## Atomic Reload

`/lobby reload` runs through this sequence:

1. TypeScript serializes the command behind any earlier reload.
2. Runtime snapshots all eight current file texts and the store version.
3. Runtime strictly parses the complete candidate and validates every native action and cross-file
   reference.
4. Runtime schedules native preflight for loaded managed worlds, spawn world, portal world heights,
   game rules, materials and stack sizes, sounds, and data-free particles.
5. Runtime checks that neither store version nor file text changed during preparation.
6. Runtime atomically replaces the active configuration, portal index, enforcement task, scoreboard
   task, menus, and affected player presentation.
7. Runtime returns bounded `messagesContent` captured from the same accepted snapshot.
8. TypeScript validates that operation-specific success and parses and commits the correlated command
   message map.

Any parse, reference, registry, world, range, stale-snapshot, queue, or native preparation failure
preserves the prior Runtime configuration and TypeScript command catalog. A spawn change does not
teleport all online players; future explicit triggers, joins, respawns, and void rescue use it.

There is no separate TypeScript-read/Runtime-snapshot race. Runtime rejects external changes that its
snapshot/version checks observe. Non-cooperating external writes that race a reload or Runtime-managed
mutation are unsupported, however, and operators must not edit the YAML concurrently. Missing,
malformed, or oversized `messagesContent` is treated as an invalid successful response and preserves the
prior TypeScript catalog; the coordinated Runtime contract must always return the accepted snapshot
text.

## Atomic Writes

`/lobby setspawn` and destructive portal commands build and preflight a complete candidate before
committing their single changed file. Persistence uses:

1. A confined same-directory temporary file.
2. File `fsync`.
3. Required same-filesystem atomic rename.
4. Directory `fsync`.
5. An atomically written `<file>.bak` containing the prior bytes.

Stale shared snapshots and external file changes are rejected before write or native apply. A failed
write leaves the active configuration unchanged.

## Spawn And Join Behavior

Spawn is one optional object, never a list:

```yaml
spawn: { configured: false }
```

When false, the lobby can activate. Join reset, welcome presentation, managed items, sidebar,
visibility, and protection continue to work at Paper's native join location. Explicit spawn requests
fail as unavailable, and respawn and void rescue retain native behavior because there is no target.
There is no temporary world fallback.

`/lobby setspawn` works only for an online player in a managed world. A configured spawn contains one
loaded managed world and exact coordinates, yaw, and pitch. Join teleport occurs only when
`join.teleport` is true; respawn replaces the event location without an additional delayed teleport.
After successful join teleport and one tick later after respawn, Runtime reapplies configured reset,
managed hotbar, sidebar, and visibility state while the player is still in managed scope.

## Native Scope And Protection

Every native lobby behavior is limited to worlds in `config.yml.worlds`. Leaving managed scope removes
owned artifacts, closes managed menus, and restores the previous scoreboard and visibility
presentation. Entering managed scope applies reset/restoration and presentation.

Protection is one switch:

```yaml
protection:
  enabled: true
  bypass-permission: lobby.protection.bypass
```

It covers player damage and attacks, hunger/exhaustion, hostile targeting; inventory
click/drag/move/pickup, drop/pickup/swap/consume/item damage; item/block interaction, buckets, armor
stands, entities/hangings, leash/shear; block break/place/dispense, farmland, fertilization, cauldrons,
TNT priming, burn/fade/form/grow/spread, moisture, leaves, sponge absorption, fluids and pistons;
explosions, entity block changes/placement, projectiles, portal creation/use, vehicle
enter/damage/destruction/collision, structure growth, weather and thunder. Player-caused checks honor
bypass; environmental checks remain protected. Managed generation-tagged items, menus, and portal
wands are independently immovable.

Managed hotbar actions execute only for main-hand right-click-air or right-click-block. Left clicks are
inert except for portal-wand selection. Menus require the current player/generation/inventory/token
session to execute actions, while managed menu click/drag protection survives invalidation and bypass.

There are no per-event protection fields. Adding such keys is a validation error.

## Portals

Enabled portals are indexed by world and chunk. Bounds are inclusive. Overlap is supported: higher
`priority` wins, then lexicographically smaller ID. Movement performs only in-memory scope, region,
permission, transition, and cooldown checks; the action is queued to the player's scheduler.

Entry is transition-based. Remaining inside does not repeat the action. Portal editor selections and
visualization state are generation-owned and in memory.

The deferred entity-scheduler callback revalidates bridge ownership, player online/managed state, the
current enabled portal and unchanged action, permission, occupancy, actual containment, and
highest-priority selection. Rejected or unavailable deferred actions do not start the cooldown.
The per-player, per-portal cooldown begins only after that deferred validation accepts the native
action.

Destructive portal calls require a player in a managed world with the configured protection bypass.
`portal-list` and `portal-info` are read-only. Visualization uses fixed `END_ROD` corner particles,
bounded to portals in the current world within 96 blocks.

## Bungee Transfers

For a `connect` action, TypeScript/YAML identifies an enabled server ID. Runtime sends:

```text
channel: BungeeCord
subchannel: Connect
argument: servers.yml target
carrier: requesting online player
```

The proxy must already define that target. ShaLobby does not create routes, open a network socket, or
ping a proxy. `sendPluginMessage` means only that the request was sent from Paper. It does not confirm
proxy acceptance, destination health, or player connection, and there is no acknowledgement-driven
retry or status update.

## Placeholders And Effects

The only native placeholders are `%player%`, `%online%`, `%world%`, `%x%`, `%y%`, `%z%`, `%ping%`, and
`%visibility%`. The online value is local to Paper. Runtime has no rank, coins, economy, external
placeholder, proxy status, server capacity, or network population provider.

Sounds and particles must resolve in Paper. Particle types requiring custom data fail preflight. The
bridge intentionally has no arbitrary console-command action, reflective Bukkit object access, proxy
ping, or custom particle-data envelope.

## Generation Lifecycle

Each plugin generation owns listeners, periodic tasks, menus, sidebars, visibility state, cooldowns,
portal selections, visualizers, and pending promises. A staged replacement validates while the prior
generation remains active. Native ownership transfers only after invocation admission opens. If a new
generation rolls back, the previous admitted generation is reactivated.

Closing a generation rejects new work, settles pending promises, cancels tasks, unregisters listeners,
closes owned menus, removes only that generation's artifacts, and restores presentation. Persistent
YAML is not deleted.

Script-generation hot replacement is supported while the ShamooRuntime Java plugin remains enabled.
Live disable, reload, or replacement of that Java plugin is unsupported for managed-lobby. Stop the full
standard Paper server before replacing Runtime so shutdown owns deterministic native cleanup.

## Build And Runtime Verification

From the coordinated ShamooRuntime checkout:

```bash
./gradlew check
./gradlew :bootstrap-paper:reobfJar
```

From ShaLobby:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` currently invokes public `rc.1` `shamooc`; it is a source gate, not the final inference
gate. Rebuild ShaLobby with the current local ShamooTS CLI and inspect every generated command argument
and option parser in `dist/shamoo-plugin.json` before assembling the triplet.

Process verification must run the assembled builds on Linux x86-64, Java 21, and Paper 1.21.8. Test
first-start generation, unconfigured/configured spawn, join and respawn, protection and bypass,
hotbar/menu ownership, sidebar restoration, all visibility modes, portal transition/priority/cooldown,
all three portal destination kinds, valid and invalid reload, generation replacement, and the exact
Bungee plugin-message payload.

## Troubleshooting

| Symptom                                      | Likely cause or check                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| Host operation unavailable                   | Installed Runtime is public `rc.1`, bridge is disabled, or owner mismatches       |
| Defaults appear in the wrong place           | Check resolved `data-directory`; owner `/shalobby` is always appended             |
| Startup remains uninitialized                | Inspect all eight files and native world/registry preflight errors                |
| `/lobby` reports unavailable                 | Configure spawn with `/lobby setspawn`; no fallback exists                        |
| `/spawn` or `/hub` resolves elsewhere        | Inspect `/help`, registration warnings, and plugins declaring the same command    |
| Reload fails but old UI remains              | Expected transactional preservation; fix the candidate and retry                  |
| Portal edit is denied                        | Editor needs command permission, bypass, online player context, and managed world |
| Portal chooses an unexpected overlap         | Compare priority, then ascending ID                                               |
| Transfer request does not move player        | Verify proxy messaging and exact `servers.yml.target`; no acknowledgement exists  |
| Rank, coins, or status token remains literal | No external placeholder provider is implemented                                   |
| Particle rejects reload                      | The Paper particle is unknown or requires unsupported custom data                 |
| Pending requests return overloaded           | Raise `maximum-pending-actions` cautiously or remove the source of queued work    |

## Security Notes

- Run Paper under a dedicated operating-system account and restrict writes to Runtime and data paths.
- Do not place credentials in lobby YAML; no schema field needs them.
- Keep the owner singular and disable the capability when ShaLobby is absent.
- Do not grant general filesystem, network, child-process, worker, or native-addon permissions to
  imitate the bridge.
- Treat MiniMessage source as trusted administrator configuration.
- Owner gating and isolate policy are defense in depth inside one JVM, not an OS sandbox.
