import { readdir, readFile } from 'node:fs/promises';

import type { CommandSender, Player } from '@shamoo/commands';
import type { PaperCommandContext, TextLike } from '@shamoo/paper';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LobbyAdministrationCommands,
  LobbyPortalCommands,
  LobbySpawnCommands,
} from '../src/commands.js';
import { MANAGED_LOBBY_FILES, type ManagedLobbyRequest } from '../src/managed-lobby.js';
import { shaLobbyRuntime } from '../src/lobby.js';

const SELF = '123e4567-e89b-12d3-a456-426614174000';
const TARGET = '123e4567-e89b-12d3-a456-426614174001';
const originalHost = Object.getOwnPropertyDescriptor(globalThis, 'host');

interface FakeCommandContext {
  readonly context: PaperCommandContext;
  readonly replies: TextLike[];
}

function commandContext(
  sender: CommandSender = { id: SELF, kind: 'player', name: 'Alex' },
): FakeCommandContext {
  const replies: TextLike[] = [];
  const context: PaperCommandContext = {
    alias: 'lobby',
    arguments: {},
    input: '',
    options: {},
    sender,
    reply(message) {
      replies.push(message);
      return Promise.resolve(true);
    },
    openInventory: () => Promise.resolve(false),
    giveItem: () => Promise.resolve(false),
    findPlayer: () => Promise.resolve(null),
    mainHand: () => Promise.resolve(null),
    takeMainHand: () => Promise.resolve(false),
  };
  return { context, replies };
}

function installHost(operation: (request: ManagedLobbyRequest) => Promise<unknown>): void {
  vi.spyOn(shaLobbyRuntime, 'request').mockImplementation(
    operation as typeof shaLobbyRuntime.request,
  );
}

function portalData(
  id: string,
  enabled = true,
  action: Readonly<Record<string, unknown>> = { type: 'none' },
  destination?: string,
): Readonly<Record<string, unknown>> {
  return {
    id,
    enabled,
    world: 'world',
    min: { x: 0, y: 64, z: 0 },
    max: { x: 1, y: 65, z: 1 },
    priority: 0,
    'cooldown-ms': 1_000,
    ...(destination === undefined ? {} : { destination }),
    action,
    visualize: false,
  };
}

function successfulResponse(request: ManagedLobbyRequest): Readonly<Record<string, unknown>> {
  if (request.operation === 'ensure') {
    return {
      ok: true,
      state: 'ensured',
      files: MANAGED_LOBBY_FILES,
      directory: '/srv/paper/plugins/ShamooRuntime/data/shalobby',
    };
  }
  if (request.operation === 'reload') {
    return {
      ok: true,
      state: 'reloaded',
      files: MANAGED_LOBBY_FILES,
      messagesContent: 'messages: {}\n',
      spawnConfigured: true,
      items: 5,
      menus: 4,
      servers: 6,
      portals: 3,
    };
  }
  if (request.operation === 'status') {
    return {
      ok: true,
      state: 'ready',
      active: true,
      invocationAdmissionOpen: true,
      pendingActions: 2,
      maximumPendingActions: 64,
      directory: '/srv/paper/plugins/ShamooRuntime/data/shalobby',
      generation: '123e4567-e89b-12d3-a456-426614174099',
      files: MANAGED_LOBBY_FILES,
      spawnConfigured: true,
      items: 3,
      menus: 2,
      servers: 4,
      portals: 1,
    };
  }

  switch (request.action) {
    case 'spawn':
      return { ok: true, state: 'spawn-requested', player: request.player };
    case 'setspawn':
      return { ok: true, state: 'spawn-set', world: 'world', x: 0.5, y: 64, z: 0.5 };
    case 'items':
      return { ok: true, state: 'items-restored', player: request.player };
    case 'menu':
      return { ok: true, state: 'menu-opened', id: request.id };
    case 'portal-wand':
      return { ok: true, state: 'portal-wand', message: 'Varita entregada.' };
    case 'portal-pos1':
    case 'portal-pos2':
      return {
        ok: true,
        state: request.action,
        position: { world: 'world', x: 10, y: 64, z: -2 },
        message: 'Posición guardada.',
      };
    case 'portal-create': {
      const destination = request.destination;
      return {
        ok: true,
        state: 'portal-created',
        portal: {
          ...portalData(
            request.id,
            request.enabled ?? true,
            destination === undefined ? { type: 'none' } : { type: 'connect', target: destination },
            destination,
          ),
          ...(request.permission === undefined ? {} : { permission: request.permission }),
          priority: request.priority ?? 0,
          'cooldown-ms': request['cooldown-ms'] ?? 2_500,
          visualize: request.visualize ?? false,
        },
        message: 'Portal creado.',
      };
    }
    case 'portal-remove':
      return {
        ok: true,
        state: 'portal-removed',
        portal: portalData(request.id),
        message: 'Portal eliminado.',
      };
    case 'portal-list': {
      const portals = [portalData('portal-one'), portalData('portal-two')];
      return { ok: true, state: 'portal-list', portals, count: portals.length, message: 'Dos.' };
    }
    case 'portal-info':
      return {
        ok: true,
        state: 'portal-info',
        portal: portalData(request.id, true, { type: 'connect', target: 'survival' }, 'survival'),
        message: 'Información.',
      };
    case 'portal-enable':
    case 'portal-disable':
      return {
        ok: true,
        state: request.action === 'portal-enable' ? 'portal-enabled' : 'portal-disabled',
        portal: portalData(request.id, request.action === 'portal-enable'),
        message: 'Portal actualizado.',
      };
    case 'portal-destination': {
      const action =
        request.type === 'server'
          ? { type: 'connect', target: request.target }
          : request.type === 'menu'
            ? { type: 'menu', target: request.target }
            : { type: 'spawn' };
      return {
        ok: true,
        state: 'portal-destination',
        portal: portalData(
          request.id,
          true,
          action,
          request.type === 'server' ? request.target : undefined,
        ),
        message: 'Destino actualizado.',
      };
    }
    case 'portal-visualize':
      return {
        ok: true,
        state: 'portal-visualization-updated',
        enabled: request.enabled,
        message: 'Visualización actualizada.',
      };
  }
}

