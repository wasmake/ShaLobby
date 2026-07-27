import { Argument, Command, Context, Option, Subcommand, type Player } from '@shamoo/commands';
import { Component } from '@shamoo/decorators';
import { miniMessage, type PaperCommandContext } from '@shamoo/paper';

import { shaLobbyApplication } from './application.js';
import { logError, logInfo } from './logging.js';
import {
  ManagedLobbyHostError,
  ManagedLobbyUnavailableError,
  type ManagedLobbyExecuteAction,
  type ManagedLobbyPortal,
  type ManagedLobbyPortalInfoSuccess,
  type ManagedLobbyPortalPositionSuccess,
  type ManagedLobbyStatusSuccess,
} from './managed-lobby.js';
import type { CommandMessageKey, MessageValues } from './messages.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const ID = /^[a-z][a-z0-9_-]{0,63}$/u;
const PERMISSION = /^[A-Za-z0-9._-]{1,128}$/u;

export const DEFAULT_MENU_IDS = Object.freeze([
  'game-selector',
  'lobby-selector',
  'profile',
  'settings',
] as const);
export const DEFAULT_SERVER_IDS = Object.freeze([
  'survival',
  'skyblock',
  'minigames',
  'lobby-1',
  'lobby-2',
  'lobby-3',
] as const);
export const DEFAULT_PORTAL_IDS = Object.freeze([
  'portal-survival',
  'portal-skyblock',
  'portal-minigames',
] as const);

interface CommandReply {
  readonly key: CommandMessageKey;
  readonly values?: MessageValues;
}

type InitializedStatus = Extract<
  ManagedLobbyStatusSuccess,
  { readonly state: 'ready' | 'standby' }
>;

class PlayerContextError extends Error {
  public constructor() {
    super('A canonical player UUID is required.');
    this.name = 'PlayerContextError';
  }
}

class CommandInputError extends Error {
  public constructor() {
    super('The command contains invalid arguments.');
    this.name = 'CommandInputError';
  }
}

export function requirePlayerUuid(context: PaperCommandContext, player?: Player): string {
  const id =
    player?.id ??
    (context.sender.kind === 'player' && typeof context.sender.id === 'string'
      ? context.sender.id
      : undefined);
  if (id === undefined || !UUID.test(id)) throw new PlayerContextError();
  return id;
}

function displayName(context: PaperCommandContext, player?: Player): string {
  return player?.name ?? context.sender.name;
}

function inputId(value: string): string {
  if (!ID.test(value)) throw new CommandInputError();
  return value;
}

function inputPermission(value: string | undefined): string | undefined {
  if (value !== undefined && !PERMISSION.test(value)) throw new CommandInputError();
  return value;
}

function inputInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < minimum || value > maximum)) {
    throw new CommandInputError();
  }
  return value;
}

async function reply(
  context: PaperCommandContext,
  key: CommandMessageKey,
  values: MessageValues = {},
): Promise<void> {
  try {
    await context.reply(miniMessage(shaLobbyApplication.messages.render(key, values)));
  } catch (error: unknown) {
    logError('command-reply-failed', error, {
      alias: context.alias,
      sender: context.sender.name,
    });
  }
}

function failureMessage(error: unknown): CommandMessageKey {
  if (error instanceof PlayerContextError) return 'player-required';
  if (error instanceof CommandInputError) return 'invalid-arguments';
  if (error instanceof ManagedLobbyUnavailableError) return 'unavailable';
  if (error instanceof ManagedLobbyHostError) {
    if (error.state === 'unavailable') return 'unavailable';
    if (error.state === 'unknown') return 'unknown';
    if (error.state === 'invalid') return 'invalid';
    if (error.state === 'overloaded') return 'overloaded';
  }
  return 'command-error';
}

async function runCommand(
  context: PaperCommandContext,
  command: string,
  operation: () => Promise<CommandReply> | CommandReply,
): Promise<void> {
  try {
    const response = await operation();
    logInfo('command-succeeded', {
      command,
      sender: context.sender.name,
    });
    await reply(context, response.key, response.values);
  } catch (error: unknown) {
    if (error instanceof CommandInputError) {
      logInfo('command-rejected', {
        command,
        reason: 'invalid-arguments',
        sender: context.sender.name,
      });
    } else {
      logError('command-failed', error, {
        command,
        sender: context.sender.name,
      });
    }
    await reply(context, failureMessage(error));
  }
}

