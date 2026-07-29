# Development

The repository currently links `@shamoo/config`, `@shamoo/paper-raw`, and `@shamoo/cli` to the local
ShamooTS workspace because the executable bridge has not been published.
The `prebuild` lifecycle compiles the linked CLI, configuration, raw Paper bridge, and their workspace
dependencies before ShaLobby compilation. This also makes `npm run build` safe after pulling new
ShamooTS source without manually rebuilding its `dist` directories. Repeated builds reuse those
outputs until the linked workspace commit or local source state changes.

Run:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

Use `$invoke`, `$get`, `$set`, and `$new` through `src/api.ts`. Supply a JVM descriptor whenever Java
overload resolution would be ambiguous, especially for nullable values and UUID/string overloads.

Event parameters must use `@Context()` and `PaperHandle<EventType>`. Await all Paper calls. A call made
inside a live event or Java functional callback automatically carries its origin frame.
