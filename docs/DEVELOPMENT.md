# Development

## Current Implementation

ShaLobby implements its TypeScript lifecycle, complete command surface, configurable command-message
catalog, bounded internal direct-host adapter, polished defaults contract, tests, and three-file Paper
build. `pnpm check` includes the build and passes for the current source.

The managed-lobby Runtime bridge, matching upstream `@shamoo/paper` API, and compiler command-parser
inference are implemented in coordinated source work but are not published in the `0.1.0-rc.1`
artifacts. Keep this distinction in code, tests, release notes, and process verification. A successful
public-compiler ShaLobby build does not add the bridge to a public Runtime and does not prove inferred
route parsers.

## Toolchain

- Node.js 22 or newer.
- pnpm 11 or newer; the project pins `pnpm@11.15.0`.
- TypeScript 5.8.
- Vitest 3.
- Linux x86-64, Java 21, and Paper 1.21.8 for runtime verification.
- A coordinated ShamooRuntime checkout for bridge builds and process tests.

Install from the checked-in lockfile:

```bash
corepack enable
pnpm install --frozen-lockfile
```

pnpm 11 project settings live in `pnpm-workspace.yaml`: automatic peer installation is disabled,
strict peers and engines are enabled, and exact dependency saving is enabled. `.npmrc` contains only
the scoped Shamoo registry. The lockfile is generated with `autoInstallPeers: false`; do not move that
setting back to an ignored `.npmrc` entry.

Certification runs `pnpm audit --audit-level=moderate` and currently has no moderate, high, or critical
findings. One documented low advisory remains: `GHSA-g7r4-m6w7-qqqr` affects the Windows development
server in `esbuild@0.27.7`, reached through the published `@shamoo/cli -> @shamoo/bundler` toolchain.
ShaLobby targets Linux and invokes esbuild only for compilation, not its development server; removal
requires a coordinated published CLI update.

## Repository Layout

```text
defaults/                   required byte-parity fixture for Runtime's generated eight defaults
docs/                       administrator, schema, Runtime, architecture, plan, and development docs
src/application.ts          startup and serialized reload transaction
src/commands.ts             lifecycle command routes, permissions, sender policy, bridge actions
src/logging.ts              structured bounded logging
src/managed-lobby.ts        temporary bounded direct-host adapter and client
src/messages.ts             configurable command messages and compiled fallbacks
src/paper.ts                Paper entrypoint exports
test/application.test.ts    lifecycle, correlated messages, rollback, reload serialization
test/commands.test.ts       exact request shapes, feedback, failures, sender UUID handling
test/defaults-contract.test.ts
                            strict defaults, IDs, slots, references, optional spawn
test/managed-lobby.test.ts  copied-data and direct-host protocol boundary
```

`defaults/` is not loaded by production TypeScript and is not copied during installation. Runtime owns
the embedded first-start defaults and persistent files.

## Quality And Build

Run the complete source gate:

```bash
pnpm check
```

It expands to:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Other useful commands:

```bash
pnpm format
pnpm test:watch
pnpm run doctor
pnpm build
```

`pnpm build` invokes the pinned public `rc.1` `shamooc`. A successful build leaves exactly:

```text
dist/index.js
dist/index.js.map
dist/shamoo-plugin.json
```

The manifest identity is `shalobby`, platform is Paper, and compatibility pins Minecraft and Paper API
`1.21.8`. General filesystem read/write, network, workers, child processes, native addons, and Node
builtins remain denied in `shamoo.config.json`; the owner-gated direct host capability is narrower.

ShaLobby command bindings intentionally omit every explicit parser and let current ShamooTS infer
`string`, `number`, `boolean`, or `player` from the parameter type. Public `rc.1` predates this compiler
feature and can emit old string descriptor defaults while still completing `pnpm check`. For the
coordinated gate, build the current CLI in the ShamooTS checkout, run its `packages/cli/dist/shamooc.js`
entry against ShaLobby, then inspect `dist/shamoo-plugin.json`. Do not update ShaLobby dependency
versions until the coordinated release is published.

## Source Testing

The current Vitest suite checks:

- startup order `ensure -> Runtime reload -> correlated messagesContent commit`;
- exact accepted-snapshot correlation and previous command-message preservation on malformed, missing,
  or oversized `messagesContent` and Runtime rejection;
