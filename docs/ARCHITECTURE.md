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

ShaLobby follows one dependency direction:

1. `application.ts` owns plugin startup, reload, and shutdown.
2. `commands.ts` and `events.ts` adapt framework input into lobby operations.
3. `lobby.ts` coordinates stateful use cases and Paper resources.
4. `domain/` contains synchronous business rules with no Paper handles or file access.
5. `configuration.ts` builds the validated snapshot consumed by the runtime.
6. `api.ts` is the low-level generated Paper bridge boundary.

Configuration values are decoded once. In particular, message templates, titles, sounds, and
particles are retained as immutable typed resources; gameplay code must not reinterpret raw YAML.
Expected domain decisions should be represented as typed results, while exceptions are reserved for
invalid configuration or infrastructure failures.

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
