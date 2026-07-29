import {
  MANAGED_LOBBY_FILES,
  ManagedLobbyClient,
  ManagedLobbyHostError,
  type ManagedLobbyRequest,
  type ManagedLobbyResult,
} from '../src/managed-lobby.js';
import { describe, expect, it, vi } from 'vitest';

const PLAYER = '123e4567-e89b-12d3-a456-426614174000';

function client(result: (request: ManagedLobbyRequest) => ManagedLobbyResult): ManagedLobbyClient {
  return new ManagedLobbyClient((request) => Promise.resolve(result(request)));
}

describe('lobby service client', () => {
  it('validates ensure, reload, and status responses from the TypeScript service', async () => {
    const transport = vi.fn((request: ManagedLobbyRequest): Promise<ManagedLobbyResult> => {
      if (request.operation === 'ensure')
        return Promise.resolve({
          ok: true,
          state: 'ensured',
          files: MANAGED_LOBBY_FILES,
          directory: 'data',
        });
      if (request.operation === 'reload')
        return Promise.resolve({
          ok: true,
          state: 'reloaded',
          files: MANAGED_LOBBY_FILES,
          messagesContent: 'messages: {}\n',
          spawnConfigured: false,
          items: 5,
          menus: 4,
          servers: 6,
          portals: 3,
        });
      return Promise.resolve({
        ok: true,
        state: 'ready',
        generation: '123e4567-e89b-42d3-a456-426614174000',
        active: true,
        invocationAdmissionOpen: true,
        pendingActions: 0,
        maximumPendingActions: 256,
        directory: 'data',
        files: MANAGED_LOBBY_FILES,
        spawnConfigured: false,
        items: 5,
        menus: 4,
        servers: 6,
        portals: 3,
      });
    });
    const service = new ManagedLobbyClient(transport);

    await expect(service.ensure()).resolves.toMatchObject({ state: 'ensured' });
    await expect(service.reload()).resolves.toMatchObject({ state: 'reloaded', items: 5 });
    await expect(service.status()).resolves.toMatchObject({ state: 'ready', active: true });
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it('correlates player and portal action responses', async () => {
    const portal = {
      id: 'main',
      enabled: true,
      world: 'world',
      min: { x: 0, y: 64, z: 0 },
      max: { x: 1, y: 65, z: 1 },
      priority: 0,
      'cooldown-ms': 2_500,
      action: { type: 'none' },
      visualize: false,
    };
    const service = client((request) => {
      if (request.operation !== 'execute') throw new Error('unexpected operation');
      if (request.action === 'spawn')
        return { ok: true, state: 'spawn-requested', player: request.player };
      if (request.action === 'portal-info')
        return { ok: true, state: 'portal-info', portal, message: 'Portal main.' };
      throw new Error('unexpected action');
    });

    await expect(service.execute({ action: 'spawn', player: PLAYER })).resolves.toMatchObject({
      player: PLAYER,
    });
    await expect(service.execute({ action: 'portal-info', id: 'main' })).resolves.toMatchObject({
      portal: { id: 'main' },
    });
  });

  it('rejects failed and malformed service responses', async () => {
    const failed = client(() => ({ ok: false, state: 'unavailable', error: 'not ready' }));
    const malformed = client(() => ({ ok: true, state: 'spawn-requested', player: PLAYER }));

    await expect(failed.ensure()).rejects.toBeInstanceOf(ManagedLobbyHostError);
    await expect(malformed.ensure()).rejects.toThrow();
  });
});
