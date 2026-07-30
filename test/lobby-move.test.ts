import { afterEach, describe, expect, it, vi } from 'vitest';

import { hydratePaperValue, type PaperHandle } from '@shamoo/paper-raw';

import { ShaLobbyRuntime } from '../src/lobby.js';

interface RawHandle {
  readonly $paperHandle: string;
  readonly $paperObject: string;
  readonly type: string;
}

interface EventValues {
  readonly changed?: boolean;
  readonly destination?: RawHandle | null;
  readonly player: RawHandle;
  readonly source?: RawHandle;
}

type HostCallback = (...arguments_: readonly unknown[]) => unknown;

const originalHost = Object.getOwnPropertyDescriptor(globalThis, 'host');

function raw(id: string, type: string, identity = id): RawHandle {
  return { $paperHandle: id, $paperObject: identity, type };
}

function movementHarness(tasksAvailable = true): {
  readonly inspected: string[];
  readonly released: string[];
  readonly scheduled: string[];
  event(id: string, destination: string, changed?: boolean): PaperHandle;
  fire(index: number): Promise<void>;
  quitEvent(id: string): PaperHandle;
} {
  const callbacks = new Map<string, HostCallback>();
  const events = new Map<string, EventValues>();
  const inspected: string[] = [];
  const released: string[] = [];
  const scheduled: string[] = [];
  let schedulerSequence = 0;
  let taskSequence = 0;

  const paperJava = vi.fn((incoming: unknown): unknown => {
    const request = incoming as Readonly<Record<string, unknown>>;
    const operation = String(request['operation']);
    if (operation === 'release') {
      released.push(String(request['handle']));
      return true;
    }
    if (operation === 'describe') return { platformEnabled: true };
    if (operation !== 'invoke') throw new Error(`Unexpected Paper operation: ${operation}`);
    const target = request['target'] as RawHandle | undefined;
    const name = String(request['name']);
    const type = String(request['type']);
    const arguments_ = request['arguments'] as readonly unknown[];
    if (target !== undefined && events.has(target.$paperHandle)) {
      const values = events.get(target.$paperHandle);
      if (values === undefined) throw new Error('Missing event values.');
      if (name === 'hasChangedPosition') return values.changed ?? true;
      if (name === 'getPlayer') return values.player;
      if (name === 'getFrom') return values.source;
      if (name === 'getTo') return values.destination ?? null;
    }
    if (type === 'org.bukkit.entity.Entity' && name === 'getUniqueId') return 'player-id';
    if (target?.type === 'org.bukkit.entity.Player' && name === 'getEntityId') return 17;
    if (type === 'org.bukkit.Bukkit' && name === 'getGlobalRegionScheduler') {
      schedulerSequence += 1;
      return raw(
        `scheduler-${String(schedulerSequence)}`,
        'io.papermc.paper.threadedregions.scheduler.GlobalRegionScheduler',
      );
    }
    if (target?.type.endsWith('GlobalRegionScheduler') === true && name === 'run') {
      const callback = arguments_[1] as Readonly<Record<string, unknown>>;
      scheduled.push(String(callback['$callback']));
      if (!tasksAvailable) throw new Error('Scheduler unavailable.');
      taskSequence += 1;
      return raw(
        `task-${String(taskSequence)}`,
        'io.papermc.paper.threadedregions.scheduler.ScheduledTask',
      );
    }
    if (target?.type === 'org.bukkit.Location' && name === 'getWorld') {
      inspected.push(target.$paperHandle);
      return null;
    }
    throw new Error(`Unexpected Paper invocation: ${type}#${name}`);
  });
  Reflect.set(globalThis, 'host', {
    paperJava,
    registerCallback: (name: string, callback: HostCallback): boolean => {
      callbacks.set(name, callback);
      return true;
    },
    unregisterCallback: (name: string): boolean => callbacks.delete(name),
  });

  const event = (id: string, destination: string, changed = true): PaperHandle => {
    const marker = raw(`event-${id}`, 'org.bukkit.event.player.PlayerMoveEvent');
    events.set(marker.$paperHandle, {
      changed,
      destination: raw(`location-${destination}`, 'org.bukkit.Location'),
      player: raw(`player-${id}`, 'org.bukkit.entity.Player', 'player-object'),
      source: raw(`source-${id}`, 'org.bukkit.Location'),
    });
    return hydratePaperValue(marker) as PaperHandle;
  };
  return {
    inspected,
    released,
    scheduled,
    event,
    async fire(index: number): Promise<void> {
      const name = scheduled[index];
      const callback = name === undefined ? undefined : callbacks.get(name);
      if (callback === undefined) throw new Error(`Missing scheduled callback ${String(index)}.`);
      await callback({ $paperCallback: true, arguments: [] });
    },
    quitEvent(id: string): PaperHandle {
      const marker = raw(`quit-${id}`, 'org.bukkit.event.player.PlayerQuitEvent');
      events.set(marker.$paperHandle, {
        player: raw(`quit-player-${id}`, 'org.bukkit.entity.Player', 'player-object'),
      });
      return hydratePaperValue(marker) as PaperHandle;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'host');
  if (originalHost !== undefined) Object.defineProperty(globalThis, 'host', originalHost);
});

