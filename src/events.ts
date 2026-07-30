import { Component, Context } from '@shamoo/decorators';
import {
  OnBlockBreakEvent,
  OnBlockBurnEvent,
  OnBlockDispenseEvent,
  OnBlockExplodeEvent,
  OnBlockFadeEvent,
  OnBlockFormEvent,
  OnBlockFromToEvent,
  OnBlockGrowEvent,
  OnBlockIgniteEvent,
  OnBlockPistonExtendEvent,
  OnBlockPistonRetractEvent,
  OnBlockPlaceEvent,
  OnBlockSpreadEvent,
  OnCauldronLevelChangeEvent,
  OnEntityBlockFormEvent,
  OnEntityChangeBlockEvent,
  OnEntityDamageEvent,
  OnEntityExhaustionEvent,
  OnEntityExplodeEvent,
  OnEntityInteractEvent,
  OnEntityPickupItemEvent,
  OnEntityPlaceEvent,
  OnEntityPortalEvent,
  OnEntityTargetLivingEntityEvent,
  OnFluidLevelChangeEvent,
  OnFoodLevelChangeEvent,
  OnHangingBreakEvent,
  OnHangingPlaceEvent,
  OnInventoryClickEvent,
  OnInventoryDragEvent,
  OnInventoryMoveItemEvent,
  OnInventoryPickupItemEvent,
  OnLeavesDecayEvent,
  OnMoistureChangeEvent,
  OnPlayerArmorStandManipulateEvent,
  OnPlayerBucketEmptyEvent,
  OnPlayerBucketFillEvent,
  OnPlayerDropItemEvent,
  OnPlayerInteractEvent,
  OnPlayerInteractAtEntityEvent,
  OnPlayerInteractEntityEvent,
  OnPlayerItemConsumeEvent,
  OnPlayerItemDamageEvent,
  OnPlayerJoinEvent,
  OnPlayerLeashEntityEvent,
  OnPlayerMoveEvent,
  OnPlayerPortalEvent,
  OnPlayerQuitEvent,
  OnPlayerRespawnEvent,
  OnPlayerShearEntityEvent,
  OnPlayerSwapHandItemsEvent,
  OnPortalCreateEvent,
  OnProjectileLaunchEvent,
  OnSpongeAbsorbEvent,
  OnStructureGrowEvent,
  OnTNTPrimeEvent,
  OnThunderChangeEvent,
  OnVehicleDamageEvent,
  OnVehicleDestroyEvent,
  OnVehicleEnterEvent,
  OnVehicleEntityCollisionEvent,
  OnWeatherChangeEvent,
  type BlockBreakEvent,
  type BlockPlaceEvent,
  type EntityDamageEvent,
  type EntityPickupItemEvent,
  type FoodLevelChangeEvent,
  type InventoryClickEvent,
  type InventoryDragEvent,
  type PaperHandle,
  type PlayerDropItemEvent,
  type PlayerInteractEvent,
  type PlayerJoinEvent,
  type PlayerMoveEvent,
  type PlayerQuitEvent,
  type PlayerRespawnEvent,
  type ThunderChangeEvent,
  type WeatherChangeEvent,
} from '@shamoo/paper-raw';

import { call, callExact, type Ref } from './api.js';
import { shaLobbyRuntime } from './lobby.js';

@Component()
export class LobbyEvents {
  @OnPlayerJoinEvent()
  public join(@Context() event: PaperHandle<PlayerJoinEvent>): Promise<void> {
    return shaLobbyRuntime.join(event);
  }

  @OnPlayerRespawnEvent()
  public respawn(@Context() event: PaperHandle<PlayerRespawnEvent>): Promise<void> {
    return shaLobbyRuntime.respawn(event);
  }

  @OnPlayerQuitEvent()
  public quit(@Context() event: PaperHandle<PlayerQuitEvent>): Promise<void> {
    return shaLobbyRuntime.quit(event);
  }

  @OnPlayerMoveEvent('MONITOR')
  public move(@Context() event: PaperHandle<PlayerMoveEvent>): Promise<void> {
    return shaLobbyRuntime.move(event);
  }

  @OnPlayerInteractEvent('HIGHEST')
  public interact(@Context() event: PaperHandle<PlayerInteractEvent>): Promise<void> {
    return shaLobbyRuntime.interact(event);
  }

