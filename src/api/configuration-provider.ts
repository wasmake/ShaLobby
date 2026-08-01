import type { LobbyConfiguration } from '../configuration/lobby-configuration.js';
import type { LobbyPortal } from '../configuration/portals.js';
import type { LobbySpawn } from '../configuration/spawn.js';

export interface LobbyConfigurationSource {
  load(): Promise<LobbyConfiguration>;
  writeSpawn(spawn: LobbySpawn): Promise<void>;
  writePortals(portals: readonly LobbyPortal[]): Promise<void>;
}

export interface ActiveLobbyConfiguration {
  current(): LobbyConfiguration | undefined;
  require(): LobbyConfiguration;
  replace(configuration: LobbyConfiguration | undefined): void;
}
