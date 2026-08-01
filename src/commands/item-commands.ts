import { Argument, Context, Subcommand, type Player } from '@shamoo/commands';
import { Component } from '@shamoo/decorators';
import type { PaperCommandContext } from '@shamoo/paper';

import { displayName, execute, requirePlayerUuid, runCommand } from './command-support.js';

@Component()
export class LobbyItemCommands {
  @Subcommand('lobby', 'items give [player]', {
    description: 'Restaurar la barra rápida administrada configurada.',
    permission: 'lobby.command.items',
    sender: 'any',
  })
  public async giveItems(
    @Context() context: PaperCommandContext,
    @Argument('player') player?: Player,
  ): Promise<void> {
    await runCommand(context, 'lobby items give', () =>
      execute(
        { action: 'items', player: requirePlayerUuid(context, player) },
        { key: 'items-given', values: { player: displayName(context, player) } },
      ),
    );
  }

  @Subcommand('lobby', 'items reset [player]', {
    description: 'Restaurar la barra rápida administrada configurada.',
    permission: 'lobby.command.items',
    sender: 'any',
  })
  public async resetItems(
    @Context() context: PaperCommandContext,
    @Argument('player') player?: Player,
  ): Promise<void> {
    await runCommand(context, 'lobby items reset', () =>
      execute(
        { action: 'items', player: requirePlayerUuid(context, player) },
        { key: 'items-reset', values: { player: displayName(context, player) } },
      ),
    );
  }
}
