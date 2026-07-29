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