describe('player movement scheduling', () => {
  it('coalesces pending movement and processes only the latest destination', async () => {
    const harness = movementHarness();
    const runtime = new ShaLobbyRuntime();

    await runtime.move(harness.event('first', 'first'));
    await runtime.move(harness.event('second', 'second'));

    expect(harness.scheduled).toHaveLength(1);
    expect(harness.inspected).toEqual([]);
    expect(harness.released).toContain('location-first');
    expect(harness.released).toContain('player-second');

    await harness.fire(0);
    await expect.poll(() => harness.inspected).toEqual(['location-second']);
    await expect
      .poll(() => harness.released)
      .toEqual(expect.arrayContaining(['location-second', 'source-second', 'player-first']));
    expect(harness.released.filter((id) => id === 'source-first')).toHaveLength(1);
    expect(harness.released.filter((id) => id === 'source-second')).toHaveLength(1);

    await runtime.move(harness.event('third', 'third'));
    expect(harness.scheduled).toHaveLength(2);
  });

  it('drops rotation-only movement before retaining event handles', async () => {
    const harness = movementHarness();
    const runtime = new ShaLobbyRuntime();

    await runtime.move(harness.event('rotation', 'rotation', false));

    expect(harness.scheduled).toEqual([]);
    expect(harness.released).toEqual([]);
  });

  it('cleans the mailbox when movement scheduling cannot start', async () => {
    const harness = movementHarness(false);
    const runtime = new ShaLobbyRuntime();

    await expect(runtime.move(harness.event('first', 'first'))).rejects.toThrow(
      'Scheduler unavailable.',
    );
    await expect(runtime.move(harness.event('second', 'second'))).rejects.toThrow(
      'Scheduler unavailable.',
    );

    expect(harness.scheduled).toHaveLength(2);
    expect(harness.inspected).toEqual([]);
    expect(harness.released).toEqual(
      expect.arrayContaining([
        'location-first',
        'location-second',
        'player-first',
        'player-second',
        'source-first',
        'source-second',
        'scheduler-1',
        'scheduler-2',
      ]),
    );
  });

  it('discards queued movement when the player quits', async () => {
    const harness = movementHarness();
    const runtime = new ShaLobbyRuntime();

    await runtime.move(harness.event('move', 'queued'));
    await runtime.quit(harness.quitEvent('quit'));

    expect(harness.released).toEqual(
      expect.arrayContaining(['location-queued', 'source-move', 'player-move', 'task-1']),
    );
    await harness.fire(0);
    expect(harness.inspected).toEqual([]);
  });
});