  @OnInventoryClickEvent('HIGHEST')
  public inventoryClick(@Context() event: PaperHandle<InventoryClickEvent>): Promise<void> {
    return shaLobbyRuntime.inventoryClick(event);
  }

  @OnInventoryDragEvent('HIGHEST')
  public inventoryDrag(@Context() event: PaperHandle<InventoryDragEvent>): Promise<void> {
    return shaLobbyRuntime.inventoryDrag(event);
  }

  @OnEntityDamageEvent('HIGHEST')
  public async damage(@Context() event: PaperHandle<EntityDamageEvent>): Promise<void> {
    const entity = await callExact<PaperHandle>(event, 'getEntity', '()Lorg/bukkit/entity/Entity;');
    await shaLobbyRuntime.protect(
      event,
      await call<PaperHandle>(entity, 'getWorld'),
      entity.$type === 'org.bukkit.entity.Player'
        ? (entity as Ref<'org.bukkit.entity.Player'>)
        : undefined,
    );
  }

  @OnFoodLevelChangeEvent('HIGHEST')
  public async food(@Context() event: PaperHandle<FoodLevelChangeEvent>): Promise<void> {
    const entity = await callExact<PaperHandle>(event, 'getEntity', '()Lorg/bukkit/entity/Entity;');
    await shaLobbyRuntime.protect(
      event,
      await call<PaperHandle>(entity, 'getWorld'),
      entity.$type === 'org.bukkit.entity.Player'
        ? (entity as Ref<'org.bukkit.entity.Player'>)
        : undefined,
    );
  }

  @OnBlockBreakEvent('HIGHEST')
  public async blockBreak(@Context() event: PaperHandle<BlockBreakEvent>): Promise<void> {
    await shaLobbyRuntime.protect(
      event,
      await call<PaperHandle>(await call<PaperHandle>(event, 'getBlock'), 'getWorld'),
      await call<Ref<'org.bukkit.entity.Player'>>(event, 'getPlayer'),
    );
  }

  @OnBlockPlaceEvent('HIGHEST')
  public async blockPlace(@Context() event: PaperHandle<BlockPlaceEvent>): Promise<void> {
    await shaLobbyRuntime.protect(
      event,
      await call<PaperHandle>(await call<PaperHandle>(event, 'getBlock'), 'getWorld'),
      await call<Ref<'org.bukkit.entity.Player'>>(event, 'getPlayer'),
    );
  }

  @OnPlayerDropItemEvent('HIGHEST')
  public async drop(@Context() event: PaperHandle<PlayerDropItemEvent>): Promise<void> {
    await shaLobbyRuntime.protect(
      event,
      await call<PaperHandle>(
        await call<Ref<'org.bukkit.entity.Player'>>(event, 'getPlayer'),
        'getWorld',
      ),
      await call<Ref<'org.bukkit.entity.Player'>>(event, 'getPlayer'),
    );
  }

  @OnEntityPickupItemEvent('HIGHEST')
  public async pickup(@Context() event: PaperHandle<EntityPickupItemEvent>): Promise<void> {
    const entity = await callExact<PaperHandle>(event, 'getEntity', '()Lorg/bukkit/entity/Entity;');
    await shaLobbyRuntime.protect(
      event,
      await call<PaperHandle>(entity, 'getWorld'),
      entity.$type === 'org.bukkit.entity.Player'
        ? (entity as Ref<'org.bukkit.entity.Player'>)
        : undefined,
    );
  }

  @OnEntityExhaustionEvent('HIGHEST')
  public async exhaustion(@Context() event: PaperHandle): Promise<void> {
    await this.protectEntity(event);
  }

  @OnEntityTargetLivingEntityEvent('HIGHEST')
  public async target(@Context() event: PaperHandle): Promise<void> {
    const target = await callExact<PaperHandle | null>(
      event,
      'getTarget',
      '()Lorg/bukkit/entity/Entity;',
    );
    if (target !== null && target.$type === 'org.bukkit.entity.Player')
      await shaLobbyRuntime.protect(
        event,
        await call<PaperHandle>(target, 'getWorld'),
        target as Ref<'org.bukkit.entity.Player'>,
      );
  }

