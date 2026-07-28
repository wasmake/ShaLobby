# Architecture

## Current System

ShaLobby is implemented as a TypeScript lifecycle and command layer over a purpose-built native
ShamooRuntime capability. The source quality and compiler gates pass. The coordinated Runtime bridge
and matching upstream `@shamoo/paper` API and compiler parser inference are not published in
`0.1.0-rc.1`, so the plugin currently uses its own bounded direct-host adapter while retaining published
dependencies for reproducible source checks. Release artifacts require the current coordinated
compiler.

The architectural boundary is:

> Runtime owns configuration truth, persistence, Paper state, and native effects. TypeScript owns
> plugin lifecycle, command policy, command messages, and bounded requests.

This is not the older design in which TypeScript owned a lobby domain model or parsed all eight YAML
files. Runtime is now the authoritative parser and application engine.

## System Context

```text
<paper>/plugins/ShamooRuntime/config.yml
  managed-lobby enabled + exact owner + data root
                         |
                         v
Runtime owner gate -- admits only manifest PluginId("shalobby")
                         |
      +------------------+------------------+
      |                                     |
      v                                     v
persistent eight-file YAML            ShaLobby TypeScript
Runtime data/shalobby/                 lifecycle + commands
      |                                command message catalog
      | authoritative parse,           bounded direct-host adapter
      | validate, preflight                   |
      +------------------+--------------------+
                         |
                         v
ShamooRuntime managed-lobby generation
  Paper events and owner schedulers
  world rules, join/reset, spawn, protection
  items, menus, sidebar, visibility, portals
  atomic YAML writes and Bungee Connect requests
```

No Bukkit, Paper, Adventure, Javet, filesystem handle, or arbitrary native object crosses into
TypeScript. Request and response envelopes contain recursively copied JSON-compatible data and player
UUIDs.

## Artifact And Data Boundaries

The default roots have independent lifecycles:

```text
<paper>/plugins/ShamooRuntime/plugins/shalobby/   watched executable candidate
<paper>/plugins/ShamooRuntime/data/shalobby/      persistent managed data
```

The executable candidate contains exactly `index.js`, `index.js.map`, and `shamoo-plugin.json`.
Runtime stages and replaces it transactionally.

The persistent root contains exactly the known YAML basenames. Runtime creates missing defaults,
confines reads/writes, rejects symbolic links and traversal, and never deletes data during plugin
generation cleanup. `managed-lobby.data-directory` can move the data root, but Runtime always appends
the authorized owner. The final owner directory and `plugins.directory` may not overlap in either
direction.

## TypeScript Components

| Module                 | Responsibility                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `src/paper.ts`         | Paper entrypoint export surface                                                               |
| `src/application.ts`   | Enable lifecycle, startup order, serialized reload transactions, message commit               |
| `src/commands.ts`      | Exact command routes, senders, permissions, argument shaping, safe replies                    |
| `src/messages.ts`      | Bounded configurable command-message map, compiled fallbacks, safe substitutions              |
| `src/managed-lobby.ts` | Internal direct-host request/response types, one host copy boundary, exact validation, errors |
| `src/logging.ts`       | Bounded structured lifecycle and command logging                                              |

`ShaLobbyApplication.start()` performs `ensure`, asks Runtime to reload, validates the correlated
`messagesContent` from that accepted snapshot, commits the command catalog, then marks the configuration
accepted. This is a TypeScript preparation/standby state, not proof of native activation; Runtime
activates only after invocation admission opens. The command classes map routes to exact bridge
operations. They do not parse lobby YAML, manipulate Paper state, or persist files themselves.

The TypeScript message catalog is intentionally narrow. It extracts `messages` for command replies,
keeps compiled Spanish fallbacks, escapes dynamic MiniMessage values, and preserves its previous map
when correlated-content staging or Runtime reload fails. Runtime still authoritatively validates all of
`messages.yml`, including messages, titles, sounds, and particles.

## Internal Direct-Host Adapter

The published `@shamoo/paper@0.1.0-rc.1` lacks the coordinated managed-lobby export. ShaLobby therefore
calls the owner-captured `globalThis.host.paperManagedLobby` through a local adapter.

Before a call, the adapter:

- accepts only exact known operation/action shapes;
- requires canonical lowercase IDs, permission syntax, finite bounded integers, and canonical UUIDs;
- recursively copies and freezes arrays and plain records;
- rejects accessors, symbols, undefined values, sparse or decorated arrays, cycles, excessive depth,
  oversized collections, excessive node counts, and oversized text; and
- requires the native host function to return a Promise.

It applies one copied-data boundary to host results, requires `ok` and bounded `state`, and requires a
bounded `error` only on failures. Runtime failures become typed host errors; raw details are logged but
not copied into player replies. Because failures currently contain no separately safe message,
TypeScript does not infer missing-spawn, portal-selection, or editor-permission causes from that raw
text.

