import { describe, expect, it, vi } from 'vitest';

import type {
  ActiveLobbyConfiguration,
  LobbyConfigurationSource,
} from '../../src/api/configuration-provider.js';
import type { LobbyConfiguration } from '../../src/configuration/lobby-configuration.js';
import type { LobbyPortal } from '../../src/configuration/portals.js';
import { ConfigurationPortalProvider } from '../../src/providers/configuration-portal-provider.js';

const portal: LobbyPortal = {
  id: 'main',
  enabled: true,
  world: 'world',
  min: { x: 0, y: 0, z: 0 },
  max: { x: 1, y: 1, z: 1 },
  priority: 0,
  'cooldown-ms': 0,
  action: { type: 'none' },
  visualize: false,
};

function activeConfiguration(): LobbyConfiguration {
  return { portals: [portal], servers: [], menus: [] } as unknown as LobbyConfiguration;
}

describe('ConfigurationPortalProvider', () => {
  it('updates active state only after persistence succeeds', async () => {
    const active = activeConfiguration();
    const configuration: ActiveLobbyConfiguration = {
      current: () => active,
      require: () => active,
      replace: () => undefined,
    };
    const writePortals = vi.fn(() => Promise.resolve());
    const source = {
      writePortals,
    } as unknown as LobbyConfigurationSource;
    const provider = new ConfigurationPortalProvider(configuration, source);

    await provider.replace([]);

    expect(writePortals).toHaveBeenCalledWith([]);
    expect(active.portals).toEqual([]);
  });

  it('preserves active state when persistence fails', async () => {
    const active = activeConfiguration();
    const configuration: ActiveLobbyConfiguration = {
      current: () => active,
      require: () => active,
      replace: () => undefined,
    };
    const source = {
      writePortals: () => Promise.reject(new Error('write failed')),
    } as unknown as LobbyConfigurationSource;
    const provider = new ConfigurationPortalProvider(configuration, source);

    await expect(provider.replace([])).rejects.toThrow('write failed');
    expect(active.portals).toEqual([portal]);
  });
});
