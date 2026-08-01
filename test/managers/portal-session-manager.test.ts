import { describe, expect, it } from 'vitest';

import type { LobbyPortal } from '../../src/configuration/portals.js';
import { PortalSessionManager } from '../../src/managers/portal-session-manager.js';

const portal: LobbyPortal = {
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

describe('PortalSessionManager', () => {
  it('owns player selections', () => {
    const manager = new PortalSessionManager();
    expect(manager.selection('player')).toEqual({ ok: false, reason: 'incomplete' });
    manager.setPosition('player', { world: 'world', x: 5, y: 5, z: 5 }, 1);
    manager.setPosition('player', { world: 'world', x: 1, y: 1, z: 1 }, 2);
    expect(manager.selection('player')).toMatchObject({
      ok: true,
      min: { x: 1, y: 1, z: 1 },
      max: { x: 5, y: 5, z: 5 },
    });
  });

  it('owns occupancy, cooldown, and visualization state', () => {
    const manager = new PortalSessionManager();
    expect(manager.canEnter('player', portal, 100)).toBe(true);
    manager.occupy('player', portal.id);
    expect(manager.canEnter('player', portal, 100)).toBe(false);
    manager.leave('player');
    manager.startCooldown('player', portal, 100);
    expect(manager.canEnter('player', portal, 109)).toBe(false);
    expect(manager.canEnter('player', portal, 110)).toBe(true);
    manager.startCooldown('player', portal, 200);
    manager.clearPlayer('player');
    expect(manager.canEnter('player', portal, 200)).toBe(true);
    manager.setVisualization('player', true);
    expect(manager.shouldVisualize('player', portal)).toBe(true);
  });
});