ShaLobby then validates successful responses against the emitted operation/action before any command
uses them. Reload requires bounded `messagesContent` and exact counts; status requires admission, queue,
directory, generation and configuration fields; portal reads require complete validated portal/action
maps; and every mutation response must match its requested resource and effect.

The adapter is a temporary publication bridge, not a second Paper API. After a matching Runtime and
`@shamoo/paper` release exists, ShaLobby can consume the upstream typed adapter and remove the local
copy in a coordinated source change.

## Runtime Components

| Runtime component              | Responsibility                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Paper bootstrap                | Reads feature settings, checks exact plugin owner, resolves data root, installs host binding           |
| `ManagedLobbyStore`            | Ensures defaults, confines eight files, snapshots, detects stale writes, atomic persistence and backup |
| `ManagedLobbyConfig`           | Safe YAML parsing, exact-key/range/reference validation, data-only immutable configuration             |
| `ManagedLobbyPortalIndex`      | Immutable world/chunk lookup, priority order, bounded indexing                                         |
| `ManagedLobbyRequest`          | Exact bounded host operation and execute-action validation                                             |
| `PaperManagedLobbyBridge`      | Native preflight, listeners, schedulers, effects, protection, lifecycle cleanup                        |
| `PaperManagedLobbyCoordinator` | Atomic native ownership handoff and previous-generation rollback                                       |

Runtime resolves all Paper-specific prerequisites before activation: loaded managed worlds, spawn and
portal worlds, portal height, game rules and value types, item materials and stack sizes, registry
sounds, and particles whose data type is `Void`.

## Ownership Matrix

| Concern                                                                                   | Owner                                         |
| ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| Plugin enable/disable                                                                     | TypeScript, hosted by Runtime lifecycle       |
| Command route syntax, sender, permission, and feedback key                                | TypeScript                                    |
| Configurable command messages and compiled fallbacks                                      | TypeScript                                    |
| Direct request envelope validation                                                        | TypeScript adapter and Runtime request parser |
| YAML parsing and complete schema validation                                               | Runtime                                       |
| Cross-file references and native resource preflight                                       | Runtime                                       |
| Persistent default generation, read, write, backup, and path confinement                  | Runtime                                       |
| Managed world rules and native events                                                     | Runtime                                       |
| Teleport, reset, protection, items, menus, sidebar, visibility, titles, sounds, particles | Runtime                                       |
| Portal lookup, transition, priority, cooldown, edit persistence                           | Runtime                                       |
| Bungee plugin-message construction and send                                               | Runtime                                       |
| Proxy route, acceptance, destination health, and connection completion                    | External proxy/operations                     |

## Owner Gate

Runtime exposes the binding only when configured with:

```yaml
managed-lobby:
  enabled: true
  owner: shalobby
  data-directory: data
```

The gate compares the canonical manifest `PluginId`. It is singular and independent from player
permissions. `lobby.*` nodes authorize commands and in-game behavior; they cannot authorize another
script plugin to receive the native host function.

The gate is defense in depth inside the Paper process. Runtime and ShaLobby are coordinated trusted
components, not separate operating-system security principals.

## Configuration Transaction

For a stable external file generation, startup and reload are transactional:

1. Runtime snapshots the exact eight files and store version.
2. Runtime parses all files with bounded safe YAML and exact object schemas.
3. Runtime validates IDs, ranges, references, actions, managed worlds, spawn, portals, and server
   allowlists.
4. Runtime prepares native resources on the global scheduler without publishing the candidate.
5. Runtime checks that neither version nor file text changed.
6. Runtime creates replacement periodic tasks and listener ownership.
7. Runtime swaps configuration and portal index, invalidates old menu sessions, reconciles changed
   world/player state, and cancels prior tasks.

Failure before the swap preserves the old configuration. Runtime-generated writes add a prior-byte
backup and use file and directory durability plus atomic rename before applying the prepared state.

TypeScript wraps this with a serialized transaction: invoke Runtime reload, validate and parse the
returned `messagesContent` from that same accepted snapshot, then commit messages. This prevents two
TypeScript reload commands from interleaving and eliminates the prior independent-read race. Runtime's
snapshot stability check rejects changes it observes, but non-cooperating external writes during reload
or mutation remain unsupported and operators must not edit concurrently.

## Native Event Flow

Runtime listeners cancel protection-sensitive events synchronously and directly mutate
player/inventory/world state; they never wait for JavaScript. Generic ShamooTS event DTOs cannot safely
provide those synchronous cancellation and mutation guarantees, so gameplay listeners intentionally
remain native. Asynchronous host requests and portal effects use bounded queues and the Paper
global/entity owners.

Portal entry demonstrates the native path:

