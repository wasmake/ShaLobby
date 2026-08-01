import { Context, Subcommand } from '@shamoo/commands';
import { Component } from '@shamoo/decorators';
import type { PaperCommandContext } from '@shamoo/paper';

import type { ManagedLobbyStatusSuccess } from '../api/managed-lobby.js';
import { shaLobbyHandler } from '../composition.js';
import type { MessageValues } from '../messages/message-catalog.js';
import { runCommand } from './command-support.js';

@Component()
export class LobbyRuntimeCommands {
  @Subcommand('lobby', 'reload', {
    description: 'Validar y recargar toda la configuración del lobby.',
    permission: 'lobby.command.reload',
    sender: 'any',
  })
  public async reload(@Context() context: PaperCommandContext): Promise<void> {
    await runCommand(context, 'lobby reload', async () => {
      await shaLobbyHandler.reload();
      return { key: 'reload-complete' };
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
      const result = await shaLobbyHandler.managedLobby.status();
      return { key, values: statusValues(result, key === 'debug') };
    });
  }
}

function statusValues(result: ManagedLobbyStatusSuccess, detailed: boolean): MessageValues {
  const initialized = result.state !== 'uninitialized';
  return {
    state: result.state,
    active: result.active,
    admission: result.invocationAdmissionOpen,
    pending: result.pendingActions,
    maximum: result.maximumPendingActions,
    spawn: initialized ? result.spawnConfigured : 'n/a',
    items: initialized ? result.items : 'n/a',
    menus: initialized ? result.menus : 'n/a',
    servers: initialized ? result.servers : 'n/a',
    portals: initialized ? result.portals : 'n/a',
    ...(detailed
      ? {
          directory: result.directory,
          generation: result.generation,
        }
      : {}),
  };
}
