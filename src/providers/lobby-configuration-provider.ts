import { pluginFiles } from '@shamoo/config';
import { stringify } from 'yaml';

import type { LobbyConfigurationSource } from '../api/configuration-provider.js';
import { LOBBY_FILES, type LobbyFile } from '../configuration/files.js';
import type { LobbyConfiguration } from '../configuration/lobby-configuration.js';
import { LobbyConfigurationDecoder } from '../configuration/lobby-configuration-decoder.js';
import type { LobbyPortal } from '../configuration/portals.js';
import type { LobbySpawn } from '../configuration/spawn.js';

export class YamlLobbyConfigurationProvider implements LobbyConfigurationSource {
  public constructor(
    private readonly decoder: LobbyConfigurationDecoder = new LobbyConfigurationDecoder(),
  ) {}

  public async load(): Promise<LobbyConfiguration> {
    const contents = Object.fromEntries(
      await Promise.all(
        LOBBY_FILES.map(async (file) => [file, await pluginFiles.read(`data/${file}`)] as const),
      ),
    ) as Record<LobbyFile, string>;
    return this.decoder.decode(contents);
  }

  public writeSpawn(spawn: LobbySpawn): Promise<void> {
    return pluginFiles.write('data/spawn.yml', stringify({ spawn }));
  }

  public writePortals(portals: readonly LobbyPortal[]): Promise<void> {
    return pluginFiles.write('data/portals.yml', stringify({ portals }));
  }
}
