import { describe, expect, it } from 'vitest';

import type { LobbyPortal } from '../../src/configuration.js';
import { normalizePortalSelection, selectPortal } from '../../src/domain/portals.js';

function portal(id: string, priority: number, enabled = true): LobbyPortal {
  return {
    id,
    enabled,
    world: 'world',
    min: { x: 0, y: 10, z: 20 },
    max: { x: 5, y: 15, z: 25 },
    priority,
    'cooldown-ms': 0,
    action: { type: 'none' },
    visualize: false,
  };
}

describe('portal domain rules', () => {
  it('normalizes selection bounds independently of selection order', () => {
    expect(
      normalizePortalSelection({
        first: { world: 'world', x: 5, y: 15, z: 25 },
        second: { world: 'world', x: 0, y: 10, z: 20 },
      }),
    ).toEqual({
      ok: true,
      world: 'world',
      min: { x: 0, y: 10, z: 20 },
      max: { x: 5, y: 15, z: 25 },
    });
  });

  it('returns typed selection failures', () => {
    expect(normalizePortalSelection({})).toEqual({ ok: false, reason: 'incomplete' });
    expect(
      normalizePortalSelection({
        first: { world: 'world', x: 0, y: 0, z: 0 },
        second: { world: 'other', x: 0, y: 0, z: 0 },
      }),
    ).toEqual({ ok: false, reason: 'world-mismatch' });
  });

  it('selects the highest-priority enabled portal with a stable ID tie-breaker', () => {
    const position = { world: 'world', x: 5, y: 15, z: 25 };

    expect(
      selectPortal(
        [
          portal('lower', 1),
          portal('z-priority', 2),
          portal('a-priority', 2),
          portal('off', 10, false),
        ],
        position,
      )?.id,
    ).toBe('a-priority');
    expect(selectPortal([portal('outside', 1)], { ...position, x: 5.1 })).toBeUndefined();
    expect(selectPortal([portal('invalid', 1)], { ...position, x: Number.NaN })).toBeUndefined();
  });
});
