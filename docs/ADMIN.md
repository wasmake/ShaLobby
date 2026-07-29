# Administration

1. Build and install the coordinated ShamooRuntime Paper JAR.
2. Build ShaLobby with `pnpm build`.
3. Install the contents of `dist/` as the `shalobby` Shamoo plugin artifact.
4. Start Paper once to seed persistent YAML.
5. Edit `plugins/ShamooRuntime/plugin-data/shalobby/data/*.yml`.
6. Run `/lobby reload`.

No `managed-lobby` Runtime section is required.

Primary permissions:

- `lobby.command.spawn`
- `lobby.command.spawn.others`
- `lobby.command.setspawn`
- `lobby.command.reload`
- `lobby.command.items`
- `lobby.command.menu`
- `lobby.command.portal`
- `lobby.command.debug`
- `lobby.protection.bypass`
- `lobby.visibility.staff`

Stop the server before replacing the Runtime JAR. ShaLobby artifact reload and YAML reload are separate
operations.