function replyContent(reply: TextLike | undefined): string {
  if (typeof reply === 'string') return reply;
  return reply?.content ?? '';
}

function replyText(reply: TextLike | undefined): string {
  return replyContent(reply).replaceAll(/<[^>]*>/gu, '');
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'host');
  if (originalHost !== undefined) Object.defineProperty(globalThis, 'host', originalHost);
  vi.restoreAllMocks();
});

describe('managed lobby commands', () => {
  it('uses concise compiler-inferred command bindings without parser or stale suggestion metadata', async () => {
    const sourceDirectory = new URL('../src/', import.meta.url);
    const source = (
      await Promise.all(
        (await readdir(sourceDirectory, { recursive: true }))
          .filter((file) => file.endsWith('.ts'))
          .map((file) => readFile(new URL(file, sourceDirectory), 'utf8')),
      )
    ).join('\n');

    expect(source).not.toMatch(/\bparser\s*:/u);
    expect(source).not.toMatch(/\bsuggestions\s*:/u);
    expect(source.match(/\baliases\s*:/gu)).toHaveLength(5);
    expect(source).toContain("@Argument('player') player: Player");
    expect(source.match(/@Argument\('player'\) player\?: Player/gu)).toHaveLength(3);
    expect(source).toContain("@Option('priority', { aliases: ['r'] }) priority?: number");
    expect(source).toContain("@Option('enabled', { aliases: ['e'] }) enabled?: boolean");
    expect(source).toContain("@Argument('enabled') enabled: boolean");
  });

  it('models omitted portal visualization with the native false default', () => {
    const response = successfulResponse({
      operation: 'execute',
      action: 'portal-create',
      player: SELF,
      id: 'main',
    });

    expect(response['portal']).toMatchObject({ visualize: false });
  });

  it('sends exact Runtime actions for player, item, menu, and portal commands', async () => {
    const requests: ManagedLobbyRequest[] = [];
    installHost((request) => {
      requests.push(request);
      return Promise.resolve(successfulResponse(request));
    });
    const self = commandContext();
    const target: Player = { id: TARGET, name: 'Steve', online: true };
    const spawn = new LobbySpawnCommands();
    const admin = new LobbyAdministrationCommands();
    const portals = new LobbyPortalCommands();

    await spawn.lobby(self.context);
    await spawn.spawn(self.context);
    await spawn.hub(self.context);
    await spawn.spawnPlayer(target, self.context);
    await spawn.setSpawn(self.context);
    await admin.giveItems(self.context);
    await admin.resetItems(self.context, target);
    await admin.openMenu('game-selector', self.context, target);
    await portals.wand(self.context);
    await portals.setPositionOne(self.context);
    await portals.setPositionTwo(self.context);
    await portals.create(
      'main',
      self.context,
      'survival',
      'lobby.portal.survival',
      10,
      1_500,
      true,
      false,
    );
    await portals.delete('main', self.context);
    await portals.list(self.context);
    await portals.info('main', self.context);
    await portals.enable('main', self.context);
    await portals.disable('main', self.context);
    await portals.setServerDestination('main', 'survival', self.context);
    await portals.setSpawnDestination('main', self.context);
    await portals.setMenuDestination('main', 'game-selector', self.context);
    await portals.visualize(true, self.context);

    expect(requests).toEqual([
      { operation: 'execute', action: 'spawn', player: SELF },
      { operation: 'execute', action: 'spawn', player: SELF },
      { operation: 'execute', action: 'spawn', player: SELF },
      { operation: 'execute', action: 'spawn', player: TARGET },
      { operation: 'execute', action: 'setspawn', player: SELF },
      { operation: 'execute', action: 'items', player: SELF },
      { operation: 'execute', action: 'items', player: TARGET },
      { operation: 'execute', action: 'menu', id: 'game-selector', player: TARGET },
      { operation: 'execute', action: 'portal-wand', player: SELF },
      { operation: 'execute', action: 'portal-pos1', player: SELF },
      { operation: 'execute', action: 'portal-pos2', player: SELF },
      {
        operation: 'execute',
        action: 'portal-create',
        player: SELF,
        id: 'main',
        destination: 'survival',
        permission: 'lobby.portal.survival',
        priority: 10,
        'cooldown-ms': 1_500,
        enabled: true,
        visualize: false,
      },
      { operation: 'execute', action: 'portal-remove', player: SELF, id: 'main' },
      { operation: 'execute', action: 'portal-list' },
      { operation: 'execute', action: 'portal-info', id: 'main' },
      { operation: 'execute', action: 'portal-enable', player: SELF, id: 'main' },
      { operation: 'execute', action: 'portal-disable', player: SELF, id: 'main' },
      {
        operation: 'execute',
        action: 'portal-destination',
        player: SELF,
        id: 'main',
        type: 'server',
        target: 'survival',
      },
      {
        operation: 'execute',
        action: 'portal-destination',
        player: SELF,
        id: 'main',
        type: 'spawn',
      },
      {
        operation: 'execute',
        action: 'portal-destination',
        player: SELF,
        id: 'main',
        type: 'menu',
        target: 'game-selector',
      },
      { operation: 'execute', action: 'portal-visualize', player: SELF, enabled: true },
    ]);
    expect(self.replies).toHaveLength(requests.length);
    expect(replyContent(self.replies[9])).toContain('world');
    expect(replyContent(self.replies[9])).toContain('10, 64, -2');
    expect(replyText(self.replies[13])).toContain('portal-one, portal-two');
    expect(replyText(self.replies[13])).toContain('(2)');
    const info = replyText(self.replies[14]);
    expect(info).toContain('mundo=world');
    expect(info).toContain('min=0, 64, 0');
    expect(info).toContain('max=1, 65, 1');
    expect(info).toContain('permiso=ninguna');
    expect(info).toContain('prioridad=0');
    expect(info).toContain('cooldown=1000 ms');
    expect(info).toContain('visualización=false');
    expect(info).toContain('activo=true');
    expect(info).toContain('servidor survival');
  });

  it('uses exact correlated reload and status requests', async () => {
    const requests: ManagedLobbyRequest[] = [];
    installHost((request) => {
      requests.push(request);
      return Promise.resolve(successfulResponse(request));
    });
    const fake = commandContext({ kind: 'console', name: 'Console' });
    const commands = new LobbyAdministrationCommands();

    await commands.reload(fake.context);
    await commands.status(fake.context);
    await commands.debug(fake.context);

    expect(requests).toEqual([
      { operation: 'reload' },
      { operation: 'status' },
      { operation: 'status' },
    ]);
    expect(replyContent(fake.replies[1])).toContain('Estado');
    expect(replyContent(fake.replies[1])).toContain('pendientes=');
    expect(replyContent(fake.replies[1])).not.toContain('/srv/paper');
    expect(replyContent(fake.replies[2])).toContain('Diagnóstico');
    expect(replyContent(fake.replies[2])).toContain('/srv/paper');
    expect(replyContent(fake.replies[2])).toContain('123e4567-e89b-12d3-a456-426614174099');
  });

  it('shows bounded diagnostics for uninitialized Runtime state without exposing the directory in status', async () => {
    installHost((request) => {
      if (request.operation !== 'status') {
        return Promise.resolve({ ok: false, state: 'invalid', error: 'unexpected request' });
      }
      return Promise.resolve({
        ok: true,
        state: 'uninitialized',
        active: false,
        invocationAdmissionOpen: false,
        pendingActions: 1,
        maximumPendingActions: 64,
        directory: '/srv/paper/plugins/ShamooRuntime/data/shalobby',
        generation: '123e4567-e89b-12d3-a456-426614174099',
        files: MANAGED_LOBBY_FILES,
      });
    });
    const fake = commandContext({ kind: 'console', name: 'Console' });
    const commands = new LobbyAdministrationCommands();

    await commands.status(fake.context);
    await commands.debug(fake.context);

    const status = replyText(fake.replies[0]);
    const debug = replyText(fake.replies[1]);
    expect(status).toContain('uninitialized');
    expect(status).toContain('pendientes=1/64');
    expect(status.match(/n\/a/gu)).toHaveLength(5);
    expect(status).not.toContain('/srv/paper');
    expect(status).not.toContain('123e4567-e89b-12d3-a456-426614174099');
    expect(debug).toContain('uninitialized');
    expect(debug).toContain('pendientes=1/64');
    expect(debug.match(/n\/a/gu)).toHaveLength(5);
    expect(debug).toContain('/srv/paper');
    expect(debug).toContain('123e4567-e89b-12d3-a456-426614174099');
  });

  it('lists a truthful bounded prefix of portal IDs with the complete count', async () => {
    const portals = Array.from({ length: 20 }, (_, index) =>
      portalData(`portal-${String(index).padStart(2, '0')}-${'a'.repeat(48)}`),
    );
    installHost(() =>
      Promise.resolve({
        ok: true,
        state: 'portal-list',
        portals,
        count: portals.length,
        message: 'Lista.',
      }),
    );
    const fake = commandContext();

    await new LobbyPortalCommands().list(fake.context);

    const content = replyText(fake.replies[0]);
    expect(content).toContain('(20)');
    expect(content).toContain('portal-00-');
    expect(content).not.toContain('portal-19-');
    expect(content).toMatch(/\.\.\. \(\+\d+ más\)/u);
    expect(content.length).toBeLessThan(800);
  });

  it('derives bounded portal info destinations from native actions when legacy destination is null', async () => {
    const examples = [
      ['spawn-action', { type: 'spawn' }, 'aparición'],
      ['server-action', { type: 'connect', target: 'survival' }, 'servidor survival'],
      ['menu-action', { type: 'menu', target: 'game-selector' }, 'menú game-selector'],
      ['visibility-action', { type: 'visibility', target: 'staff' }, 'visibilidad staff'],
      ['title-action', { type: 'title', target: 'bienvenida' }, 'título bienvenida'],
      ['sound-action', { type: 'sound', target: 'confirmacion' }, 'sonido confirmacion'],
      ['particle-action', { type: 'particle', target: 'destello' }, 'partícula destello'],
      ['none-action', { type: 'none' }, 'sin destino'],
    ] as const;
    installHost((request) => {
      if (request.operation !== 'execute' || request.action !== 'portal-info') {
        return Promise.resolve({ ok: false, state: 'invalid', error: 'unexpected request' });
      }
      const example = examples.find(([id]) => id === request.id);
      return Promise.resolve({
        ok: true,
        state: 'portal-info',
        portal: portalData(request.id, true, example?.[1] ?? { type: 'none' }),
        message: 'Información.',
      });
    });
    const fake = commandContext();
    const portals = new LobbyPortalCommands();

    for (const [id] of examples) await portals.info(id, fake.context);

    expect(fake.replies.map(replyContent)).toHaveLength(examples.length);
    for (const [index, example] of examples.entries()) {
      expect(replyContent(fake.replies[index])).toContain(example[2]);
    }
  });

  it('reports successful server, spawn, and menu destination updates in Spanish', async () => {
    const operation = vi.fn((request: ManagedLobbyRequest) =>
      Promise.resolve(successfulResponse(request)),
    );
    installHost(operation);
    const fake = commandContext();
    const portals = new LobbyPortalCommands();

    await portals.setServerDestination('main', 'survival', fake.context);
    await portals.setSpawnDestination('main', fake.context);
    await portals.setMenuDestination('main', 'game-selector', fake.context);

    expect(operation).toHaveBeenCalledTimes(3);
    const feedback = fake.replies.map(replyContent);
    expect(feedback.every((message) => message.includes('actualizado'))).toBe(true);
    expect(feedback[0]).toContain('survival');
    expect(feedback[1]).toContain('aparición');
    expect(feedback[2]).toContain('game-selector');
  });

  it('returns Spanish generic feedback for host failures without exposing raw errors or stacks', async () => {
    installHost(() => Promise.reject(new Error('SECRET host detail')));
    const fake = commandContext();

    await new LobbySpawnCommands().lobby(fake.context);

    expect(fake.replies).toHaveLength(1);
    expect(replyContent(fake.replies[0])).toContain('No se pudo completar');
    expect(replyContent(fake.replies[0])).not.toContain('SECRET');
    const log = vi.mocked(console.error).mock.calls.flat().join(' ');
    expect(log).toContain('command-failed');
    expect(log).not.toContain('at LobbySpawnCommands');
  });

  it.each([
    ['unavailable', 'contexto actual'],
    ['unknown', 'No se encontró'],
    ['invalid', 'no son válidos'],
    ['overloaded', 'está ocupado'],
  ] as const)('maps the %s host state to safe configured feedback', async (state, feedback) => {
    installHost(() => Promise.resolve({ ok: false, state, error: `SECRET ${state} host detail` }));
    const fake = commandContext();

    await new LobbySpawnCommands().lobby(fake.context);

    expect(replyContent(fake.replies[0])).toContain(feedback);
    expect(replyContent(fake.replies[0])).not.toContain('SECRET');
  });

  it('does not infer spawn or portal editor causes from raw unavailable errors', async () => {
    installHost((request) => {
      const detail =
        request.operation === 'execute' && request.action === 'spawn'
          ? 'SECRET no managed spawn is configured'
          : request.operation === 'execute' && request.action === 'portal-create'
            ? 'SECRET portal selection requires pos1 and pos2'
            : 'SECRET player lacks the portal editor permission';
      return Promise.resolve({ ok: false, state: 'unavailable', error: detail });
    });
    const fake = commandContext();

    await new LobbySpawnCommands().lobby(fake.context);
    await new LobbyPortalCommands().create(
      'main',
      fake.context,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    await new LobbyPortalCommands().visualize(true, fake.context);

    expect(fake.replies).toHaveLength(3);
    for (const response of fake.replies.map(replyContent)) {
      expect(response).toContain('contexto actual');
      expect(response).not.toContain('SECRET');
      expect(response).not.toContain('pos1');
    }
  });

  it('rejects invalid IDs, permissions, and integer ranges before transport', async () => {
    const operation = vi.fn((request: ManagedLobbyRequest) =>
      Promise.resolve(successfulResponse(request)),
    );
    installHost(operation);
    const fake = commandContext();
    const target: Player = { id: TARGET, name: 'Steve', online: true };
    const portals = new LobbyPortalCommands();

    await new LobbyAdministrationCommands().openMenu('Not Valid', fake.context, target);
    await portals.create(
      'main',
      fake.context,
      undefined,
      'invalid permission',
      undefined,
      undefined,
      undefined,
      undefined,
    );
    await portals.create(
      'main',
      fake.context,
      undefined,
      undefined,
      1.5,
      undefined,
      undefined,
      undefined,
    );
    await portals.create(
      'main',
      fake.context,
      undefined,
      undefined,
      undefined,
      600_001,
      undefined,
      undefined,
    );
    await portals.setSpawnDestination('Not Valid', fake.context);
    await portals.setServerDestination('main', 'Not-Canonical', fake.context);

    expect(operation).not.toHaveBeenCalled();
    expect(fake.replies).toHaveLength(6);
    expect(
      fake.replies.map(replyContent).every((message) => message.includes('no son válidos')),
    ).toBe(true);
    const logs = vi.mocked(console.info).mock.calls.flat().join(' ');
    expect(logs).toContain('command-rejected');
    expect(logs).not.toContain('command-succeeded');
  });

  it('does not print fallback counts for malformed successful responses', async () => {
    installHost(() =>
      Promise.resolve({ ok: true, state: 'portal-list', portals: [], message: 'Vacío.' }),
    );
    const fake = commandContext();

    await new LobbyPortalCommands().list(fake.context);

    expect(replyContent(fake.replies[0])).toContain('No se pudo completar');
    expect(replyContent(fake.replies[0])).not.toContain('Portales configurados (0)');
    expect(vi.mocked(console.info).mock.calls.flat().join(' ')).not.toContain('command-succeeded');
  });

  it('requires a canonical player UUID when an optional target is omitted', async () => {
    const operation = vi.fn(() => Promise.resolve({ ok: true, state: 'unexpected' }));
    installHost(operation);
    const fake = commandContext({ kind: 'console', name: 'Console' });

    await new LobbyAdministrationCommands().giveItems(fake.context);

    expect(operation).not.toHaveBeenCalled();
    expect(replyContent(fake.replies[0])).toContain('necesita un jugador válido');
  });
});
