import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MANAGED_LOBBY_FILES,
  ManagedLobbyClient,
  ManagedLobbyProtocolError,
  ManagedLobbyResponseError,
  ManagedLobbyUnavailableError,
  paperManagedLobby,
  type ManagedLobbyDataRecord,
  type ManagedLobbyRequest,
} from '../src/managed-lobby.js';

const PLAYER = '123e4567-e89b-12d3-a456-426614174000';
const originalHost = Object.getOwnPropertyDescriptor(globalThis, 'host');

function installHost(operation: (...values: readonly unknown[]) => unknown): object {
  const host = { paperManagedLobby: operation };
  Reflect.set(globalThis, 'host', host);
  return host;
}

function portalData(overrides: ManagedLobbyDataRecord = {}): ManagedLobbyDataRecord {
  return {
    id: 'main',
    enabled: true,
    world: 'world',
    min: { x: 0, y: 64, z: 0 },
    max: { x: 1, y: 65, z: 1 },
    priority: 0,
    'cooldown-ms': 1_000,
    action: { type: 'none' },
    visualize: false,
    ...overrides,
  };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'host');
  if (originalHost !== undefined) Object.defineProperty(globalThis, 'host', originalHost);
  vi.restoreAllMocks();
});

describe('internal managed-lobby adapter', () => {
  it('sends one validated frozen copy and copies and freezes the Runtime result', async () => {
    const request: ManagedLobbyRequest = {
      operation: 'execute',
      action: 'portal-remove',
      player: PLAYER,
      id: 'portal-survival',
    };
    const hostResult = {
      ok: true,
      state: 'portal-removed',
      portal: { id: 'portal-survival', bounds: [0, 1, 2] },
    };
    const calls: { readonly receiver: unknown; readonly values: readonly unknown[] }[] = [];
    const host = installHost(function (this: unknown, ...values: readonly unknown[]) {
      calls.push({ receiver: this, values });
      const received = values[0];
      expect(received).not.toBe(request);
      expect(Object.isFrozen(received)).toBe(true);
      return Promise.resolve(hostResult);
    });

    const result = await paperManagedLobby(request);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.receiver).toBe(host);
    expect(calls[0]?.values).toEqual([request]);
    expect(result).toEqual(hostResult);
    expect(result).not.toBe(hostResult);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result['portal'])).toBe(true);
    expect(
      Object.isFrozen((result['portal'] as { readonly bounds: readonly number[] }).bounds),
    ).toBe(true);
  });

  it('accepts exact server, spawn, and menu portal destination requests', async () => {
    const operation = vi.fn((request: unknown) => {
      expect(request).toBeDefined();
      return Promise.resolve({ ok: true, state: 'portal-destination' });
    });
    installHost(operation);
    const requests: ManagedLobbyRequest[] = [
      {
        operation: 'execute',
        action: 'portal-destination',
        player: PLAYER,
        id: 'portal-survival',
        type: 'server',
        target: 'survival',
      },
      {
        operation: 'execute',
        action: 'portal-destination',
        player: PLAYER,
        id: 'portal-survival',
        type: 'spawn',
      },
      {
        operation: 'execute',
        action: 'portal-destination',
        player: PLAYER,
        id: 'portal-survival',
        type: 'menu',
        target: 'game-selector',
      },
    ];

    await Promise.all(requests.map((request) => paperManagedLobby(request)));

    expect(operation.mock.calls.map(([request]) => request)).toEqual(requests);
  });

  it('requires the exact player-scoped portal destination protocol before host effects', () => {
    const operation = vi.fn(() => Promise.resolve({ ok: true, state: 'unexpected' }));
    installHost(operation);

    expect(() =>
      paperManagedLobby({
        operation: 'execute',
        action: 'portal-enable',
        id: 'portal-survival',
      } as never),
    ).toThrow('canonical UUID');
    expect(() =>
      paperManagedLobby({
        operation: 'execute',
        action: 'portal-destination',
        player: PLAYER,
        id: 'portal-survival',
        type: 'server',
        target: null,
      } as never),
    ).toThrow('bounded nonblank text');
    expect(() =>
      paperManagedLobby({
        operation: 'execute',
        action: 'portal-destination',
        player: PLAYER,
        id: 'portal-survival',
        type: 'spawn',
        target: 'survival',
      } as never),
    ).toThrow('not accepted for spawn');
    expect(() =>
      paperManagedLobby({
        operation: 'execute',
        action: 'portal-destination',
        player: PLAYER,
        id: 'portal-survival',
        type: 'spawn',
        target: null,
      } as never),
    ).toThrow('not accepted for spawn');
    expect(() =>
      paperManagedLobby({
        operation: 'execute',
        action: 'portal-destination',
        player: PLAYER,
        id: 'portal-survival',
        type: 'world',
        target: 'survival',
      } as never),
    ).toThrow('must be server, spawn, or menu');
    expect(() =>
      paperManagedLobby({
        operation: 'execute',
        action: 'portal-destination',
        player: PLAYER,
        id: 'portal-survival',
        type: 'menu',
        target: 'game-selector',
        destination: 'survival',
      } as never),
    ).toThrow('unknown key: destination');
    expect(operation).not.toHaveBeenCalled();
  });

  it('rejects present null portal-create optionals before host effects', () => {
    const operation = vi.fn(() => Promise.resolve({ ok: true, state: 'unexpected' }));
    installHost(operation);

    for (const key of [
      'destination',
      'permission',
      'priority',
      'cooldown-ms',
      'enabled',
      'visualize',
    ]) {
      expect(() =>
        paperManagedLobby({
          operation: 'execute',
          action: 'portal-create',
          player: PLAYER,
          id: 'main',
          [key]: null,
        } as never),
      ).toThrow(ManagedLobbyProtocolError);
    }
    expect(operation).not.toHaveBeenCalled();
  });

  it('rejects malformed operation-specific success responses', async () => {
    const portal = portalData();
    const malformed = [
      () =>
        new ManagedLobbyClient(() =>
          Promise.resolve({
            ok: true,
            state: 'reloaded',
            files: MANAGED_LOBBY_FILES,
            spawnConfigured: false,
            items: 5,
            menus: 4,
            servers: 6,
            portals: 3,
          }),
        ).reload(),
      () =>
        new ManagedLobbyClient(() =>
          Promise.resolve({
            ok: true,
            state: 'ready',
            generation: PLAYER,
            active: true,
            invocationAdmissionOpen: true,
            pendingActions: 0,
            maximumPendingActions: 64,
            directory: '/srv/shalobby',
            files: MANAGED_LOBBY_FILES,
            spawnConfigured: true,
            items: 5,
            menus: 4,
            servers: 6,
          }),
        ).status(),
      () =>
        new ManagedLobbyClient(() =>
          Promise.resolve({
            ok: true,
            state: 'portal-list',
            portals: [portal],
            count: 0,
            message: 'Uno',
          }),
        ).execute({ action: 'portal-list' }),
      () =>
        new ManagedLobbyClient(() =>
          Promise.resolve({
            ok: true,
            state: 'portal-info',
            portal: { ...portal, id: 'other' },
            message: 'Otro',
          }),
        ).execute({ action: 'portal-info', id: 'main' }),
      () =>
        new ManagedLobbyClient(() =>
          Promise.resolve({
            ok: true,
            state: 'portal-pos1',
            position: { world: 'world', x: '?', y: 64, z: 0 },
            message: 'Posición',
          }),
        ).execute({ action: 'portal-pos1', player: PLAYER }),
      () =>
        new ManagedLobbyClient(() =>
          Promise.resolve({ ok: true, state: 'spawn-requested', player: 'wrong' }),
        ).execute({ action: 'spawn', player: PLAYER }),
    ];

    for (const operation of malformed) {
      await expect(operation()).rejects.toBeInstanceOf(ManagedLobbyResponseError);
    }
  });

  it('correlates every explicitly supplied portal-create field', async () => {
    const action = {
      action: 'portal-create',
      player: PLAYER,
      id: 'main',
      destination: 'survival',
      permission: 'lobby.portal.survival',
      priority: 10,
      'cooldown-ms': 2_500,
      enabled: false,
      visualize: true,
    } as const;
    const exactPortal = portalData({
      enabled: false,
      permission: 'lobby.portal.survival',
      priority: 10,
      'cooldown-ms': 2_500,
      destination: 'survival',
      action: { type: 'connect', target: 'survival' },
      visualize: true,
    });
    const response = (portal: ManagedLobbyDataRecord) => ({
      ok: true as const,
      state: 'portal-created',
      portal,
      message: 'Portal creado.',
    });
    const exact = new ManagedLobbyClient(() => Promise.resolve(response(exactPortal)));

    await expect(exact.execute(action)).resolves.toMatchObject({ state: 'portal-created' });

    const malformed = [
      portalData({
        ...exactPortal,
        destination: 'skyblock',
        action: { type: 'connect', target: 'skyblock' },
      }),
      portalData({ ...exactPortal, permission: 'lobby.portal.other' }),
      portalData({ ...exactPortal, priority: 9 }),
      portalData({ ...exactPortal, 'cooldown-ms': 2_499 }),
      portalData({ ...exactPortal, enabled: true }),
      portalData({ ...exactPortal, visualize: false }),
    ];
    for (const portal of malformed) {
      const client = new ManagedLobbyClient(() => Promise.resolve(response(portal)));
      await expect(client.execute(action)).rejects.toBeInstanceOf(ManagedLobbyResponseError);
    }

    const omitted = new ManagedLobbyClient(() =>
      Promise.resolve(
        response(
          portalData({ destination: 'survival', action: { type: 'connect', target: 'survival' } }),
        ),
      ),
    );
    await expect(
      omitted.execute({ action: 'portal-create', player: PLAYER, id: 'main' }),
    ).rejects.toBeInstanceOf(ManagedLobbyResponseError);
  });

  it('rejects hostile graphs without invoking accessors', () => {
    const operation = vi.fn(() => Promise.resolve({ ok: true, state: 'unexpected' }));
    installHost(operation);
    const request = Object.create(null) as Record<string, unknown>;
    const getter = vi.fn(() => 'status');
    Object.defineProperty(request, 'operation', { enumerable: true, get: getter });

    expect(() => paperManagedLobby(request as never)).toThrow('accessors');
    expect(getter).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  it('fails explicitly without the host bridge and enforces Promise/result envelopes', async () => {
    expect(() => paperManagedLobby({ operation: 'ensure' })).toThrow(ManagedLobbyUnavailableError);

    installHost(() => ({ ok: true, state: 'ready' }));
    expect(() => paperManagedLobby({ operation: 'status' })).toThrow(ManagedLobbyProtocolError);

    installHost(() => Promise.resolve({ ok: true, state: 'ready', error: 'not allowed' }));
    await expect(paperManagedLobby({ operation: 'status' })).rejects.toBeInstanceOf(
      ManagedLobbyProtocolError,
    );
  });
});
