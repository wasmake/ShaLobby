# Implementation Plan And Status

## Goal

Ship one coordinated, reproducible ShaLobby release in which the TypeScript plugin, the
`@shamoo/paper` managed-lobby API, and the Paper ShamooRuntime bridge use the same bounded protocol and
have been verified together on the supported host.

The ShaLobby implementation is complete. The remaining work is coordination, cross-repository
verification, process certification, and publication. The public `0.1.0-rc.1` artifacts must not be
relabeled as containing this feature: that compiler also predates inferred command parsers and cannot
produce the final ShaLobby route descriptors after explicit parser removal.

Runtime and ShaLobby source defaults now match byte for byte. Coordinated compiler/API/Runtime
publication and supported-host process certification remain outstanding.

## Status

| Area                                                                                                    | Current state                                                    |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Eight polished generated defaults                                                                       | Implemented in Runtime and mirrored in ShaLobby fixtures         |
| Runtime safe YAML schema, references, native preflight, and atomic store                                | Implemented in coordinated Runtime source                        |
| Runtime managed-world effects, protection, spawn, items, menus, sidebar, visibility, transfers, portals | Implemented in coordinated Runtime source                        |
| Runtime owner gate, bounded queues, generation handoff, rollback, and cleanup                           | Implemented in coordinated Runtime source                        |
| Upstream `@shamoo/paper` copied-data managed-lobby adapter                                              | Implemented in coordinated ShamooTS source                       |
| ShaLobby lifecycle and serialized message/Runtime reload                                                | Implemented and tested                                           |
| ShaLobby command surface and exact `lobby.*` permissions                                                | Implemented and tested                                           |
| ShaLobby bounded internal direct-host adapter                                                           | Implemented and tested for reproducible `rc.1` dependency builds |
| ShaLobby formatting, lint, typecheck, tests, and public-compiler source build                           | Passing                                                          |
| ShaLobby three-file build with current inferred parsers                                                 | Passing with current local CLI; unpublished                      |
| Coordinated API/Runtime publication                                                                     | Not present in public `0.1.0-rc.1`                               |
| Supported-host Paper/proxy certification of the assembled triplet                                       | Required before release                                          |
| Installable coordinated release with checksums and commit identities                                    | Not yet published                                                |

## Completed Contract

The implementation has converged on these non-negotiable rules:

- Runtime admits exactly the configured manifest owner and defaults to disabled.
- The persistent default root is `plugins/ShamooRuntime/data/shalobby`, independently configurable
  through `managed-lobby.data-directory`.
- Runtime automatically ensures exactly eight files; administrators do not provision defaults
  manually.
- Runtime owns authoritative safe YAML parsing, exact schemas, validation, native preflight, effects,
  persistence, and generation cleanup.
- TypeScript owns lifecycle, command routes, sender and permission policy, configurable command
  messages, safe feedback, reload serialization, and bounded requests.
- Spawn is one optional global discriminated object and has no list, name, per-world form, or native
  fallback.
- Protection is one all-or-nothing switch plus bypass.
- Configuration actions are exactly `none`, `spawn`, `menu`, `visibility`, `connect`, `title`, `sound`,
  and `particle`.
- Runtime presentation placeholders are exactly `%player%`, `%online%`, `%world%`, `%x%`, `%y%`,
  `%z%`, `%ping%`, and `%visibility%`.
- Server configuration is an enabled ID-to-Bungee-target allowlist, not status discovery.
- Portal overlap is deterministic by priority and ID rather than rejected.
- Bungee `Connect` means request sent, never player connected.
- Arbitrary console commands, proxy pings, external placeholders, fabricated status/rank/coins, and
  custom particle data are intentionally unsupported.

## Completed ShaLobby Work

ShaLobby currently provides:

- `@Plugin` enable lifecycle with `ensure`, Runtime reload, correlated message staging, and
  configuration-accepted standby state pending Runtime admission;
- serialized reload transactions that preserve the previous command catalog on failure;
- compiled Spanish fallback messages and configurable safe context substitution;
- typed host errors and safe player-facing failure selection;
- self commands `/lobby`, `/spawn`, and `/hub`;
- spawn administration, reload, item restoration, menu opening, and bounded status/debug commands;
- portal wand, selection, create/delete/list/info/enable/disable, server/spawn/menu destination, and
  visualization routes;
- exact route permissions under `lobby.command.*`;
- compiler-inferred command bindings with explicit handler-domain validation;
- a bounded internal adapter that validates, copies, freezes, and sends data-only requests; and
- source tests plus an exact defaults contract test.

The three-file output is already the required Runtime candidate shape.

## Completed Runtime Work

The coordinated Runtime source contains:

- disabled-by-default feature settings with exact owner comparison;
- a data root outside the watched plugin directory and owner-appended persistent path;
- automatic eight-file defaults and a shared generation-independent store;
- safe SnakeYAML limits, exact object key sets, ranges, references, and immutable configuration;
- loaded-world, game-rule, material, stack-size, sound, and data-free-particle preflight;
- file snapshots, stale detection, prior-byte backup, file/directory `fsync`, and atomic rename;
- join/reset/welcome, respawn, void rescue, world enforcement, sidebar, visibility, and artifacts;
- synchronous all-or-nothing protection plus player bypass;
- immutable bounded portal indexing, transition checks, priority, permissions, cooldown, editor writes,
  and server/spawn/menu destinations;
