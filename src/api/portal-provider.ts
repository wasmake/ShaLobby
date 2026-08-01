import type { LobbyPortal } from '../configuration/portals.js';

export interface PortalProvider {
  all(): readonly LobbyPortal[];
  replace(portals: readonly LobbyPortal[]): Promise<void>;
}

export interface PortalDestinationProvider {
  hasEnabledServer(id: string): boolean;
  hasMenu(id: string): boolean;
}