```text
PlayerMoveEvent
  -> managed-world and block-transition check
  -> immutable chunk index selects highest priority portal
  -> permission and cooldown check
  -> bounded action queued to player scheduler
  -> ownership, player, portal, action, permission, occupancy, containment, priority revalidated
  -> spawn/menu/title/sound/particle/visibility or Bungee request
```

Overlapping portals are intentional. Highest priority wins; ID ascending breaks a tie. Cooldown starts
only after deferred revalidation accepts the native action, not when movement first queues it or when a
later proxy connection is confirmed.

## Spawn Invariant

The spawn file contains one optional global object. `configured: false` activates no native spawn.
`configured: true` requires one loaded managed world and all location fields. Lists, names, aliases,
per-world destinations, random selection, and fallback coordinates do not exist.

Without spawn, joins remain at Paper's native location while reset and presentation continue.
Explicit spawn operations return unavailable, respawn keeps its native event location, and void rescue
has no target. Runtime never substitutes the first managed world.

## Protection Model

Protection is deliberately one `enabled` flag plus one `bypass-permission`. It is not a map of
independent feature switches. Runtime applies it only in managed worlds and synchronously covers damage,
food/exhaustion, targeting, inventories and item movement/use, blocks and environmental growth/flow,
entities and hangings, buckets, armor stands, leash/shear, projectiles, explosions/TNT, portals,
vehicles, structures, fire, weather, and thunder.

Player-caused restrictions check bypass. Environmental mutation remains cancelled while protection is
enabled. Managed generation artifacts are always protected, including from bypassing administrators,
so staged replacement can clean up only its own resources safely.

## Presentation And Placeholders

Runtime renders trusted administrator MiniMessage strings. It has exactly eight built-ins:
`%player%`, `%online%`, `%world%`, `%x%`, `%y%`, `%z%`, `%ping%`, and `%visibility%`. It does not call
PlaceholderAPI or any external provider. There is no native rank, coins, proxy status, capacity, or
network-wide population value.

Sidebars are private per-player scoreboards. Duplicate rendered lines receive stable unique entries;
only changed title or line components are updated. If another plugin replaces the active scoreboard,
the next update reclaims the managed sidebar and records that replacement for restoration. Runtime
restores the latest scoreboard it replaced when a player leaves scope or the generation closes.

## Transfers

An enabled server entry is an allowlisted ID plus Bungee `target`. Runtime serializes the standard
`Connect` plugin message using the player as carrier. It does not ping the proxy, inspect a remote
server, or receive an acknowledgement. The strongest result is request sent; connection success and
server status remain unknown.

## Lifecycle And Handoff

Each Runtime generation owns its listeners, periodic tasks, bridge queue, menus, sidebars, artifacts,
visibility map, cooldowns, portal occupancy, selections, and visualizers. A candidate can parse and
prepare before invocation admission, but cannot take native ownership early.

Once admitted, the coordinator atomically activates the candidate and drains the prior generation.
Close fences new requests, settles pending promises, cancels native resources, cleans generation tags,
and restores presentation. If candidate installation rolls back, the prior admitted bridge can
reactivate. Persistent YAML remains outside this lifecycle.

Accordingly, a successful TypeScript enable log records configuration acceptance while native status
may still be `standby`. Operational readiness requires post-admission `ready`, `active=true`, and open
invocation admission.

Only the first managed bridge activated during one Java Runtime lifetime may apply `join.reset` to
players who are already online. Hot script-generation replacement and YAML reload reconcile managed
artifacts and presentation without clearing unrelated player state. Replacing, disabling, or reloading
the ShamooRuntime Java plugin live is unsupported; operators must use a full server stop for deterministic
native cleanup.

## Intentional Boundary

The Runtime bridge intentionally does not expose:

- arbitrary console or player command dispatch;
- general filesystem or network access;
- reflective Bukkit/Paper objects;
- proxy ping or transfer acknowledgement;
- external placeholder providers;
- fabricated server status, rank, coins, capacity, or population;
- custom particle data;
- named, listed, per-world, or weighted spawns; or
- per-event protection switches.

These are omissions by design, not undocumented extension hooks.

## Extension Rules

A future extension must preserve data-only, owner-gated, bounded requests and explicit native
preflight. New YAML keys require Runtime parser changes, strict tests, updated generated defaults when
applicable, and documentation. New host operations require coordinated Runtime and `@shamoo/paper`
publication.

Proxy acknowledgement requires a separate correlated proxy protocol; it cannot reinterpret Bungee
`Connect`. External placeholders require an explicit bounded provider contract and truthfully modeled
unavailability. Custom particle data requires a finite discriminated schema per supported Paper data
type. Multi-spawn behavior requires a new explicit schema and selection semantics rather than a list
silently added to the current file.
