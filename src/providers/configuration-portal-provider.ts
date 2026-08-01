import type {
  ActiveLobbyConfiguration,
  LobbyConfigurationSource,
} from '../api/configuration-provider.js';
import type { PortalDestinationProvider, PortalProvider } from '../api/portal-provider.js';
import type { LobbyPortal } from '../configuration/portals.js';

export class ConfigurationPortalProvider implements PortalProvider, PortalDestinationProvider {
  public constructor(
    private readonly configuration: ActiveLobbyConfiguration,
    private readonly configurationSource: LobbyConfigurationSource,
  ) {}

  public all(): readonly LobbyPortal[] {
    return this.configuration.require().portals;
  }

  public async replace(portals: readonly LobbyPortal[]): Promise<void> {
    await this.configurationSource.writePortals(portals);
    const active = this.configuration.require();
    active.portals.splice(0, active.portals.length, ...portals);
  }

  public hasEnabledServer(id: string): boolean {
    return this.configuration
      .require()
      .servers.some((server) => server.id === id && server.enabled);
  }

  public hasMenu(id: string): boolean {
    return this.configuration.require().menus.some((menu) => menu.id === id);
  }
}
