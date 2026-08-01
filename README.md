# ShaLobby

ShaLobby is a TypeScript Paper lobby plugin running on ShamooRuntime. Its listeners, inventories,
scoreboards, typewriter bossbar and player list, player state, portals, visibility, proxy transfers,
YAML parsing, and commands are all implemented in this repository.

It uses ShamooRuntime's plugin-neutral generated Paper bridge. There is no `shalobby` owner gate,
`paperManagedLobby` host function, or lobby implementation inside ShamooRuntime.

## Requirements

- Paper 26.2
- A coordinated ShamooRuntime build containing executable generated Paper bindings
- Node 22 and pnpm 11 for development

## Build

```bash
pnpm install
pnpm check
```

The project installs its coordinated ShamooTS dependencies from the scoped registry configured in
`.npmrc`. It does not require a local ShamooTS checkout.

The pinned Shamoo bundler is patched to target a neutral JavaScript runtime. This selects
browser-safe dependency exports and prevents unsupported Node built-in imports in the plugin bundle.

`pnpm build` emits the lowercase `shalobby/` plugin directory and a compressed
`shalobby.tar.gz` package. The directory contains the three compiled plugin files plus
`shalobby/data/*.yml`; macOS metadata is excluded from both outputs. Runtime copies missing seed
files into stable policy-confined storage on first load and preserves subsequent administrator edits.

## Runtime Data

The default Paper Runtime location is:

```text
plugins/ShamooRuntime/plugin-data/shalobby/data/
```

The plugin manifest grants ShaLobby read/write access only to its own `data` path. The Runtime data
store is outside the watched plugin artifact directory, so a YAML write does not trigger an artifact
reload.

## Implementation

- `src/listeners/`: separate lifecycle, interaction, and protection event components
- `src/commands/`: separate spawn, item, menu, runtime, and portal command components
- `src/managers/`: portal persistence, portal sessions, visibility, and pure portal rules
- `src/handlers/`: lobby lifecycle and managed-operation coordination
- `src/providers/`: active configuration, YAML storage, and portal persistence implementations
- `src/configuration/`: per-object models plus strict cross-file decoding
- `src/platform/paper/`: Paper bridge, plugin lifecycle, and Folia-aware handler
- `src/api/`: managed-lobby contracts and provider interfaces
- `src/messages/`: message catalog and console logging
- `src/composition.ts`: concrete dependency wiring
- `defaults/`: initial persistent configuration

See [Architecture](docs/ARCHITECTURE.md), [Configuration](docs/CONFIGURATION.md), and
[Runtime](docs/RUNTIME.md).
