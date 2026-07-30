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
    ['org.bukkit.Material', 'COMPASS', 'Lorg/bukkit/Material;'],
    [
      'org.bukkit.persistence.PersistentDataType',
      'STRING',
      'Lorg/bukkit/persistence/PersistentDataType;',
    ],
  ] as const)('supplies the exact descriptor for %s#%s', async (type, name, descriptor) => {
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
