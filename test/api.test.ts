import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PaperHandle } from '@shamoo/paper-raw';

import {
  cancelEvent,
  constant,
  gameRule,
  playerUniqueId,
  registerOutgoingPluginChannel,
  type Ref,
} from '../src/platform/paper/api.js';

const originalHost = Object.getOwnPropertyDescriptor(globalThis, 'host');

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'host');
  if (originalHost !== undefined) Object.defineProperty(globalThis, 'host', originalHost);
});

describe('generated Paper field access', () => {
  it.each([
    ['org.bukkit.GameMode', 'ADVENTURE'],
    ['org.bukkit.Material', 'COMPASS'],
    ['org.bukkit.Particle', 'END_ROD'],
  ] as const)('resolves %s#%s through its generated valueOf member', async (type, name) => {
    const result = { $paperEnum: type, name };
    const paperJava = vi.fn(() => result);
    Reflect.set(globalThis, 'host', {
      paperJava,
      registerCallback: vi.fn(() => true),
      unregisterCallback: vi.fn(() => true),
    });
    const descriptor = `L${type.replaceAll('.', '/')};`;

    await expect(constant(type, name)).resolves.toEqual(result);

    expect(paperJava).toHaveBeenCalledWith({
      operation: 'invoke',
      type,
      name: 'valueOf',
      descriptor: `(Ljava/lang/String;)${descriptor}`,
      arguments: [name],
    });
  });

  it.each([
    ['org.bukkit.Sound', 'ENTITY_PLAYER_LEVELUP', 'Lorg/bukkit/Sound;'],
    [
      'org.bukkit.persistence.PersistentDataType',
      'STRING',
      'Lorg/bukkit/persistence/PersistentDataType;',
    ],
  ] as const)('supplies the exact field descriptor for %s#%s', async (type, name, descriptor) => {
    const paperJava = vi.fn(() => null);
    Reflect.set(globalThis, 'host', {
      paperJava,
      registerCallback: vi.fn(() => true),
      unregisterCallback: vi.fn(() => true),
    });

    await constant(type, name);

    expect(paperJava).toHaveBeenCalledWith({ operation: 'get', type, name, descriptor });
  });

  it.each([
    ['announceAdvancements', 'ANNOUNCE_ADVANCEMENTS'],
    ['doFireTick', 'DO_FIRE_TICK'],
    ['randomTickSpeed', 'RANDOM_TICK_SPEED'],
    ['tntExplodes', 'TNT_EXPLODES'],
  ])('resolves legacy game rule %s through exact field %s', async (name, field) => {
    const paperJava = vi.fn(() => null);
    Reflect.set(globalThis, 'host', {
      paperJava,
      registerCallback: vi.fn(() => true),
      unregisterCallback: vi.fn(() => true),
    });

    await gameRule(name);

    expect(paperJava).toHaveBeenCalledWith({
      operation: 'get',
      type: 'org.bukkit.GameRule',
      name: field,
      descriptor: 'Lorg/bukkit/GameRule;',
    });
  });

  it('registers outgoing plugin channels through the exact Messenger descriptor', async () => {
    const invoke = vi.fn(() => Promise.resolve());
    const messenger = { $invoke: invoke } as unknown as PaperHandle;

    await registerOutgoingPluginChannel(messenger, 'BungeeCord');

    expect(invoke).toHaveBeenCalledWith(
      'registerOutgoingPluginChannel',
      '(Lorg/bukkit/plugin/Plugin;Ljava/lang/String;)V',
      { $paper: 'plugin' },
      'BungeeCord',
    );
  });

  it('reads player UUIDs through the exact Entity member', async () => {
    const id = '2f9fdbe9-f8f2-4651-a1ae-1dc9fc7c2bd0';
    const paperJava = vi.fn(() => id);
    Reflect.set(globalThis, 'host', {
      paperJava,
      registerCallback: vi.fn(() => true),
      unregisterCallback: vi.fn(() => true),
    });
    const current = {
      $paperHandle: 'player',
      $paperObject: 'player-identity',
      type: 'org.bukkit.entity.Player',
    } as unknown as Ref<'org.bukkit.entity.Player'>;

    await expect(playerUniqueId(current)).resolves.toBe(id);

    expect(paperJava).toHaveBeenCalledWith({
      operation: 'invoke',
      type: 'org.bukkit.entity.Entity',
      name: 'getUniqueId',
      descriptor: '()Ljava/util/UUID;',
      target: {
        $paperHandle: 'player',
        $paperObject: 'player-identity',
        type: 'org.bukkit.entity.Player',
      },
      arguments: [],
    });
  });

  it('cancels events through the exact Cancellable member', async () => {
    const paperJava = vi.fn(() => undefined);
    Reflect.set(globalThis, 'host', {
      paperJava,
      registerCallback: vi.fn(() => true),
      unregisterCallback: vi.fn(() => true),
    });
    const event = {
      $paperHandle: 'event',
      $paperObject: 'event-identity',
      type: 'org.bukkit.event.entity.EntityDamageEvent',
    } as unknown as PaperHandle;

    await cancelEvent(event);

    expect(paperJava).toHaveBeenCalledWith({
      operation: 'invoke',
      type: 'org.bukkit.event.Cancellable',
      name: 'setCancelled',
      descriptor: '(Z)V',
      target: {
        $paperHandle: 'event',
        $paperObject: 'event-identity',
        type: 'org.bukkit.event.entity.EntityDamageEvent',
      },
      arguments: [true],
    });
  });
});