  @OnInventoryMoveItemEvent('HIGHEST')
  public async inventoryMove(@Context() event: PaperHandle): Promise<void> {
    const source = await call<PaperHandle>(event, 'getSource');
    const destination = await call<PaperHandle>(event, 'getDestination');
    const sourceLocation = await call<PaperHandle | null>(source, 'getLocation');
    const destinationLocation = await call<PaperHandle | null>(destination, 'getLocation');
    const location = sourceLocation ?? destinationLocation;
    if (location !== null)
      await shaLobbyRuntime.protect(event, await call<PaperHandle>(location, 'getWorld'));
  }

  @OnInventoryPickupItemEvent('HIGHEST')
  public async inventoryPickup(@Context() event: PaperHandle): Promise<void> {
    const inventory = await call<PaperHandle>(event, 'getInventory');
    const location = await call<PaperHandle | null>(inventory, 'getLocation');
    if (location !== null)
      await shaLobbyRuntime.protect(event, await call<PaperHandle>(location, 'getWorld'));
  }

  @OnPlayerSwapHandItemsEvent('HIGHEST')
  public async swap(@Context() event: PaperHandle): Promise<void> {
    await this.protectPlayer(event);
  }

  @OnPlayerItemConsumeEvent('HIGHEST')
  public async consume(@Context() event: PaperHandle): Promise<void> {
    await this.protectPlayer(event);
  }

  @OnPlayerItemDamageEvent('HIGHEST')
  public async itemDamage(@Context() event: PaperHandle): Promise<void> {
    await this.protectPlayer(event);
  }

  @OnPlayerBucketEmptyEvent('HIGHEST')
  public async bucketEmpty(@Context() event: PaperHandle): Promise<void> {
    await this.protectPlayer(event);
  }

  @OnPlayerBucketFillEvent('HIGHEST')
  public async bucketFill(@Context() event: PaperHandle): Promise<void> {
    await this.protectPlayer(event);
  }

  @OnPlayerArmorStandManipulateEvent('HIGHEST')
  public async armorStand(@Context() event: PaperHandle): Promise<void> {
    await this.protectPlayer(event);
  }

  @OnPlayerInteractEntityEvent('HIGHEST')
  public async interactEntity(@Context() event: PaperHandle): Promise<void> {
    await this.protectPlayer(event);
  }

  @OnPlayerInteractAtEntityEvent('HIGHEST')
  public async interactAtEntity(@Context() event: PaperHandle): Promise<void> {
    await this.protectPlayer(event);
  }

  @OnBlockDispenseEvent('HIGHEST')
  @OnBlockBurnEvent('HIGHEST')
  @OnBlockFadeEvent('HIGHEST')
  @OnBlockFormEvent('HIGHEST')
  @OnBlockGrowEvent('HIGHEST')
  @OnMoistureChangeEvent('HIGHEST')
  @OnSpongeAbsorbEvent('HIGHEST')
  @OnBlockFromToEvent('HIGHEST')
  @OnFluidLevelChangeEvent('HIGHEST')
  @OnBlockPistonExtendEvent('HIGHEST')
  @OnBlockPistonRetractEvent('HIGHEST')
  @OnBlockSpreadEvent('HIGHEST')
  @OnLeavesDecayEvent('HIGHEST')
  @OnBlockExplodeEvent('HIGHEST')
  @OnEntityBlockFormEvent('HIGHEST')
  @OnEntityChangeBlockEvent('HIGHEST')
  public async blockPolicy(@Context() event: PaperHandle): Promise<void> {
    await this.protectBlock(event);
  }

  @OnBlockIgniteEvent('HIGHEST')
  @OnCauldronLevelChangeEvent('HIGHEST')
  @OnTNTPrimeEvent('HIGHEST')
  public async attributedBlockPolicy(@Context() event: PaperHandle): Promise<void> {
    const block = await call<PaperHandle>(event, 'getBlock');
    const actor = await this.optionalPlayer(event, ['getPlayer', 'getEntity', 'getPrimingEntity']);
    await shaLobbyRuntime.protect(event, await call<PaperHandle>(block, 'getWorld'), actor);
  }

  @OnEntityExplodeEvent('HIGHEST')
  public async entityExplode(@Context() event: PaperHandle): Promise<void> {
    const location = await call<PaperHandle>(event, 'getLocation');
    await shaLobbyRuntime.protect(event, await call<PaperHandle>(location, 'getWorld'));
  }

