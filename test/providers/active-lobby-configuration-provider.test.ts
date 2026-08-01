import { describe, expect, it } from 'vitest';

import type { LobbyConfiguration } from '../../src/configuration/lobby-configuration.js';
import { ActiveLobbyConfigurationProvider } from '../../src/providers/active-lobby-configuration-provider.js';

describe('ActiveLobbyConfigurationProvider', () => {
  it('owns the replaceable active configuration reference', () => {
    const provider = new ActiveLobbyConfigurationProvider();
    const configuration = { settings: {} } as LobbyConfiguration;

    expect(provider.current()).toBeUndefined();
    expect(() => provider.require()).toThrow('not loaded');
    provider.replace(configuration);
    expect(provider.require()).toBe(configuration);
    provider.replace(undefined);
    expect(provider.current()).toBeUndefined();
  });
});
