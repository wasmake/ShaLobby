# Runtime

ShaLobby requires the executable generated Paper API introduced with its coordinated ShamooRuntime
and ShamooTS branches. Public `0.1.0-rc.1` artifacts do not contain this capability.

Runtime startup reports the linked public member and event counts. For the pinned model, the catalog
contains 2,213 public types, 30,307 public members, and 422 events, including Adventure MiniMessage.

Relevant Runtime settings:

```yaml
paper-api:
  synchronous-timeout-millis: 100
  maximum-pending-frame-calls: 256
  maximum-handles: 65536
```

These settings are framework-wide. They do not identify or grant special behavior to ShaLobby.

Plugin data is seeded from the artifact into:

```text
plugins/ShamooRuntime/plugin-data/<plugin-id>/
```

Runtime intersects each file request with the plugin manifest's read/write path policy and rejects
absolute paths, traversal, backslashes, and symbolic-link ancestors.
