import { describe, expect, it } from 'vitest';

import { VisibilityManager } from '../../src/managers/visibility-manager.js';

describe('VisibilityManager', () => {
  it('owns visibility mode transitions and relationships', () => {
    const manager = new VisibilityManager(() => 'all');

    expect(manager.activate('player')).toBe('all');
    expect(manager.set('player', 'cycle')).toBe('staff');
    expect(manager.canSee('player', false)).toBe(false);
    expect(manager.canSee('player', true)).toBe(true);
    expect(manager.set('player', 'cycle')).toBe('none');
    expect(manager.set('player', 'cycle')).toBe('all');
  });

  it('captures and restores state for transactional reload rollback', () => {
    const manager = new VisibilityManager(() => 'none');
    manager.set('first', 'all');
    const snapshot = manager.snapshot();
    manager.set('first', 'staff');
    manager.set('second', 'all');

    manager.restore(snapshot);

    expect(manager.mode('first')).toBe('all');
    expect(manager.has('second')).toBe(false);
  });
});