- standard Bungee `Connect` request construction without acknowledgement claims;
- bounded file/global/player work and explicit Promise result maps; and
- generation admission, ownership handoff, rollback reactivation, and deterministic cleanup.

## Completed Upstream API Work

The coordinated ShamooTS source contains the data-only `paperManagedLobby` surface with exact file,
operation, execute-action, copied-data, error, and Promise validation. This API is not in the public
`@shamoo/paper@0.1.0-rc.1` package.

ShaLobby keeps its local adapter until publication so its lockfile can continue to use released
dependencies. That temporary duplication must not become a long-term protocol fork.

## Remaining Gate 1: Protocol Parity

Before publication, freeze one exact request fixture set shared by ShaLobby, ShamooTS, and Runtime:

1. Confirm operation shapes for `ensure`, `read`, `write`, `reload`, `status`, and `execute`.
2. Confirm canonical UUID, ID, permission, integer, boolean, file, text, graph, and response limits.
3. Confirm every destructive portal action carries an editor player UUID.
4. Confirm `portal-destination` uses `type: server|spawn|menu` with required/forbidden `target` rules.
5. Confirm failure states and the rule that successful maps cannot contain `error`.
6. Confirm the local ShaLobby adapter and upstream API accept and reject the same requests ShaLobby
   uses.
7. Reject the public `rc.1` Runtime as a negative fixture because its host function is absent.
8. Generate a pristine Runtime defaults directory and require byte parity with all eight ShaLobby
   fixtures.
9. Confirm successful `reload` returns bounded `messagesContent` from its accepted snapshot and that
   every optional request field follows omission-only semantics.

Acceptance gate: shared fixtures pass in TypeScript and Java and no unpublished compatibility shim is
needed.

## Remaining Gate 2: Repository Verification

Run and record the full gates at immutable commits:

```bash
# ShaLobby
pnpm install --frozen-lockfile
pnpm check

# ShamooTS
pnpm install --frozen-lockfile
pnpm check

# ShamooRuntime
./gradlew check
./gradlew :bootstrap-paper:reobfJar
```

Acceptance gate: all repositories pass with no skipped protocol, owner, store, lifecycle, or defaults
tests, and the three-file ShaLobby artifact is reproducible.

## Remaining Gate 3: Supported-Host Process Test

Assemble exact commits on Linux x86-64, Java 21, and Paper 1.21.8:

1. Start with only the coordinated Runtime and three-file ShaLobby candidate.
2. Verify automatic generation of exactly eight defaults at the exact default data path.
3. Verify unconfigured spawn behavior without fallback, then configure it using `/lobby setspawn`.
4. Test join reset/welcome/teleport, respawn, managed-world entry/exit, and void rescue.
5. Test every managed item and menu action plus sidebar frame and line updates.
6. Test visibility modes with ordinary, staff, self, managed, and unmanaged players.
7. Test protection with and without bypass, including environmental events and immutable artifacts.
8. Test portals for entry/stay/exit, overlap priority, ID tie-break, permission, cooldown, editor
   persistence, and all destination kinds.
9. Connect a test Bungee-compatible proxy and capture the exact `Connect` target while retaining
   request-only user messaging.
10. Introduce invalid YAML, bad references, missing worlds, invalid game rules/materials/sounds,
    custom-data particles, stale file changes, and queue overload; confirm the old state remains active.
11. Replace and roll back the ShaLobby candidate; confirm native ownership and presentation handoff
    without persistent-data loss.
12. Attempt bridge access from another plugin identity and confirm no host binding is exposed.

Acceptance gate: automated and manual process evidence passes on the supported topology and logs make
no proxy health or connection-success claims.

## Remaining Gate 4: Publication

1. Publish a new ShamooRuntime Paper artifact containing the owner-gated bridge.
2. Publish the matching `@shamoo/paper` package with the frozen adapter contract.
3. Update ShaLobby dependencies to those versions in a source change.
4. Replace the temporary local direct-host implementation with the upstream API and remove duplicate
   protocol code.
5. Re-run all three repository gates and supported-host process tests.
6. Publish the exact three-file ShaLobby build with Runtime, API, ShaLobby, Paper, Java, OS, and CPU
   identities and checksums.
7. Publish installation instructions that rely on automatic defaults and preserve the external data
   directory across artifact replacement.

Acceptance gate: an administrator can verify one compatible triplet and reproduce the tested layout.
The version must be newer than `rc.1`; existing release artifacts and tags remain immutable.

## Deferred Extensions

The following are explicitly outside the release gate:

- correlated proxy acknowledgement or destination health;
- rank, economy, external placeholders, or network-wide population;
- arbitrary console commands;
- custom particle-data variants;
- multiple, named, weighted, random, or per-world spawns;
- per-event protection switches;
- durable player visibility, cooldown, selection, or visualization state;
- other operating systems, CPU architectures, Paper versions, or Velocity-only hosting; and
- web or database administration.

Each requires a new bounded contract and truthful availability model. None may be inferred from the
current schemas.