async function execute(
  action: ManagedLobbyExecuteAction,
  response: CommandReply,
): Promise<CommandReply> {
  await shaLobbyApplication.managedLobby.execute(action);
  return response;
}

function portalDestination(portal: ManagedLobbyPortal): string {
  switch (portal.action.type) {
    case 'none':
      return 'sin destino';
    case 'spawn':
      return 'aparición';
    case 'connect':
      return `servidor ${portal.action.target}`;
    case 'menu':
      return `menú ${portal.action.target}`;
    case 'visibility':
      return `visibilidad ${portal.action.target}`;
    case 'title':
      return `título ${portal.action.target}`;
    case 'sound':
      return `sonido ${portal.action.target}`;
    case 'particle':
      return `partícula ${portal.action.target}`;
  }
}

function portalInfo(result: ManagedLobbyPortalInfoSuccess): MessageValues {
  const { portal } = result;
  return {
    portal: portal.id,
    enabled: portal.enabled,
    destination: portalDestination(portal),
  };
}

function portalPosition(result: ManagedLobbyPortalPositionSuccess): MessageValues {
  const { position } = result;
  return {
    world: position.world,
    x: position.x,
    y: position.y,
    z: position.z,
  };
}

function statusValues(result: InitializedStatus, detailed: boolean): MessageValues {
  return {
    state: result.state,
    active: result.active,
    admission: result.invocationAdmissionOpen,
    pending: result.pendingActions,
    maximum: result.maximumPendingActions,
    spawn: result.spawnConfigured,
    items: result.items,
    menus: result.menus,
    servers: result.servers,
    portals: result.portals,
    ...(detailed
      ? {
          directory: result.directory,
          generation: result.generation,
        }
      : {}),
  };
}

@Component()
export class LobbySpawnCommands {
  @Command('lobby', {
    description: 'Volver al punto de aparición del lobby.',
    permission: 'lobby.command.spawn',
    sender: 'player',
  })
  public async lobby(@Context() context: PaperCommandContext): Promise<void> {
    await this.spawnSelf(context, 'lobby');
  }

  @Command('spawn', {
    description: 'Volver al punto de aparición del lobby.',
    permission: 'lobby.command.spawn',
    sender: 'player',
  })
  public async spawn(@Context() context: PaperCommandContext): Promise<void> {
    await this.spawnSelf(context, 'spawn');
  }

  @Command('hub', {
    description: 'Volver al punto de aparición del lobby.',
    permission: 'lobby.command.spawn',
    sender: 'player',
  })
  public async hub(@Context() context: PaperCommandContext): Promise<void> {
    await this.spawnSelf(context, 'hub');
  }

  @Subcommand('lobby', 'spawn <player>', {
    description: 'Enviar un jugador al punto de aparición del lobby.',
    permission: 'lobby.command.spawn.others',
    sender: 'any',
  })
  public async spawnPlayer(
    @Argument('player', { parser: 'player', suggestions: ['players'] }) player: Player,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby spawn', () =>
      execute(
        { action: 'spawn', player: requirePlayerUuid(context, player) },
        { key: 'spawn-player-requested', values: { player: player.name } },
      ),
    );
  }

  @Subcommand('lobby', 'setspawn', {
    description: 'Guardar la posición actual como aparición del lobby.',
    permission: 'lobby.command.setspawn',
    sender: 'player',
  })
  public async setSpawn(@Context() context: PaperCommandContext): Promise<void> {
    await runCommand(context, 'lobby setspawn', () =>
      execute({ action: 'setspawn', player: requirePlayerUuid(context) }, { key: 'spawn-set' }),
    );
  }

  private async spawnSelf(context: PaperCommandContext, command: string): Promise<void> {
    await runCommand(context, command, () =>
      execute({ action: 'spawn', player: requirePlayerUuid(context) }, { key: 'spawn-requested' }),
    );
  }
}

