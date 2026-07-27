import { describe, expect, it } from 'vitest';

import { ShaLobbyApplication } from '../src/application.js';
import {
  MANAGED_LOBBY_FILES,
  ManagedLobbyClient,
  ManagedLobbyHostError,
  ManagedLobbyResponseError,
  type ManagedLobbyRequest,
  type ManagedLobbyResult,
  type ManagedLobbySuccess,
  type ManagedLobbyTransport,
} from '../src/managed-lobby.js';
import { MessageCatalog, MessageConfigurationError } from '../src/messages.js';

function success(
  state: string,
  details: Readonly<Record<string, unknown>> = {},
): ManagedLobbySuccess {
  return { ok: true, state, ...details };
}

function transportFor(
  handler: (request: ManagedLobbyRequest) => ManagedLobbyResult,
  calls: ManagedLobbyRequest[],
): ManagedLobbyTransport {
  return (request) => {
    calls.push(request);
    return Promise.resolve(handler(request));
  };
}

function ensured(): ManagedLobbySuccess {
  return success('ensured', {
    files: MANAGED_LOBBY_FILES,
    directory: '/srv/paper/plugins/ShamooRuntime/data/shalobby',
  });
}

function reloaded(
  messagesContent: string,
  details: Readonly<Record<string, unknown>> = {},
): ManagedLobbySuccess {
  return success('reloaded', {
    files: MANAGED_LOBBY_FILES,
    messagesContent,
    spawnConfigured: false,
    items: 5,
    menus: 4,
    servers: 6,
    portals: 3,
    ...details,
  });
}

describe('ShaLobby startup and reload', () => {
  it('commits messagesContent from the exact accepted Runtime reload snapshot', async () => {
    const calls: ManagedLobbyRequest[] = [];
    const transport = transportFor((request) => {
      if (request.operation === 'ensure') return ensured();
      return reloaded(
        "messages:\n  spawn-requested: '<green>Aparición de la instantánea aceptada.</green>'\n",
        { portals: 2 },
      );
    }, calls);
    const application = new ShaLobbyApplication(new ManagedLobbyClient(transport));

    const result = await application.start();

    expect(calls).toEqual([{ operation: 'ensure' }, { operation: 'reload' }]);
    expect(result.runtime).toMatchObject({ ok: true, state: 'reloaded', portals: 2 });
    expect(application.configurationAccepted).toBe(true);
    expect(application.messages.render('spawn-requested')).toContain(
      'Aparición de la instantánea aceptada',
    );
  });

  it('preserves active messages when Runtime rejects the candidate configuration', async () => {
    const calls: ManagedLobbyRequest[] = [];
    const messages = new MessageCatalog();
    messages.replace("messages:\n  spawn-requested: '<green>Anterior</green>'\n");
    const transport = transportFor((request) => {
      if (request.operation === 'reload') {
        return { ok: false, state: 'invalid', error: 'invalid config.yml' };
      }
      return ensured();
    }, calls);
    const application = new ShaLobbyApplication(new ManagedLobbyClient(transport), messages);

    await expect(application.start()).rejects.toBeInstanceOf(ManagedLobbyHostError);
    expect(calls).toEqual([{ operation: 'ensure' }, { operation: 'reload' }]);
    expect(application.messages.render('spawn-requested')).toContain('Anterior');
    expect(application.configurationAccepted).toBe(false);
  });

  it.each([
    ['malformed', reloaded('messages: [invalid]\n'), MessageConfigurationError],
    [
      'missing',
      success('reloaded', {
        files: MANAGED_LOBBY_FILES,
        spawnConfigured: false,
        items: 5,
        menus: 4,
        servers: 6,
        portals: 3,
      }),
      ManagedLobbyResponseError,
    ],
    ['oversized', reloaded('€'.repeat(349_526)), ManagedLobbyResponseError],
  ] as const)(
    'preserves the old catalog when accepted messagesContent is %s',
    async (_kind, reloadResult, errorType) => {
      const calls: ManagedLobbyRequest[] = [];
      const messages = new MessageCatalog();
      messages.replace("messages:\n  spawn-requested: '<green>Anterior</green>'\n");
      const transport = transportFor(
        (request) => (request.operation === 'ensure' ? ensured() : reloadResult),
        calls,
      );
      const application = new ShaLobbyApplication(new ManagedLobbyClient(transport), messages);

      await expect(application.start()).rejects.toBeInstanceOf(errorType);
      expect(calls).toEqual([{ operation: 'ensure' }, { operation: 'reload' }]);
      expect(application.messages.render('spawn-requested')).toContain('Anterior');
      expect(application.configurationAccepted).toBe(false);
    },
  );

  it('serializes concurrent reload transactions', async () => {
    const calls: ManagedLobbyRequest[] = [];
    let reloads = 0;
    let releaseFirst: (() => void) | undefined;
    const firstReload = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const transport: ManagedLobbyTransport = async (request) => {
      calls.push(request);
      if (request.operation === 'reload') {
        reloads += 1;
        if (reloads === 1) await firstReload;
        return reloaded(
          `messages:\n  spawn-requested: '<green>Candidate ${String(reloads)}</green>'\n`,
        );
      }
      return ensured();
    };
    const application = new ShaLobbyApplication(new ManagedLobbyClient(transport));

    const first = application.reload();
    const second = application.reload();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls).toEqual([{ operation: 'reload' }]);

    releaseFirst?.();
    await expect(first).resolves.toMatchObject({ runtime: { state: 'reloaded' } });
    await expect(second).resolves.toMatchObject({ runtime: { state: 'reloaded' } });
    expect(calls).toEqual([{ operation: 'reload' }, { operation: 'reload' }]);
    expect(application.messages.render('spawn-requested')).toContain('Candidate 2');
  });
});

describe('Spanish message catalog', () => {
  it('loads Runtime messages and expands configured prefix and escaped values', () => {
    const messages = new MessageCatalog();
    messages.replace(`
messages:
  prefix: '<gold>[Lobby]</gold> '
  menu-opened: '%prefix%<green>Menú %menu% abierto.</green>'
titles: []
sounds: []
particles: []
`);

    expect(messages.render('menu-opened', { menu: '<admin>' })).toBe(
      '<gold>[Lobby]</gold> <green>Menú \\<admin> abierto.</green>',
    );
    expect(messages.render('command-error')).toContain('No se pudo completar');
  });
});
