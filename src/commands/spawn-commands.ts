import { Argument, Command, Context, Subcommand, type Player } from '@shamoo/commands';
import { Component } from '@shamoo/decorators';
import type { PaperCommandContext } from '@shamoo/paper';

import { execute, requirePlayerUuid, runCommand } from './command-support.js';

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
    @Argument('player') player: Player,
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
