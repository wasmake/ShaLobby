import { Component, Context } from '@shamoo/decorators';
import {
  OnInventoryClickEvent,
  OnInventoryDragEvent,
  OnPlayerInteractEvent,
  type InventoryClickEvent,
  type InventoryDragEvent,
  type PaperHandle,
  type PlayerInteractEvent,
} from '@shamoo/paper-raw';

import { paperLobbyHandler } from '../composition.js';

@Component()
export class InteractionListeners {
  @OnPlayerInteractEvent('HIGHEST')
  public interact(@Context() event: PaperHandle<PlayerInteractEvent>): Promise<void> {
    return paperLobbyHandler.interact(event);
  }

  @OnInventoryClickEvent('HIGHEST')
  public inventoryClick(@Context() event: PaperHandle<InventoryClickEvent>): Promise<void> {
    return paperLobbyHandler.inventoryClick(event);
  }

  @OnInventoryDragEvent('HIGHEST')
  public inventoryDrag(@Context() event: PaperHandle<InventoryDragEvent>): Promise<void> {
    return paperLobbyHandler.inventoryDrag(event);
  }
}