- serialized concurrent TypeScript reload requests;
- configurable fallback messages and escaped dynamic MiniMessage values;
- exact command-to-Runtime request shapes for spawn, items, menus, and portal administration;
- source-level absence of explicit parsers/stale suggestions and concise inferred optional declarations;
- omission-only portal-create options and spawn destinations;
- operation/action-specific success validation before command output;
- pre-transport command ID, permission, and range validation without false success logging;
- all three independently registered equivalent self-spawn routes and player-target handling;
- bounded admin status/debug fields and safe Spanish host-failure feedback;
- enriched bounded portal lists/info and uninitialized status/debug diagnostics;
- hostile request graph rejection before host invocation;
- Promise/result envelope validation and copied frozen data;
- one production copied-result boundary with no second deep copy for a contract-valid injected transport;
- all eight defaults, exact fallback parity, the 15-line scoreboard and placeholder set, IDs, slots,
  current actions, references, portals, and optional spawn shape; and
- identical SHA-256 hashes for two consecutive three-file builds.

These tests use a fake direct host. They prove TypeScript behavior, not native Paper effects or proxy
acceptance.

The standalone test gate does not assume a sibling Runtime checkout. To compare a pristine directory
generated by a coordinated Runtime byte for byte, supply an explicit absolute path:

```bash
SHALOBBY_RUNTIME_DEFAULTS_DIR=/absolute/path/to/generated/shalobby pnpm test
```

Without that variable, only the cross-repository byte-parity case is skipped; all standalone defaults
and deterministic-build checks still run. A release candidate must run the parity case and may not ship
while it differs.

## Runtime Verification

Build and verify the coordinated Runtime from its checkout:

```bash
./gradlew check
./gradlew :bootstrap-paper:reobfJar
```

The Runtime suite must cover:

- disabled capability and wrong-owner denial;
- data-directory separation and confined eight-file storage;
- automatic defaults, symbolic-link/path/size rejection, backup, atomic rename, and stale snapshots;
- strict YAML keys, ranges, references, native registry checks, and optional spawn;
- portal priority, overlap, chunk limits, request discrimination, and editor identity;
- bounded file, global, and player queues;
- generation admission, handoff, rollback, and cleanup; and
- Bungee payload generation without a connection acknowledgement.

## Paper Process Verification

Run the assembled coordinated build on Linux x86-64, Java 21, and Paper 1.21.8. Use a disposable data
directory and a Bungee-compatible test proxy.

Verify at minimum:

1. First startup generates exactly eight files at `plugins/ShamooRuntime/data/shalobby`.
2. Existing YAML is not overwritten by a later `ensure`.
3. An unconfigured spawn keeps join behavior stable and rejects explicit spawn without fallback.
4. `/lobby setspawn` persists one configured global spawn and survives restart.
5. Join reset, welcome presentation, respawn placement, and void rescue are not duplicated.
6. Managed-world entry and exit apply and remove generation-owned items, menus, sidebar, and visibility.
7. Protection is all-or-nothing, player bypass works, and environmental protection remains active.
8. Managed items and menu contents remain immovable even with bypass.
9. The sidebar replaces only changed components and restores the previous scoreboard.
10. Visibility `all`, `staff`, and `none` behaves correctly for self, staff, ordinary, joining, leaving,
    managed, and unmanaged players.
11. Portal entry/stay/exit, overlap priority, tie-breaking, permission, cooldown, and disabled state work.
12. Portal server, spawn, and menu destinations persist and execute their exact native actions.
13. Bungee `Connect` sends the configured `servers.yml.target` and no message claims connection success.
14. Each malformed file, missing world, bad game rule, invalid material/sound/particle, and stale save
    rejects reload while preserving active presentation.
15. Artifact replacement cleans the old generation without deleting YAML and rollback reactivates the
    previous admitted generation.

## Runtime Bridge Development

The direct host boundary accepts copied data, never compiler metadata or native objects. Preserve these
constraints:

- exact object keys and discriminated operation/action types;
- canonical IDs and player UUIDs;
- finite bounded values and 1 MiB file/text ceilings where applicable;
- plain acyclic copied records/arrays only;
- Promise-based results with explicit success/failure state;
- owner and generation captured by Runtime, not claimed in a request;
- native mutation scheduled on the correct Paper global or entity owner; and
- outstanding work fenced and settled during close.

