# ShaLobby

ShaLobby is a TypeScript Paper lobby plugin running on ShamooRuntime. Its listeners, inventories,
scoreboards, player state, portals, visibility, proxy transfers, YAML parsing, and commands are all
implemented in this repository.

It uses ShamooRuntime's plugin-neutral generated Paper bridge. There is no `shalobby` owner gate,
`paperManagedLobby` host function, or lobby implementation inside ShamooRuntime.

## Requirements

- Paper 1.21.8
- A coordinated ShamooRuntime build containing executable generated Paper bindings
- Node 22 and pnpm 11 for development

## Build

```bash
pnpm install
pnpm check
```

Until the coordinated ShamooTS release is published, the repository must be next to the local
`shamoo/ShamooTS` checkout referenced by `package.json`. The build automatically compiles the linked
ShamooTS dependency closure first, so both `pnpm build` and `npm run build` use current declarations
and compiler behavior rather than stale package output. A source fingerprint avoids rebuilding the
framework again when neither its commit nor its local changes have changed.

`pnpm build` emits the three compiled plugin files plus `dist/data/*.yml`. Runtime copies missing
seed files into stable policy-confined storage on first load and preserves subsequent administrator
edits.

## Runtime Data

The default Paper Runtime location is:

```text
plugins/ShamooRuntime/plugin-data/shalobby/data/
```

The plugin manifest grants ShaLobby read/write access only to its own `data` path. The Runtime data
store is outside the watched plugin artifact directory, so a YAML write does not trigger an artifact
reload.

## Implementation

- `src/events.ts`: generated Paper event subscriptions and synchronous protection handlers
- `src/lobby.ts`: player lifecycle, items, menus, scoreboards, portals, visibility, and transfers
- `src/api.ts`: small typed helpers over `paperJava`
- `src/configuration.ts`: YAML loading, validation, and persistence
- `src/commands.ts`: Spanish command surface
- `defaults/`: initial persistent configuration

See [Architecture](docs/ARCHITECTURE.md), [Configuration](docs/CONFIGURATION.md), and
[Runtime](docs/RUNTIME.md).