@Component()
export class LobbyAdministrationCommands {
  @Subcommand('lobby', 'reload', {
    description: 'Validar y recargar toda la configuración del lobby.',
    permission: 'lobby.command.reload',
    sender: 'any',
  })
  public async reload(@Context() context: PaperCommandContext): Promise<void> {
    await runCommand(context, 'lobby reload', async () => {
      await shaLobbyApplication.reload();
      return { key: 'reload-complete' };
    });
  }

  @Subcommand('lobby', 'items give [player]', {
    description: 'Entregar los objetos configurados del lobby.',
    permission: 'lobby.command.items',
    sender: 'any',
  })
  public async giveItems(
    @Argument('player', { parser: 'player', suggestions: ['players'] }) player: Player | undefined,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby items give', () =>
      execute(
        { action: 'items', player: requirePlayerUuid(context, player) },
        { key: 'items-given', values: { player: displayName(context, player) } },
      ),
    );
  }

  @Subcommand('lobby', 'items reset [player]', {
    description: 'Restaurar los objetos configurados del lobby.',
    permission: 'lobby.command.items',
    sender: 'any',
  })
  public async resetItems(
    @Argument('player', { parser: 'player', suggestions: ['players'] }) player: Player | undefined,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby items reset', () =>
      execute(
        { action: 'items', player: requirePlayerUuid(context, player) },
        { key: 'items-reset', values: { player: displayName(context, player) } },
      ),
    );
  }

  @Subcommand('lobby', 'menu open <menu> [player]', {
    description: 'Abrir un menú configurado para un jugador.',
    permission: 'lobby.command.menu',
    sender: 'any',
  })
  public async openMenu(
    @Argument('menu', {
      suggestions: ['game-selector', 'lobby-selector', 'profile', 'settings'],
    })
    menu: string,
    @Argument('player', { parser: 'player', suggestions: ['players'] }) player: Player | undefined,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby menu open', () => {
      const id = inputId(menu);
      return execute(
        { action: 'menu', id, player: requirePlayerUuid(context, player) },
        {
          key: 'menu-opened',
          values: { menu: id, player: displayName(context, player) },
        },
      );
    });
  }

  @Subcommand('lobby', 'status', {
    description: 'Mostrar el estado del Runtime de lobby administrado.',
    permission: 'lobby.command.debug',
    sender: 'any',
  })
  public async status(@Context() context: PaperCommandContext): Promise<void> {
    await this.runtimeStatus(context, 'lobby status', 'status');
  }

  @Subcommand('lobby', 'debug', {
    description: 'Mostrar el diagnóstico del Runtime de lobby administrado.',
    permission: 'lobby.command.debug',
    sender: 'any',
  })
  public async debug(@Context() context: PaperCommandContext): Promise<void> {
    await this.runtimeStatus(context, 'lobby debug', 'debug');
  }

  private async runtimeStatus(
    context: PaperCommandContext,
    command: string,
    key: 'debug' | 'status',
  ): Promise<void> {
    await runCommand(context, command, async () => {
      const result = await shaLobbyApplication.managedLobby.status();
      if (result.state === 'uninitialized') return { key: 'unavailable' };
      return { key, values: statusValues(result, key === 'debug') };
    });
  }
}