  @OnEntityPlaceEvent('HIGHEST')
  @OnEntityPortalEvent('HIGHEST')
  @OnHangingBreakEvent('HIGHEST')
  @OnHangingPlaceEvent('HIGHEST')
  @OnProjectileLaunchEvent('HIGHEST')
  public async entityPolicy(@Context() event: PaperHandle): Promise<void> {
    await this.protectEntity(event);
  }

  @OnVehicleDamageEvent('HIGHEST')
  @OnVehicleDestroyEvent('HIGHEST')
  @OnVehicleEnterEvent('HIGHEST')
  @OnVehicleEntityCollisionEvent('HIGHEST')
  public async vehiclePolicy(@Context() event: PaperHandle): Promise<void> {
    const vehicle = await call<PaperHandle>(event, 'getVehicle');
    const actor = await this.optionalPlayer(event, ['getAttacker', 'getEntity', 'getEntered']);
    await shaLobbyRuntime.protect(event, await call<PaperHandle>(vehicle, 'getWorld'), actor);
  }

  @OnStructureGrowEvent('HIGHEST')
  @OnPortalCreateEvent('HIGHEST')
  public async worldPolicy(@Context() event: PaperHandle): Promise<void> {
    await shaLobbyRuntime.protect(
      event,
      await call<PaperHandle>(event, 'getWorld'),
      await this.optionalPlayer(event, ['getPlayer', 'getEntity']),
    );
  }

  @OnPlayerPortalEvent('HIGHEST')
  @OnPlayerLeashEntityEvent('HIGHEST')
  @OnPlayerShearEntityEvent('HIGHEST')
  public async playerEntityPolicy(@Context() event: PaperHandle): Promise<void> {
    await this.protectPlayer(event);
  }

  @OnEntityInteractEvent('HIGHEST')
  public async entityInteract(@Context() event: PaperHandle): Promise<void> {
    await this.protectBlock(event);
  }

  @OnWeatherChangeEvent('HIGHEST')
  public async weather(@Context() event: PaperHandle<WeatherChangeEvent>): Promise<void> {
    await shaLobbyRuntime.protectWeather(
      event,
      await call<PaperHandle>(event, 'getWorld'),
      'storm',
      await call<boolean>(event, 'toWeatherState'),
    );
  }

  @OnThunderChangeEvent('HIGHEST')
  public async thunder(@Context() event: PaperHandle<ThunderChangeEvent>): Promise<void> {
    await shaLobbyRuntime.protectWeather(
      event,
      await call<PaperHandle>(event, 'getWorld'),
      'thundering',
      await call<boolean>(event, 'toThunderState'),
    );
  }

  private async protectPlayer(event: PaperHandle): Promise<void> {
    const player = await call<Ref<'org.bukkit.entity.Player'>>(event, 'getPlayer');
    await shaLobbyRuntime.protect(event, await call<PaperHandle>(player, 'getWorld'), player);
  }

  private async protectBlock(event: PaperHandle): Promise<void> {
    const block = await call<PaperHandle>(event, 'getBlock');
    await shaLobbyRuntime.protect(event, await call<PaperHandle>(block, 'getWorld'));
  }

  private async protectEntity(event: PaperHandle): Promise<void> {
    const entity = await callExact<PaperHandle>(
      event,
      'getEntity',
      event.$type.startsWith('org.bukkit.event.hanging.')
        ? '()Lorg/bukkit/entity/Hanging;'
        : '()Lorg/bukkit/entity/Entity;',
    );
    await shaLobbyRuntime.protect(
      event,
      await call<PaperHandle>(entity, 'getWorld'),
      entity.$type === 'org.bukkit.entity.Player'
        ? (entity as Ref<'org.bukkit.entity.Player'>)
        : undefined,
    );
  }

  private async optionalPlayer(
    event: PaperHandle,
    methods: readonly string[],
  ): Promise<Ref<'org.bukkit.entity.Player'> | undefined> {
    for (const method of methods) {
      try {
        const value = await call<PaperHandle | null>(event, method);
        if (value?.$type === 'org.bukkit.entity.Player')
          return value as Ref<'org.bukkit.entity.Player'>;
      } catch {
        // The grouped event does not expose this optional attribution method.
      }
    }
    return undefined;
  }
}
