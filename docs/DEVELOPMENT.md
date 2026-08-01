# Development

The repository installs its coordinated ShamooTS dependencies from the scoped registry configured in
`.npmrc`. Development and production builds do not require a local ShamooTS workspace.

Run:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

Use `$invoke`, `$get`, `$set`, and `$new` through `src/platform/paper/api.ts`. Supply a JVM descriptor whenever Java
overload resolution would be ambiguous, especially for nullable values and UUID/string overloads.

Event parameters must use `@Context()` and `PaperHandle<EventType>`. Await all Paper calls. A call made
inside a live event or Java functional callback automatically carries its origin frame.
