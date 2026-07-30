import { afterEach, describe, expect, it, vi } from 'vitest';

import { constant } from '../src/api.js';

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
});
