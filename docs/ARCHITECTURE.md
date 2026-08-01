# Architecture

ShaLobby owns its gameplay. ShamooRuntime owns only reusable execution infrastructure.

## Boundary

ShaLobby responsibilities:

- Parse and validate eight YAML files.
- Subscribe to generated Paper events.
- Cancel and mutate live events.
- Create items, inventories, scoreboards, and locations.
- Apply player/world state, visibility, portals, and proxy transfers.
- Implement commands and Spanish feedback.

ShamooRuntime responsibilities:

- Load the generated public Paper member catalog.
- Create generation-scoped opaque Java handles.
- Route calls to global, region, or entity schedulers.
- Pump bounded calls on a synchronous event's originating thread.
- Adapt Java functional interfaces to owned JavaScript callbacks.
- Provide policy-confined persistent text files.
- Release handles, callbacks, listeners, and tasks with the plugin generation.

## Internal Boundaries

ShaLobby uses feature-oriented OOP packages with explicit ownership:

```text
commands/listeners/platform -> handlers/managers -> api
                                  ^               ^
                                  |               |
                              providers ---------+
```

- `listeners/` separates player lifecycle, interaction/inventory, and protection event adapters; no
  listener owns gameplay state.
- `commands/` separates spawn, item, menu, runtime, and portal command objects. Only generic
  validation, execution, and safe error mapping are shared through `command-support.ts`.
- `managers/` owns stateful business behavior. `PortalManager` owns persisted portal mutations,
  `PortalSessionManager` owns selections, occupancy, cooldowns, and visualization, and
  `VisibilityManager` owns visibility transitions and relationship decisions.
- `handlers/` coordinates lifecycle and managed operations without constructing concrete providers.
- `providers/` separates the active snapshot, YAML file storage, and portal persistence interfaces.
- `configuration/` separates each model concern and keeps strict cross-file decoding independent
  from storage.
- `platform/paper/` owns Paper handles, Folia scheduling, generated JVM calls, and plugin callbacks.
- `api/` contains managed-lobby contracts and provider interfaces used across packages.
- `messages/` owns configured player messages and console logging.
- `composition.ts` is the only module that constructs concrete managers, providers, and handlers.
- `paper.ts` exports only framework-discoverable plugin, command, and listener components.

Configuration values are decoded once. In particular, message templates, titles, sounds, and
particles are retained as immutable typed resources; gameplay code must not reinterpret raw YAML.
Invalid action combinations are excluded by discriminated configuration types, and persistence is
performed through provider interfaces rather than directly by commands or listeners.

## Paper Calls

`@shamoo/paper-raw` exports `JAVA_TYPES` and `paperJava`. Calls are asynchronous because Paper and
Folia thread ownership must be preserved:

```ts
const Bukkit = paperJava.resolve(JAVA_TYPES['org.bukkit.Bukkit']);
const players = await Bukkit.$invoke('getOnlinePlayers', '()Ljava/util/Collection;');
```

Java objects never become reflective Javet proxies. The TypeScript value is an opaque handle whose
owner and generation are checked on every call.

## Events

Runtime passes a live event handle into the generated callback. While JavaScript executes, the native
event thread services only bounded calls for that frame. This allows `setCancelled`, event setters,
and player inspection to complete before Bukkit continues dispatching without making off-thread API
calls.
