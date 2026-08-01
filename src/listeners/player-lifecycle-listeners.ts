import { Component, Context } from '@shamoo/decorators';
import {
  OnPlayerJoinEvent,
  OnPlayerMoveEvent,
  OnPlayerQuitEvent,
  OnPlayerRespawnEvent,
  type PaperHandle,
  type PlayerJoinEvent,
  type PlayerMoveEvent,
  type PlayerQuitEvent,
  type PlayerRespawnEvent,
} from '@shamoo/paper-raw';

import { paperLobbyHandler } from '../composition.js';

@Component()
export class PlayerLifecycleListeners {
  @OnPlayerJoinEvent()
  public join(@Context() event: PaperHandle<PlayerJoinEvent>): Promise<void> {
    return paperLobbyHandler.join(event);
  }

  @OnPlayerRespawnEvent()
  public respawn(@Context() event: PaperHandle<PlayerRespawnEvent>): Promise<void> {
    return paperLobbyHandler.respawn(event);
  }

  @OnPlayerQuitEvent()
  public quit(@Context() event: PaperHandle<PlayerQuitEvent>): Promise<void> {
    return paperLobbyHandler.quit(event);
  }

  @OnPlayerMoveEvent('MONITOR')
  public move(@Context() event: PaperHandle<PlayerMoveEvent>): Promise<void> {
    return paperLobbyHandler.move(event);
  }
}
