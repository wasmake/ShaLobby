import { Argument, Context, Option, Subcommand } from '@shamoo/commands';
import { Component } from '@shamoo/decorators';
import type { PaperCommandContext } from '@shamoo/paper';

import type {
  ManagedLobbyExecuteAction,
  ManagedLobbyPortal,
  ManagedLobbyPortalInfoSuccess,
  ManagedLobbyPortalPositionSuccess,
} from '../api/managed-lobby.js';
import { shaLobbyHandler } from '../composition.js';
import type { MessageValues } from '../messages/message-catalog.js';
import {
  execute,
  inputId,
  inputInteger,
  inputPermission,
  requirePlayerUuid,
  runCommand,
} from './command-support.js';

const MAX_PORTAL_ID_LIST_LENGTH = 512;

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
    @Argument('portal') portal: string,
    @Context() context: PaperCommandContext,
    @Argument('server') server?: string,
    @Option('permission', { aliases: ['p'] }) permission?: string,
    @Option('priority', { aliases: ['r'] }) priority?: number,
    @Option('cooldown', { aliases: ['c'] }) cooldown?: number,
    @Option('enabled', { aliases: ['e'] }) enabled?: boolean,
    @Option('visualize', { aliases: ['v'] }) visualize?: boolean,
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
    @Argument('portal') portal: string,
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
      const result = await shaLobbyHandler.managedLobby.execute({ action: 'portal-list' });
      return {
        key: 'portal-list',
        values: { count: result.count, ids: portalIdList(result.portals) },
      };
    });
  }

  @Subcommand('lobby', 'portal info <portal>', {
    description: 'Mostrar la información de un portal.',
    permission: 'lobby.command.portal',
    sender: 'any',
  })
  public async info(
    @Argument('portal') portal: string,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby portal info', async () => {
      const id = inputId(portal);
      const result = await shaLobbyHandler.managedLobby.execute({ action: 'portal-info', id });
      return { key: 'portal-info', values: portalInfo(result) };
    });
  }

  @Subcommand('lobby', 'portal enable <portal>', {
    description: 'Activar un portal; Runtime también exige lobby.protection.bypass.',
    permission: 'lobby.command.portal',
    sender: 'player',
  })
  public async enable(
    @Argument('portal') portal: string,
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
    @Argument('portal') portal: string,
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
    @Argument('portal') portal: string,
    @Argument('server') server: string,
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
    @Argument('portal') portal: string,
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
    @Argument('portal') portal: string,
    @Argument('menu') menu: string,
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
    @Argument('enabled') enabled: boolean,
    @Context() context: PaperCommandContext,
  ): Promise<void> {
    await runCommand(context, 'lobby portal visualize', () =>
      execute(
        { action: 'portal-visualize', enabled, player: requirePlayerUuid(context) },
        { key: enabled ? 'portal-visualization-enabled' : 'portal-visualization-disabled' },
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
        await shaLobbyHandler.managedLobby.execute({ action, player });
        return { key };
      }
      const result = await shaLobbyHandler.managedLobby.execute({ action, player });
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
        { key: enabled ? 'portal-enabled' : 'portal-disabled', values: { portal: id } },
      );
    });
  }
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
    world: portal.world,
    minimum: `${String(portal.min.x)}, ${String(portal.min.y)}, ${String(portal.min.z)}`,
    maximum: `${String(portal.max.x)}, ${String(portal.max.y)}, ${String(portal.max.z)}`,
    permission: portal.permission ?? 'ninguna',
    priority: portal.priority,
    cooldown: portal['cooldown-ms'],
    visualization: portal.visualize,
    enabled: portal.enabled,
    destination: portalDestination(portal),
  };
}

function portalIdList(portals: readonly ManagedLobbyPortal[]): string {
  if (portals.length === 0) return 'ninguno';
  const ids = portals.map((portal) => portal.id);
  const complete = ids.join(', ');
  if (complete.length <= MAX_PORTAL_ID_LIST_LENGTH) return complete;

  const visible = [...ids];
  let result: string;
  do {
    visible.pop();
    const omitted = ids.length - visible.length;
    result = `${visible.join(', ')}, ... (+${String(omitted)} más)`;
  } while (result.length > MAX_PORTAL_ID_LIST_LENGTH && visible.length > 1);
  return result;
}

function portalPosition(result: ManagedLobbyPortalPositionSuccess): MessageValues {
  const { position } = result;
  return { world: position.world, x: position.x, y: position.y, z: position.z };
}
