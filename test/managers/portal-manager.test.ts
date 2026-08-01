import { describe, expect, it, vi } from 'vitest';

import type { PortalDestinationProvider, PortalProvider } from '../../src/api/portal-provider.js';
import type { LobbyPortal } from '../../src/configuration/portals.js';
import { PortalManager } from '../../src/managers/portal-manager.js';
import { PortalSessionManager } from '../../src/managers/portal-session-manager.js';

function harness(initial: readonly LobbyPortal[] = []): {
  manager: PortalManager;
  sessions: PortalSessionManager;
  replace: ReturnType<typeof vi.fn>;
} {
  let portals = [...initial];
  const replace = vi.fn((next: readonly LobbyPortal[]) => {
    portals = [...next];
    return Promise.resolve();
  });
  const provider: PortalProvider = {
    all: () => portals,
    replace,
  };
  const destinations: PortalDestinationProvider = {
    hasEnabledServer: (id) => id === 'survival',
    hasMenu: (id) => id === 'selector',
  };
  const sessions = new PortalSessionManager();
  return {
    manager: new PortalManager(provider, destinations, sessions, () => 2_000),
    sessions,
    replace,
  };
}

describe('PortalManager', () => {
  it('creates and persists a portal from player selection', async () => {
    const { manager, sessions, replace } = harness();
    sessions.setPosition('player', { world: 'world', x: 5, y: 10, z: 15 }, 1);
    sessions.setPosition('player', { world: 'world', x: 1, y: 2, z: 3 }, 2);

    const portal = await manager.create('player', { id: 'games', destination: 'survival' });

    expect(portal).toMatchObject({
      id: 'games',
      min: { x: 1, y: 2, z: 3 },
      max: { x: 5, y: 10, z: 15 },
      'cooldown-ms': 2_000,
      action: { type: 'connect', target: 'survival' },
    });
    expect(replace).toHaveBeenCalledOnce();
    expect(manager.get('games')).toBe(portal);
  });

  it('validates destinations and replaces portal state atomically', async () => {
    const existing: LobbyPortal = {
      id: 'games',
      enabled: true,
      world: 'world',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 1, z: 1 },
      priority: 0,
      'cooldown-ms': 10,
      action: { type: 'none' },
      visualize: false,
    };
    const { manager } = harness([existing]);

    await expect(
      manager.setDestination('games', { type: 'server', target: 'missing' }),
    ).rejects.toThrow('no está disponible');
    await expect(
      manager.setDestination('games', { type: 'menu', target: 'selector' }),
    ).resolves.toMatchObject({ action: { type: 'menu', target: 'selector' } });
    expect(manager.get('games')).not.toBe(existing);
  });

  it('uses portal identity rather than repository object references', async () => {
    let stored: LobbyPortal[] = [
      {
        id: 'games',
        enabled: true,
        world: 'world',
        min: { x: 0, y: 0, z: 0 },
        max: { x: 1, y: 1, z: 1 },
        priority: 0,
        'cooldown-ms': 0,
        action: { type: 'none' },
        visualize: false,
      },
    ];
    const provider: PortalProvider = {
      all: () => stored.map((portal) => ({ ...portal })),
      replace: (portals) => {
        stored = [...portals];
        return Promise.resolve();
      },
    };
    const manager = new PortalManager(
      provider,
      { hasEnabledServer: () => false, hasMenu: () => false },
      new PortalSessionManager(),
      () => 0,
    );

    await manager.setEnabled('games', false);
    expect(stored[0]?.enabled).toBe(false);
    await manager.remove('games');
    expect(stored).toEqual([]);
  });
});