The internal ShaLobby adapter intentionally exposes only the subset used by the plugin. Do not expand
it to general file writes, arbitrary console dispatch, raw Paper reflection, proxy pings, external
placeholders, or arbitrary particle payloads.

When the coordinated upstream API is published:

1. Pin one published Runtime and `@shamoo/paper` version with matching request fixtures.
2. Replace the local `paperManagedLobby` implementation with the upstream export.
3. Retain ShaLobby's application client and command-level host-error mapping where useful.
4. Remove duplicated protocol code rather than maintaining compatibility shims for unpublished forms.
5. Run ShaLobby, ShamooTS, Runtime, and Paper process gates before release.

## Adding Configuration

Runtime owns the schema. To add a field:

1. Choose the exact file and object; do not add a parallel TypeScript domain config.
2. Add the Runtime immutable field, exact-key allowance, parser fallback, range, and semantic checks.
3. Add safe-YAML, valid, missing, boundary, malformed, unknown-key, and native-preflight Runtime tests.
4. Update Runtime's embedded default and this repository's matching `defaults/` fixture when the field
   should be generated.
5. Update `docs/CONFIGURATION.md`, administration guidance, and process tests together.
6. Define migration behavior explicitly if persisted installations cannot accept the change directly.

Do not silently accept legacy property names or have TypeScript reinterpret Runtime YAML.

## Adding A Native Action

Configuration actions are the exact discriminated set `none`, `spawn`, `menu`, `visibility`,
`connect`, `title`, `sound`, and `particle`. A new action requires:

1. A new Runtime enum member with explicit target cardinality.
2. Strict YAML parsing and cross-reference validation.
3. Bounded native execution on the player scheduler.
4. Native preflight and generation cleanup if it owns resources.
5. Runtime parser/action/process tests and updated defaults/docs if used there.
6. A bridge protocol change only if TypeScript commands need to request it directly.

Do not add a generic command action. Arbitrary console commands are intentionally unsupported; a
privileged bounded effect needs its own reviewed action type.

## Adding A Command

Commands remain TypeScript-owned:

1. Add an exact decorated route with sender and `lobby.*` permission.
2. Reuse one bounded Runtime execute action or add a coordinated discriminated request.
3. Add a configurable command-message fallback and include the same key in `defaults/messages.yml`.
4. Ensure player-controlled substitutions pass through command-message escaping.
5. Test exact request shape, denied/invalid sender behavior, safe failure mapping, and one reply.
6. Update command and permission tables in README, Admin, and Runtime docs.

Operator status is not an owner gate and does not replace explicit route permissions.

## Adding Presentation Data

The native placeholder set is deliberately fixed to `%player%`, `%online%`, `%world%`, `%x%`, `%y%`,
`%z%`, `%ping%`, and `%visibility%`. Do not add static rank, coins, or status fallbacks that can be
mistaken for real data.

An external provider requires a new bounded, timeout-aware, explicitly unavailable result model and a
coordinated security review. A proxy status feature requires a real request/response protocol; Bungee
`Connect` cannot supply it.

Particles are intentionally data-free. Supporting a particle with native custom data requires an
explicit discriminated DTO for that Paper data type, strict bounds, preflight, and tests. Do not expose
an arbitrary object field.

## Review Checklist

- Does Runtime remain the sole authoritative YAML and persistence owner?
- Does TypeScript remain responsible for lifecycle, commands, command messages, and bounded requests?
- Is only manifest owner `shalobby` admitted?
- Is persistent data outside the watched artifact directory?
- Does invalid or stale input preserve the active native configuration and command catalog?
- Is spawn still one optional global object with no fallback?
- Are all protection claims all-or-nothing plus bypass?
- Are Runtime placeholders limited to the eight built-ins?
- Does every transfer claim only that a Bungee request was sent?
- Are console commands, proxy pings, external placeholders, and custom particle data still bounded out?
- Were Linux x86-64, Java 21, Paper 1.21.8, Node 22, pnpm 11, Runtime, API, and ShaLobby identities
  recorded?
- Do release notes avoid claiming public `rc.1` includes the bridge?

## Documentation-Only Verification

For documentation-only changes, target only Markdown:

```bash
pnpm exec prettier --write README.md docs/*.md
pnpm exec prettier --check README.md docs/*.md
git diff --check
```