@Component()
export class LobbyPortalCommands {
  @Subcommand('lobby', 'portal wand', {
    description: 'Recibir la varita; Runtime también exige lobby.protection.bypass.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async wand(@Context() context: PaperCommandContext): Promise<void> {
    await this.playerPortalAction(context, 'lobby portal wand', 'portal-wand', 'portal-wand');
  }

  @Subcommand('lobby', 'portal setpos1', {
    description: 'Guardar la primera esquina; exige lobby.protection.bypass.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async setPositionOne(@Context() context: PaperCommandContext): Promise<void> {
    await this.playerPortalAction(context, 'lobby portal setpos1', 'portal-pos1', 'portal-pos1');
  }

  @Subcommand('lobby', 'portal setpos2', {
    description: 'Guardar la segunda esquina; exige lobby.protection.bypass.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async setPositionTwo(@Context() context: PaperCommandContext): Promise<void> {
    await this.playerPortalAction(context, 'lobby portal setpos2', 'portal-pos2', 'portal-pos2');
  }

  @Subcommand('lobby', 'portal create <portal> [server]', {
    description: 'Crear un portal; Runtime también exige lobby.protection.bypass.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async create(
    @Argument('portal', {
      suggestions: ['portal-survival', 'portal-skyblock', 'portal-minigames'],
    })
    portal: string,
    @Argument('server', {
      suggestions: ['survival', 'skyblock', 'minigames', 'lobby-1', 'lobby-2', 'lobby-3'],
    })
    server: string | undefined,
    @Option('permission', {
      aliases: ['p'],
      parser: 'string',
      suggestions: ['lobby.portal.survival'],
    })
    permission: string | undefined,
    @Option('priority', { aliases: ['r'], parser: 'integer', suggestions: ['0', '10'] })
    priority: number | undefined,
    @Option('cooldown', {
      aliases: ['c'],
      parser: 'integer',
      suggestions: ['0', '1500', '3000'],
    })
    cooldown: number | undefined,
    @Option('enabled', {
      aliases: ['e'],
      parser: 'boolean',
      suggestions: ['true', 'false'],
    })
    enabled: boolean | undefined,
    @Option('visualize', {
      aliases: ['v'],
      parser: 'boolean',
      suggestions: ['true', 'false'],
    })
    visualize: boolean | undefined,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby portal create', () => {
      const id = inputId(portal);
      const destination = server === undefined ? undefined : inputId(server);
      const editorPermission = inputPermission(permission);
      const portalPriority = inputInteger(priority, -10_000, 10_000);
      const cooldownMilliseconds = inputInteger(cooldown, 0, 600_000);
      const action: ManagedLobbyExecuteAction = {
        action: 'portal-create',
        player: requirePlayerUuid(context),
        id,
        ...(destination === undefined ? {} : { destination }),
        ...(editorPermission === undefined ? {} : { permission: editorPermission }),
        ...(portalPriority === undefined ? {} : { priority: portalPriority }),
        ...(cooldownMilliseconds === undefined ? {} : { 'cooldown-ms': cooldownMilliseconds }),
        ...(enabled === undefined ? {} : { enabled }),
        ...(visualize === undefined ? {} : { visualize }),
      };
      return execute(action, { key: 'portal-created', values: { portal: id } });
    });
  }

  @Subcommand('lobby', 'portal delete <portal>', {
    description: 'Eliminar un portal; Runtime también exige lobby.protection.bypass.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async delete(
    @Argument('portal', {
      suggestions: ['portal-survival', 'portal-skyblock', 'portal-minigames'],
    })
    portal: string,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby portal delete', () => {
      const id = inputId(portal);
      return execute(
        { action: 'portal-remove', player: requirePlayerUuid(context), id },
        { key: 'portal-deleted', values: { portal: id } },
      );
    });
  }

  @Subcommand('lobby', 'portal list', {
    description: 'Listar los portales configurados.',
    permission: 'lobby.command.portal',
    sender: 'any',
  })
  public async list(@Context() context: PaperCommandContext): Promise<void> {
    await runCommand(context, 'lobby portal list', async () => {
      const result = await shaLobbyApplication.managedLobby.execute({ action: 'portal-list' });
      return { key: 'portal-list', values: { count: result.count } };
    });
  }

  @Subcommand('lobby', 'portal info <portal>', {
    description: 'Mostrar la información de un portal.',
    permission: 'lobby.command.portal',
    sender: 'any',
  })
  public async info(
    @Argument('portal', {
      suggestions: ['portal-survival', 'portal-skyblock', 'portal-minigames'],
    })
    portal: string,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby portal info', async () => {
      const id = inputId(portal);
      const result = await shaLobbyApplication.managedLobby.execute({
        action: 'portal-info',
        id,
      });
      return { key: 'portal-info', values: portalInfo(result) };
    });
  }

  @Subcommand('lobby', 'portal enable <portal>', {
    description: 'Activar un portal; Runtime también exige lobby.protection.bypass.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async enable(
    @Argument('portal', {
      suggestions: ['portal-survival', 'portal-skyblock', 'portal-minigames'],
    })
    portal: string,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await this.portalToggle(context, portal, true);
  }

  @Subcommand('lobby', 'portal disable <portal>', {
    description: 'Desactivar un portal; Runtime también exige lobby.protection.bypass.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async disable(
    @Argument('portal', {
      suggestions: ['portal-survival', 'portal-skyblock', 'portal-minigames'],
    })
    portal: string,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await this.portalToggle(context, portal, false);
  }

  @Subcommand('lobby', 'portal setdestination server <portal> <server>', {
    description: 'Asignar un destino; Runtime también exige lobby.protection.bypass.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async setServerDestination(
    @Argument('portal', {
      suggestions: ['portal-survival', 'portal-skyblock', 'portal-minigames'],
    })
    portal: string,
    @Argument('server', {
      suggestions: ['survival', 'skyblock', 'minigames', 'lobby-1', 'lobby-2', 'lobby-3'],
    })
    server: string,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby portal setdestination server', () => {
      const id = inputId(portal);
      const target = inputId(server);
      return execute(
        {
          action: 'portal-destination',
          player: requirePlayerUuid(context),
          id,
          type: 'server',
          target,
        },
        { key: 'portal-destination', values: { destination: target, portal: id } },
      );
    });
  }

  @Subcommand('lobby', 'portal setdestination spawn <portal>', {
    description: 'Asignar el punto de aparición como destino del portal.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async setSpawnDestination(
    @Argument('portal', {
      suggestions: ['portal-survival', 'portal-skyblock', 'portal-minigames'],
    })
    portal: string,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby portal setdestination spawn', () => {
      const id = inputId(portal);
      return execute(
        {
          action: 'portal-destination',
          player: requirePlayerUuid(context),
          id,
          type: 'spawn',
        },
        { key: 'portal-destination', values: { destination: 'aparición', portal: id } },
      );
    });
  }

  @Subcommand('lobby', 'portal setdestination menu <portal> <menu>', {
    description: 'Asignar un menú como destino del portal.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async setMenuDestination(
    @Argument('portal', {
      suggestions: ['portal-survival', 'portal-skyblock', 'portal-minigames'],
    })
    portal: string,
    @Argument('menu', {
      suggestions: ['game-selector', 'lobby-selector', 'profile', 'settings'],
    })
    menu: string,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby portal setdestination menu', () => {
      const id = inputId(portal);
      const target = inputId(menu);
      return execute(
        {
          action: 'portal-destination',
          player: requirePlayerUuid(context),
          id,
          type: 'menu',
          target,
        },
        { key: 'portal-destination', values: { destination: target, portal: id } },
      );
    });
  }

  @Subcommand('lobby', 'portal visualize <enabled>', {
    description: 'Visualizar portales; Runtime también exige lobby.protection.bypass.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async visualize(
    @Argument('enabled', { parser: 'boolean', suggestions: ['true', 'false'] }) enabled: boolean,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby portal visualize', () =>
      execute(
        { action: 'portal-visualize', enabled, player: requirePlayerUuid(context) },
        {
          key: enabled ? 'portal-visualization-enabled' : 'portal-visualization-disabled',
        },
      ),
    );
  }

  private async playerPortalAction(
    context: PaperCommandContext,
    command: string,
    action: 'portal-pos1' | 'portal-pos2' | 'portal-wand',
    key: 'portal-pos1' | 'portal-pos2' | 'portal-wand',
  ): Promise<void> {
    await runCommand(context, command, async () => {
      const player = requirePlayerUuid(context);
      if (action === 'portal-wand') {
        await shaLobbyApplication.managedLobby.execute({ action, player });
        return { key };
      }
      const result = await shaLobbyApplication.managedLobby.execute({ action, player });
      return { key, values: portalPosition(result) };
    });
  }

  private async portalToggle(
    context: PaperCommandContext,
    portal: string,
    enabled: boolean,
  ): Promise<void> {
    await runCommand(context, `lobby portal ${enabled ? 'enable' : 'disable'}`, () => {
      const id = inputId(portal);
      return execute(
        {
          action: enabled ? 'portal-enable' : 'portal-disable',
          player: requirePlayerUuid(context),
          id,
        },
        {
          key: enabled ? 'portal-enabled' : 'portal-disabled',
          values: { portal: id },
        },
      );
    });
  }
}
