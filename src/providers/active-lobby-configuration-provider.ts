import type { ActiveLobbyConfiguration } from '../api/configuration-provider.js';
import type { LobbyConfiguration } from '../configuration/lobby-configuration.js';

export class ActiveLobbyConfigurationProvider implements ActiveLobbyConfiguration {
  #configuration: LobbyConfiguration | undefined;

  public current(): LobbyConfiguration | undefined {
    return this.#configuration;
  }

  public require(): LobbyConfiguration {
    if (this.#configuration === undefined) throw new Error('ShaLobby configuration is not loaded.');
    return this.#configuration;
  }

  public replace(configuration: LobbyConfiguration | undefined): void {
    this.#configuration = configuration;
  }
}
