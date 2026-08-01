import { Argument, Context, Subcommand, type Player } from '@shamoo/commands';
import { Component } from '@shamoo/decorators';
import type { PaperCommandContext } from '@shamoo/paper';

import { displayName, execute, inputId, requirePlayerUuid, runCommand } from './command-support.js';

@Component()
export class LobbyMenuCommands {
  @Subcommand('lobby', 'menu open <menu> [player]', {
    description: 'Abrir un menú configurado para un jugador.',
    permission: 'lobby.command.menu',
    sender: 'any',
  })
  public async openMenu(
    @Argument('menu') menu: string,
    @Context() context: PaperCommandContext,
    @Argument('player') player?: Player,
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
}
