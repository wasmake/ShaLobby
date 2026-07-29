# Plan

Completed:

- Replace the owner-specific Runtime lobby bridge with generated public Paper bindings.
- Move listeners, items, menus, scoreboards, portals, visibility, and transfers into ShaLobby.
- Move YAML ownership into ShaLobby using generic persistent plugin files.
- Remove managed-lobby Runtime classes, configuration, tests, and ShamooTS API.

Remaining release work:

- Publish coordinated ShamooRuntime and ShamooTS versions.
- Replace local package links with published versions.
- Run authenticated Paper process tests for player-dependent behavior.
