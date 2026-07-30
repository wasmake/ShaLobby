import { JAVA_TYPES, paperJava, runOutsidePaperFrame, type PaperHandle } from '@shamoo/paper-raw';

import {
  Bukkit,
  cancelEvent,
  call,
  callExact,
  component,
  constant,
  construct,
  gameRule,
  onlinePlayers,
  player,
  playerUniqueId,
  plugin,
  registerOutgoingPluginChannel,
  staticExact,
  type Ref,
} from './api.js';
import {
  LOBBY_FILES,
  LobbyConfigurationStore,
  type LobbyAction,
  type LobbyConfiguration,
  type LobbyItem,
  type LobbyMenu,
  type LobbyPortal,
  type Visibility,
} from './configuration.js';
import type {
  ManagedLobbyExecuteAction,
  ManagedLobbyData,
  ManagedLobbyRequest,
  ManagedLobbyResult,
} from './managed-lobby.js';
import { MessageCatalog } from './messages.js';

function data(value: unknown): ManagedLobbyData {
  return value as ManagedLobbyData;
}

interface Position {
  readonly world: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface WorldSettingsSnapshot {
  readonly gameRules: readonly { readonly name: string; readonly value: boolean | number }[];
  readonly name: string;
  readonly storm: boolean;
  readonly thundering: boolean;
  readonly time: number;
}

interface MenuSession {
  readonly inventory: PaperHandle;
  readonly menu: LobbyMenu;
}

interface SidebarSession {
  readonly scoreboard: PaperHandle;
  readonly objective: PaperHandle;
  readonly teams: readonly PaperHandle[];
}

const ITEM_KEY = 'managed_item';
const WAND_ID = 'portal-wand';
const DISPLAY_SLOT = 'SIDEBAR';

function generationId(): string {
  const value = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/gu, (token) => {
    const random = Math.floor(Math.random() * 16);
    return (token === 'x' ? random : (random & 3) | 8).toString(16);
  });
  return value;
}

function message(
  value: string,
  replacements: Readonly<Record<string, string | number>> = {},
): string {
  let result = value;
  for (const [key, replacement] of Object.entries(replacements))
    result = result.replaceAll(`%${key}%`, String(replacement));
  return result;
}

function utf(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > 65_535) throw new TypeError('Proxy message value is too long.');
  return Uint8Array.from([bytes.length >>> 8, bytes.length & 0xff, ...bytes]);
}

function connectPayload(server: string): Uint8Array {
  const command = utf('Connect');
  const target = utf(server);
  return Uint8Array.from([...command, ...target]);
}

class LobbyOverloadedError extends Error {}

export class ShaLobbyRuntime {
  readonly #store = new LobbyConfigurationStore();
  readonly #generation = generationId();
  readonly #deferredTasks = new Set<PaperHandle>();
  readonly #itemCooldowns = new Map<string, number>();
  readonly #initializedPlayers = new Set<string>();
  readonly #menuSessions = new Map<string, MenuSession>();
  readonly #occupiedPortals = new Map<string, string>();
  readonly #pendingJoins = new Map<string, Ref<'org.bukkit.entity.Player'>>();
  readonly #portalCooldowns = new Map<string, number>();
  readonly #portalSelections = new Map<string, { first?: Position; second?: Position }>();
  readonly #pendingActions = new Set<Promise<void>>();
  readonly #sidebarSessions = new Map<string, SidebarSession>();
  readonly #transferCooldowns = new Map<string, number>();
  readonly #visibility = new Map<string, Visibility>();
  readonly #visualizers = new Set<string>();
  #configuration: LobbyConfiguration | undefined;
  #closed = false;
  #enforcementActive = false;
  #itemKey: PaperHandle | undefined;
  #mutationQueue: Promise<void> = Promise.resolve();
  #pendingMutations = 0;
  #persistentString: PaperHandle | undefined;
  #reloading = false;
  #revision = 0;
  #sidebarRefreshActive = false;
  #tasks: PaperHandle[] = [];

  public get configuration(): LobbyConfiguration {
    if (this.#configuration === undefined) throw new Error('ShaLobby configuration is not loaded.');
    return this.#configuration;
  }

  public async request(request: ManagedLobbyRequest): Promise<ManagedLobbyResult> {
    try {
      if (request.operation === 'ensure')
        return {
          ok: true,
          state: 'ensured',
          files: LOBBY_FILES,
          directory: 'data',
        };
      if (request.operation === 'reload') return await this.serializeMutation(() => this.reload());
      if (request.operation === 'status') return this.status();
      return await this.serializeMutation(() => this.execute(request));
    } catch (error: unknown) {
      return {
        ok: false,
        state:
          error instanceof LobbyOverloadedError
            ? 'overloaded'
            : error instanceof RangeError
              ? 'unknown'
              : 'invalid',
        error: error instanceof Error ? error.message.slice(0, 512) : String(error).slice(0, 512),
      };
    }
  }

  public async reload(): Promise<ManagedLobbyResult & { readonly ok: true }> {
    if (this.#closed) throw new Error('ShaLobby is closed.');
    const candidate = await this.#store.load();
    await this.preflight(candidate);
    const previousWorldSettings = await this.captureWorldSettings(candidate);
    const previous = this.#configuration;
    const previousInitializedPlayers = new Set(this.#initializedPlayers);
    const previousVisibility = new Map(this.#visibility);
    this.#reloading = true;
    this.#revision++;
    try {
      await this.stopTasks();
      await this.stopDeferredTasks();
      await this.awaitPendingActions();
      this.#configuration = candidate;
      await this.initializeKeys();
      await this.applyWorldSettings();
      await this.registerMessaging();
      const onlinePlayersNow = await onlinePlayers();
      await this.resetPresentation(onlinePlayersNow);
      this.#initializedPlayers.clear();
      for (const online of onlinePlayersNow) {
        const id = await playerUniqueId(online);
        if (await this.isManagedPlayer(online)) {
          this.#visibility.set(id, this.configuration.settings.visibility.default);
          await this.giveItems(online);
          await this.updateSidebar(online, onlinePlayersNow.length);
          await this.applyVisibility(online);
        } else {
          this.#visibility.delete(id);
          await this.removeManagedItems(online);
          for (const other of onlinePlayersNow)
            if (!paperJava.same(online, other)) await call(online, 'showPlayer', plugin, other);
        }
        this.#initializedPlayers.add(id);
      }
      await this.replayPendingJoins();
      await this.restartTasks();
    } catch (error) {
      const rollbackFailures: unknown[] = [];
      let onlinePlayersNow: readonly Ref<'org.bukkit.entity.Player'>[] = [];
      try {
        onlinePlayersNow = await onlinePlayers();
      } catch (rollbackError: unknown) {
        rollbackFailures.push(rollbackError);
      }
      try {
        await this.resetPresentation(onlinePlayersNow);
      } catch (rollbackError: unknown) {
        rollbackFailures.push(rollbackError);
      }
      for (const online of onlinePlayersNow)
        try {
          await this.removeManagedItems(online);
          for (const other of onlinePlayersNow)
            if (!paperJava.same(online, other)) await call(online, 'showPlayer', plugin, other);
        } catch (rollbackError: unknown) {
          rollbackFailures.push(rollbackError);
        }
      try {
        await this.restoreWorldSettings(previousWorldSettings);
      } catch (rollbackError: unknown) {
        rollbackFailures.push(rollbackError);
      }
      this.#configuration = previous;
      this.#initializedPlayers.clear();
      for (const id of previousInitializedPlayers) this.#initializedPlayers.add(id);
      this.#visibility.clear();
      for (const [id, visibility] of previousVisibility) this.#visibility.set(id, visibility);
      if (previous !== undefined) {
        try {
          onlinePlayersNow = await onlinePlayers();
        } catch (restartError: unknown) {
          rollbackFailures.push(restartError);
        }
        for (const online of onlinePlayersNow)
          try {
            if (await this.isManagedPlayer(online)) {
              await this.giveItems(online);
              await this.updateSidebar(online, onlinePlayersNow.length);
              await this.applyVisibility(online);
            } else {
              const id = await playerUniqueId(online);
              this.#visibility.delete(id);
              await this.removeManagedItems(online);
              for (const other of onlinePlayersNow)
                if (!paperJava.same(online, other)) await call(online, 'showPlayer', plugin, other);
            }
          } catch (restartError: unknown) {
            rollbackFailures.push(restartError);
          }
        try {
          await this.replayPendingJoins();
          await this.restartTasks();
        } catch (restartError: unknown) {
          rollbackFailures.push(restartError);
        }
      }
      if (rollbackFailures.length > 0)
        throw new AggregateError(
          [error, ...rollbackFailures],
          'ShaLobby reload and rollback failed.',
          { cause: error },
        );
      throw error;
    } finally {
      this.#reloading = false;
    }
    await this.replayPendingJoins();
    return {
      ok: true,
      state: 'reloaded',
      files: LOBBY_FILES,
      messagesContent: candidate.messagesContent,
      spawnConfigured: candidate.spawn.configured,
      items: candidate.items.length,
      menus: candidate.menus.length,
      servers: candidate.servers.length,
      portals: candidate.portals.length,
    };
  }

  public async close(): Promise<void> {
    if (this.#closed) return;
    const runtime = await paperJava.describe();
    const replacementPresent = runtime['replacementPresent'] === true;
    if (runtime['platformEnabled'] === false) {
      this.#closed = true;
      this.#revision++;
      // Paper can no longer complete scheduler-bound work; runtime teardown abandons it.
      this.clearState();
      return;
    }
    if (replacementPresent) {
      this.#reloading = true;
      this.#revision++;
      try {
        await this.stopDeferredTasks();
        await this.awaitPendingActions();
        await this.replayPendingJoins();
      } catch (error: unknown) {
        console.error('[ShaLobby] Pending joins could not be replayed during replacement.', error);
      }
    }
    this.#closed = true;
    const failures: unknown[] = [];
    const attempt = async (action: () => Promise<void>): Promise<void> => {
      try {
        await action();
      } catch (error: unknown) {
        failures.push(error);
      }
    };
    await attempt(() => this.stopTasks());
    await attempt(() => this.stopDeferredTasks());
    await attempt(() => this.awaitPendingActions());
    let online: readonly Ref<'org.bukkit.entity.Player'>[] = [];
    await attempt(async () => {
      online = await onlinePlayers();
    });
    let manager: PaperHandle | undefined;
    let main: PaperHandle | undefined;
    await attempt(async () => {
      manager = await staticExact<PaperHandle>(
        Bukkit,
        'getScoreboardManager',
        '()Lorg/bukkit/scoreboard/ScoreboardManager;',
      );
      main = await call<PaperHandle>(manager, 'getMainScoreboard');
    });
    for (const current of online)
      await attempt(async () => {
        const id = await playerUniqueId(current);
        const sidebar = this.#sidebarSessions.get(id);
        if (sidebar !== undefined) {
          const assigned = await call<PaperHandle>(current, 'getScoreboard');
          if (main !== undefined && paperJava.same(assigned, sidebar.scoreboard))
            await call(current, 'setScoreboard', main);
          await assigned.$release();
        }
        const menu = this.#menuSessions.get(id);
        if (menu !== undefined) {
          const view = await call<PaperHandle>(current, 'getOpenInventory');
          const top = await call<PaperHandle>(view, 'getTopInventory');
          if (paperJava.same(top, menu.inventory)) await call(current, 'closeInventory');
          await top.$release();
          await view.$release();
        }
        if (!replacementPresent)
          for (const other of online)
            if (!paperJava.same(current, other)) await call(current, 'showPlayer', plugin, other);
      });
    if (main !== undefined) {
      const handle = main;
      await attempt(async () => {
        await handle.$release();
      });
    }
    if (manager !== undefined) {
      const handle = manager;
      await attempt(async () => {
        await handle.$release();
      });
    }
    for (const session of this.#sidebarSessions.values())
      await attempt(() => this.releaseSidebar(session));
    for (const session of this.#menuSessions.values())
      await attempt(() => session.inventory.$release().then(() => undefined));
    if (!replacementPresent)
      await attempt(async () => {
        const messenger = await staticExact<PaperHandle>(
          Bukkit,
          'getMessenger',
          '()Lorg/bukkit/plugin/messaging/Messenger;',
        );
        try {
          await callExact(
            messenger,
            'unregisterOutgoingPluginChannel',
            '(Lorg/bukkit/plugin/Plugin;Ljava/lang/String;)V',
            plugin,
            'BungeeCord',
          );
        } finally {
          await messenger.$release();
        }
      });
    if (this.#itemKey !== undefined) {
      const handle = this.#itemKey;
      await attempt(async () => {
        await handle.$release();
      });
    }
    if (this.#persistentString !== undefined) {
      const handle = this.#persistentString;
      await attempt(async () => {
        await handle.$release();
      });
    }
    this.clearState();
    if (failures.length > 0 && replacementPresent) {
      console.error('[ShaLobby] Stale generation cleanup was incomplete.', failures);
      return;
    }
    if (failures.length > 0)
      throw new AggregateError(failures, 'ShaLobby shutdown was incomplete.');
  }

  private clearState(): void {
    this.#tasks = [];
    this.#deferredTasks.clear();
    this.#pendingActions.clear();
    this.#sidebarSessions.clear();
    this.#menuSessions.clear();
    this.#itemCooldowns.clear();
    this.#initializedPlayers.clear();
    this.#portalCooldowns.clear();
    this.#occupiedPortals.clear();
    this.#pendingJoins.clear();
    this.#portalSelections.clear();
    this.#transferCooldowns.clear();
    this.#visibility.clear();
    this.#visualizers.clear();
    this.#itemKey = undefined;
    this.#persistentString = undefined;
    this.#configuration = undefined;
  }

  public async join(event: PaperHandle): Promise<void> {
    const current = await call<Ref<'org.bukkit.entity.Player'>>(event, 'getPlayer');
    if (!(await this.isManagedPlayer(current))) return;
    const id = await playerUniqueId(current);
    this.#initializedPlayers.add(id);
    this.#pendingJoins.set(id, current);
    if (this.configuration.settings.join['suppress-message'])
      await callExact(event, 'joinMessage', '(Lnet/kyori/adventure/text/Component;)V', null);
    await this.deferPlayer(current, async () => {
      try {
        await this.initializeJoinedPlayer(current);
      } finally {
        this.#pendingJoins.delete(id);
      }
    });
  }

  private async initializeJoinedPlayer(current: Ref<'org.bukkit.entity.Player'>): Promise<void> {
    const id = await playerUniqueId(current);
    this.#visibility.set(id, this.configuration.settings.visibility.default);
    if (this.configuration.settings.join.reset) await this.resetPlayer(current);
    else await this.giveItems(current);
    if (this.configuration.settings.join.teleport && this.configuration.spawn.configured)
      await this.teleportToSpawn(current);
    for (const viewer of await onlinePlayers()) await this.applyVisibility(viewer);
    const playerName = await call<string>(current, 'getName');
    await this.executeAction(current, {
      type: 'title',
      target: this.configuration.settings.join['welcome-title'],
    });
    await this.executeAction(current, {
      type: 'sound',
      target: this.configuration.settings.join['welcome-sound'],
    });
    await this.executeAction(current, {
      type: 'particle',
      target: this.configuration.settings.join['welcome-particle'],
    });
    await call(
      current,
      'sendRichMessage',
      message(this.message(this.configuration.settings.join['welcome-message']), {
        player: playerName,
      }),
    );
    await this.updateSidebar(current);
  }

  private async replayPendingJoins(): Promise<void> {
    for (const [id, current] of [...this.#pendingJoins]) {
      if (this.#pendingJoins.get(id) !== current) continue;
      try {
        if (await this.isManagedPlayer(current)) await this.initializeJoinedPlayer(current);
        this.#initializedPlayers.add(id);
      } finally {
        this.#pendingJoins.delete(id);
      }
    }
  }

  public async respawn(event: PaperHandle): Promise<void> {
    const current = await call<Ref<'org.bukkit.entity.Player'>>(event, 'getPlayer');
    if (!(await this.isManagedPlayer(current))) return;
    if (this.configuration.spawn.configured) {
      const location = await this.spawnLocation();
      await callExact(event, 'setRespawnLocation', '(Lorg/bukkit/Location;)V', location);
    }
    await this.deferPlayer(current, () => this.giveItems(current));
  }

  public async quit(event: PaperHandle): Promise<void> {
    const current = await call<Ref<'org.bukkit.entity.Player'>>(event, 'getPlayer');
    const id = await playerUniqueId(current);
    this.#initializedPlayers.delete(id);
    this.#pendingJoins.delete(id);
    const menu = this.#menuSessions.get(id);
    this.#menuSessions.delete(id);
    this.#visibility.delete(id);
    this.#portalSelections.delete(id);
    this.#occupiedPortals.delete(id);
    this.#visualizers.delete(id);
    const sidebar = this.#sidebarSessions.get(id);
    this.#sidebarSessions.delete(id);
    if (menu !== undefined || sidebar !== undefined)
      runOutsidePaperFrame(() => {
        this.startDetached('Player quit cleanup', async () => {
          await menu?.inventory.$release();
          if (sidebar !== undefined) await this.releaseSidebar(sidebar);
        });
      });
  }

  public async protect(
    event: PaperHandle,
    world: PaperHandle,
    actor?: Ref<'org.bukkit.entity.Player'>,
  ): Promise<void> {
    if (!this.configuration.settings.protection.enabled) return;
    if (!(await this.isManagedWorld(world))) return;
    if (
      actor !== undefined &&
      (await call<boolean>(
        actor,
        'hasPermission',
        this.configuration.settings.protection['bypass-permission'],
      ))
    )
      return;
    await cancelEvent(event);
  }

  public async protectWeather(
    event: PaperHandle,
    world: PaperHandle,
    property: 'storm' | 'thundering',
    requested: boolean,
  ): Promise<void> {
    const name = await call<string>(world, 'getName');
    const settings = this.configuration.settings.worlds.find(
      (candidate) => candidate.name === name,
    );
    if (settings === undefined || settings[property] === requested) return;
    await this.protect(event, world);
  }

  public async move(event: PaperHandle): Promise<void> {
    const current = await call<Ref<'org.bukkit.entity.Player'>>(event, 'getPlayer');
    const id = await playerUniqueId(current);
    const destination = await call<Ref<'org.bukkit.Location'> | null>(event, 'getTo');
    const destinationManaged = destination !== null && (await this.isManagedLocation(destination));
    if (!destinationManaged) {
      this.#occupiedPortals.delete(id);
      if (this.#visibility.has(id))
        await this.deferPlayer(current, () => this.leaveManagedPlayer(current));
      return;
    }
    if (!(await this.isManagedPlayer(current))) {
      await this.deferPlayer(current, async () => {
        this.#visibility.set(id, this.configuration.settings.visibility.default);
        await this.giveItems(current);
        await this.updateSidebar(current);
        for (const viewer of await onlinePlayers()) await this.applyVisibility(viewer);
      });
      return;
    }
    const y = await call<number>(destination, 'getY');
    if (y < this.configuration.settings['void-rescue-y'] && this.configuration.spawn.configured) {
      await this.deferPlayer(current, () => this.teleportToSpawn(current));
      return;
    }
    const portal = await this.portalAt(destination);
    if (portal === undefined) {
      this.#occupiedPortals.delete(id);
      return;
    }
    if (this.#occupiedPortals.get(id) === portal.id) return;
    this.#occupiedPortals.set(id, portal.id);
    const now = Date.now();
    if ((this.#portalCooldowns.get(`${id}:${portal.id}`) ?? 0) > now) return;
    if (
      portal.permission !== undefined &&
      !(await call<boolean>(current, 'hasPermission', portal.permission))
    )
      return;
    await this.deferPlayer(current, async () => {
      if (this.#occupiedPortals.get(id) !== portal.id) return;
      const currentPortal = await this.portalAt(
        await call<Ref<'org.bukkit.Location'>>(current, 'getLocation'),
      );
      if (currentPortal?.id !== portal.id) return;
      if (
        currentPortal.permission !== undefined &&
        !(await call<boolean>(current, 'hasPermission', currentPortal.permission))
      )
        return;
      await this.executeAction(current, currentPortal.action);
      this.#portalCooldowns.set(
        `${id}:${currentPortal.id}`,
        Date.now() + currentPortal['cooldown-ms'],
      );
    });
  }

  public async interact(event: PaperHandle): Promise<void> {
    const current = await call<Ref<'org.bukkit.entity.Player'>>(event, 'getPlayer');
    if (!(await this.isManagedPlayer(current))) return;
    const hand = await call(event, 'getHand');
    if (hand !== null && this.enumName(hand) !== 'HAND') return;
    const item = await call<PaperHandle | null>(event, 'getItem');
    if (item === null) return;
    const id = await this.managedItemId(item);
    if (id === undefined) return;
    await cancelEvent(event);
    const action = this.enumName(await call(event, 'getAction'));
    if (id === WAND_ID) {
      if (
        !(await call<boolean>(
          current,
          'hasPermission',
          this.configuration.settings.protection['bypass-permission'],
        ))
      )
        return;
      const clicked = await call<PaperHandle | null>(event, 'getClickedBlock');
      if (clicked === null || (!action.includes('LEFT_CLICK') && !action.includes('RIGHT_CLICK')))
        return;
      await this.capturePortalPosition(
        current,
        action.includes('LEFT_CLICK') ? 'portal-pos1' : 'portal-pos2',
        await call<Ref<'org.bukkit.Location'>>(clicked, 'getLocation'),
      );
      return;
    }
    if (!action.includes('RIGHT_CLICK')) return;
    const definition = this.configuration.items.find((candidate) => candidate.id === id);
    if (definition === undefined) return;
    const playerId = await playerUniqueId(current);
    const key = `${playerId}:${id}`;
    const now = Date.now();
    if ((this.#itemCooldowns.get(key) ?? 0) > now) return;
    this.#itemCooldowns.set(key, now + (definition['cooldown-ms'] ?? 0));
    await this.deferPlayer(current, () => this.executeAction(current, definition.action));
  }

  public async inventoryClick(event: PaperHandle): Promise<void> {
    const current = await call<Ref<'org.bukkit.entity.Player'>>(event, 'getWhoClicked');
    if (!(await this.isManagedPlayer(current))) return;
    const currentItem = await call<PaperHandle | null>(event, 'getCurrentItem');
    const cursor = await call<PaperHandle | null>(event, 'getCursor');
    const managedItem =
      (currentItem !== null && (await this.managedItemId(currentItem)) !== undefined) ||
      (cursor !== null && (await this.managedItemId(cursor)) !== undefined);
    const id = await playerUniqueId(current);
    const session = this.#menuSessions.get(id);
    if (session === undefined) {
      if (managedItem) await cancelEvent(event);
      return;
    }
    const view = await call<PaperHandle>(event, 'getView');
    const top = await call<PaperHandle>(view, 'getTopInventory');
    if (!paperJava.same(top, session.inventory)) {
      if (managedItem) await cancelEvent(event);
      return;
    }
    await cancelEvent(event);
    const rawSlot = await call<number>(event, 'getRawSlot');
    const definition = session.menu.slots.find((slot) => slot.slot === rawSlot);
    if (definition !== undefined)
      await this.deferPlayer(current, () => this.executeAction(current, definition.action));
  }

  public async inventoryDrag(event: PaperHandle): Promise<void> {
    const current = await call<Ref<'org.bukkit.entity.Player'>>(event, 'getWhoClicked');
    if (!(await this.isManagedPlayer(current))) return;
    const cursor = await call<PaperHandle | null>(event, 'getOldCursor');
    if (cursor !== null && (await this.managedItemId(cursor)) !== undefined) {
      await cancelEvent(event);
      return;
    }
    const id = await playerUniqueId(current);
    const session = this.#menuSessions.get(id);
    if (session === undefined) return;
    const view = await call<PaperHandle>(event, 'getView');
    const top = await call<PaperHandle>(view, 'getTopInventory');
    if (paperJava.same(top, session.inventory)) await cancelEvent(event);
  }

  private status(): ManagedLobbyResult {
    const configuration = this.#configuration;
    return {
      ok: true,
      state: this.#closed ? 'closed' : configuration === undefined ? 'uninitialized' : 'ready',
      generation: this.#generation,
      active: configuration !== undefined && !this.#closed,
      invocationAdmissionOpen: !this.#closed,
      pendingActions: this.#pendingMutations,
      maximumPendingActions: 256,
      directory: 'data',
      files: LOBBY_FILES,
      ...(configuration === undefined
        ? {}
        : {
            spawnConfigured: configuration.spawn.configured,
            items: configuration.items.length,
            menus: configuration.menus.length,
            servers: configuration.servers.length,
            portals: configuration.portals.length,
          }),
    };
  }

  private async execute(action: ManagedLobbyExecuteAction): Promise<ManagedLobbyResult> {
    if (
      action.action.startsWith('portal-') &&
      action.action !== 'portal-list' &&
      action.action !== 'portal-info' &&
      'player' in action
    )
      await this.requirePortalEditor(action.player);
    if (action.action === 'setspawn') return this.setSpawn(action.player);
    if (action.action === 'spawn') {
      const current = await this.requirePlayer(action.player);
      await this.teleportToSpawn(current);
      return { ok: true, state: 'spawn-requested', player: action.player };
    }
    if (action.action === 'items') {
      await this.giveItems(await this.requirePlayer(action.player));
      return { ok: true, state: 'items-restored', player: action.player };
    }
    if (action.action === 'menu') {
      await this.openMenu(await this.requirePlayer(action.player), action.id);
      return { ok: true, state: 'menu-opened', id: action.id };
    }
    if (action.action === 'portal-wand') {
      await this.givePortalWand(await this.requirePlayer(action.player));
      return { ok: true, state: 'portal-wand', message: 'Varita de portales entregada.' };
    }
    if (action.action === 'portal-pos1' || action.action === 'portal-pos2')
      return this.capturePortalPosition(await this.requirePlayer(action.player), action.action);
    if (action.action === 'portal-list')
      return {
        ok: true,
        state: 'portal-list',
        portals: data(this.configuration.portals),
        count: this.configuration.portals.length,
        message: `Portales configurados: ${String(this.configuration.portals.length)}.`,
      };
    if (action.action === 'portal-info') {
      const portal = this.portal(action.id);
      return {
        ok: true,
        state: 'portal-info',
        portal: data(portal),
        message: `Portal ${portal.id}.`,
      };
    }
    if (action.action === 'portal-visualize') {
      if (action.enabled) this.#visualizers.add(action.player);
      else this.#visualizers.delete(action.player);
      return {
        ok: true,
        state: 'portal-visualization-updated',
        enabled: action.enabled,
        message: action.enabled ? 'Visualización activada.' : 'Visualización desactivada.',
      };
    }
    return this.mutatePortal(action);
  }

  private serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#pendingMutations >= 256)
      throw new LobbyOverloadedError('ShaLobby action queue is full.');
    this.#pendingMutations += 1;
    const result = this.#mutationQueue.then(operation);
    this.#mutationQueue = result
      .then(
        () => undefined,
        () => undefined,
      )
      .finally(() => {
        this.#pendingMutations -= 1;
      });
    return result;
  }

  private async mutatePortal(
    action: Exclude<
      ManagedLobbyExecuteAction,
      {
        readonly action:
          | 'setspawn'
          | 'spawn'
          | 'items'
          | 'menu'
          | 'portal-wand'
          | 'portal-pos1'
          | 'portal-pos2'
          | 'portal-list'
          | 'portal-info'
          | 'portal-visualize';
      }
    >,
  ): Promise<ManagedLobbyResult> {
    if (action.action === 'portal-create') {
      const selection = this.#portalSelections.get(action.player);
      if (selection?.first === undefined || selection.second === undefined)
        throw new Error('Selecciona las dos posiciones antes de crear el portal.');
      if (selection.first.world !== selection.second.world)
        throw new Error('Las posiciones del portal deben estar en el mismo mundo.');
      if (this.configuration.portals.some((portal) => portal.id === action.id))
        throw new Error(`El portal ${action.id} ya existe.`);
      if (
        action.destination !== undefined &&
        !this.configuration.servers.some(
          (server) => server.id === action.destination && server.enabled,
        )
      )
        throw new Error(`El servidor ${action.destination} no está disponible.`);
      const portal: LobbyPortal = {
        id: action.id,
        enabled: action.enabled ?? true,
        world: selection.first.world,
        min: {
          x: Math.min(selection.first.x, selection.second.x),
          y: Math.min(selection.first.y, selection.second.y),
          z: Math.min(selection.first.z, selection.second.z),
        },
        max: {
          x: Math.max(selection.first.x, selection.second.x),
          y: Math.max(selection.first.y, selection.second.y),
          z: Math.max(selection.first.z, selection.second.z),
        },
        ...(action.permission === undefined ? {} : { permission: action.permission }),
        priority: action.priority ?? 0,
        'cooldown-ms': action['cooldown-ms'] ?? this.configuration.settings['portal-cooldown-ms'],
        ...(action.destination === undefined ? {} : { destination: action.destination }),
        action:
          action.destination === undefined
            ? { type: 'none' }
            : { type: 'connect', target: action.destination },
        visualize: action.visualize ?? false,
      };
      await this.#store.writePortals([...this.configuration.portals, portal]);
      this.configuration.portals.push(portal);
      return {
        ok: true,
        state: 'portal-created',
        portal: data(portal),
        message: `Portal ${portal.id} creado.`,
      };
    }
    const portal = this.portal(action.id);
    if (action.action === 'portal-remove') {
      const next = this.configuration.portals.filter((candidate) => candidate !== portal);
      await this.#store.writePortals(next);
      this.configuration.portals.splice(this.configuration.portals.indexOf(portal), 1);
      return {
        ok: true,
        state: 'portal-removed',
        portal: data(portal),
        message: `Portal ${portal.id} eliminado.`,
      };
    }
    const updated: LobbyPortal = {
      ...portal,
      min: { ...portal.min },
      max: { ...portal.max },
      action: { ...portal.action },
    };
    if (action.action === 'portal-enable') updated.enabled = true;
    else if (action.action === 'portal-disable') updated.enabled = false;
    else if (action.type === 'spawn') {
      updated.action = { type: 'spawn' };
      delete updated.destination;
    } else if (action.type === 'server') {
      if (
        !this.configuration.servers.some((server) => server.id === action.target && server.enabled)
      )
        throw new Error(`El servidor ${action.target} no está disponible.`);
      updated.action = { type: 'connect', target: action.target };
      updated.destination = action.target;
    } else {
      if (!this.configuration.menus.some((menu) => menu.id === action.target))
        throw new Error(`El menú ${action.target} no existe.`);
      updated.action = { type: 'menu', target: action.target };
      delete updated.destination;
    }
    const next = this.configuration.portals.map((candidate) =>
      candidate === portal ? updated : candidate,
    );
    await this.#store.writePortals(next);
    Object.assign(portal, updated);
    const state =
      action.action === 'portal-enable'
        ? 'portal-enabled'
        : action.action === 'portal-disable'
          ? 'portal-disabled'
          : 'portal-destination';
    return { ok: true, state, portal: data(portal), message: `Portal ${portal.id} actualizado.` };
  }

  private async setSpawn(id: string): Promise<ManagedLobbyResult> {
    const current = await this.requirePlayer(id);
    const location = await call<Ref<'org.bukkit.Location'>>(current, 'getLocation');
    const world = await call<Ref<'org.bukkit.World'>>(location, 'getWorld');
    const spawn = {
      configured: true,
      world: await call<string>(world, 'getName'),
      x: await call<number>(location, 'getX'),
      y: await call<number>(location, 'getY'),
      z: await call<number>(location, 'getZ'),
      yaw: await call<number>(location, 'getYaw'),
      pitch: await call<number>(location, 'getPitch'),
    };
    await this.#store.writeSpawn(spawn);
    Object.assign(this.configuration.spawn, spawn);
    return { ok: true, state: 'spawn-set', world: spawn.world, x: spawn.x, y: spawn.y, z: spawn.z };
  }

  private async requirePlayer(id: string): Promise<Ref<'org.bukkit.entity.Player'>> {
    const result = await player(id);
    if (result === null) throw new RangeError(`No se encontró el jugador ${id}.`);
    return result;
  }

  private async requirePortalEditor(id: string): Promise<Ref<'org.bukkit.entity.Player'>> {
    const current = await this.requirePlayer(id);
    if (!(await this.isManagedPlayer(current)))
      throw new Error('La edición de portales solo está disponible en un mundo administrado.');
    if (
      !(await call<boolean>(
        current,
        'hasPermission',
        this.configuration.settings.protection['bypass-permission'],
      ))
    )
      throw new Error('La edición de portales requiere el permiso de omisión de protección.');
    return current;
  }

  private async resetPlayer(current: Ref<'org.bukkit.entity.Player'>): Promise<void> {
    const inventory = await call<PaperHandle>(current, 'getInventory');
    await call(inventory, 'clear');
    await call(current, 'closeInventory');
    await call(current, 'setGameMode', await constant('org.bukkit.GameMode', 'ADVENTURE'));
    for (const effect of await call<readonly PaperHandle[]>(current, 'getActivePotionEffects'))
      await call(current, 'removePotionEffect', await call<PaperHandle>(effect, 'getType'));
    await call(current, 'setHealth', await call<number>(current, 'getMaxHealth'));
    await call(current, 'setFoodLevel', 20);
    await call(current, 'setSaturation', 20);
    await call(current, 'setExhaustion', 0);
    await call(current, 'setLevel', 0);
    await call(current, 'setExp', 0);
    await call(current, 'setTotalExperience', 0);
    await call(current, 'setFireTicks', 0);
    await call(current, 'setFallDistance', 0);
    await call(
      current,
      'setVelocity',
      await construct('org.bukkit.util.Vector', '(DDD)V', 0, 0, 0),
    );
    await call(current, 'setFlying', false);
    await call(current, 'setAllowFlight', false);
    await call(current, 'setWalkSpeed', 0.2);
    await call(current, 'setFlySpeed', 0.1);
    await this.giveItems(current);
  }

  private async initializeKeys(): Promise<void> {
    this.#itemKey ??= await construct(
      'org.bukkit.NamespacedKey',
      '(Lorg/bukkit/plugin/Plugin;Ljava/lang/String;)V',
      plugin,
      ITEM_KEY,
    );
    this.#persistentString ??= await constant(
      'org.bukkit.persistence.PersistentDataType',
      'STRING',
    );
  }

  private async managedItemId(item: PaperHandle): Promise<string | undefined> {
    const meta = await call<PaperHandle | null>(item, 'getItemMeta');
    if (meta === null || this.#itemKey === undefined || this.#persistentString === undefined)
      return undefined;
    const container = await call<PaperHandle>(meta, 'getPersistentDataContainer');
    const value = await call<string | null>(
      container,
      'get',
      this.#itemKey,
      this.#persistentString,
    );
    return value ?? undefined;
  }

  private async createItem(definition: LobbyItem, managedId: string): Promise<PaperHandle> {
    const material = await constant('org.bukkit.Material', definition.material);
    const item = await construct(
      'org.bukkit.inventory.ItemStack',
      '(Lorg/bukkit/Material;I)V',
      material,
      definition.amount,
    );
    const meta = await call<PaperHandle | null>(item, 'getItemMeta');
    if (meta !== null) {
      await call(meta, 'displayName', await component(definition.name));
      await call(meta, 'lore', await Promise.all(definition.lore.map(component)));
      const container = await call<PaperHandle>(meta, 'getPersistentDataContainer');
      await call(container, 'set', this.#itemKey, this.#persistentString, managedId);
      await call(item, 'setItemMeta', meta);
    }
    return item;
  }

  private async giveItems(current: Ref<'org.bukkit.entity.Player'>): Promise<void> {
    const inventory = await call<PaperHandle>(current, 'getInventory');
    const contents = await call<readonly (PaperHandle | null)[]>(inventory, 'getContents');
    for (const [slot, existing] of contents.entries())
      if (existing !== null && (await this.managedItemId(existing)) !== undefined)
        await callExact(inventory, 'setItem', '(ILorg/bukkit/inventory/ItemStack;)V', slot, null);
    for (const definition of this.configuration.items) {
      const item = await this.createItem(
        definition,
        definition.id ?? `slot-${String(definition.slot)}`,
      );
      await callExact(
        inventory,
        'setItem',
        '(ILorg/bukkit/inventory/ItemStack;)V',
        definition.slot,
        item,
      );
    }
  }

  private async removeManagedItems(current: Ref<'org.bukkit.entity.Player'>): Promise<void> {
    const inventory = await call<PaperHandle>(current, 'getInventory');
    const contents = await call<readonly (PaperHandle | null)[]>(inventory, 'getContents');
    for (const [slot, existing] of contents.entries())
      if (existing !== null && (await this.managedItemId(existing)) !== undefined)
        await callExact(inventory, 'setItem', '(ILorg/bukkit/inventory/ItemStack;)V', slot, null);
  }

  private async leaveManagedPlayer(current: Ref<'org.bukkit.entity.Player'>): Promise<void> {
    const id = await playerUniqueId(current);
    await this.removeManagedItems(current);
    const menu = this.#menuSessions.get(id);
    if (menu !== undefined) {
      await call(current, 'closeInventory');
      await menu.inventory.$release();
      this.#menuSessions.delete(id);
    }
    const sidebar = this.#sidebarSessions.get(id);
    if (sidebar !== undefined) {
      const manager = await staticExact<PaperHandle>(
        Bukkit,
        'getScoreboardManager',
        '()Lorg/bukkit/scoreboard/ScoreboardManager;',
      );
      await call(current, 'setScoreboard', await call<PaperHandle>(manager, 'getMainScoreboard'));
      await this.releaseSidebar(sidebar);
      this.#sidebarSessions.delete(id);
    }
    for (const target of await onlinePlayers()) await call(current, 'showPlayer', plugin, target);
    this.#visibility.delete(id);
    this.#occupiedPortals.delete(id);
    this.#portalSelections.delete(id);
    this.#visualizers.delete(id);
  }

  private async givePortalWand(current: Ref<'org.bukkit.entity.Player'>): Promise<void> {
    const wand: LobbyItem = {
      id: WAND_ID,
      slot: 0,
      material: 'BLAZE_ROD',
      amount: 1,
      name: '<gradient:#38D9FF:#A855F7><bold>Varita de portales</bold></gradient>',
      lore: ['<#A8B3C7>Izquierdo: posición 1', '<#A8B3C7>Derecho: posición 2'],
      action: { type: 'none' },
    };
    const inventory = await call<PaperHandle>(current, 'getInventory');
    await call(inventory, 'addItem', await this.createItem(wand, WAND_ID));
  }

  private async openMenu(current: Ref<'org.bukkit.entity.Player'>, id: string): Promise<void> {
    const menu = this.configuration.menus.find((candidate) => candidate.id === id);
    if (menu === undefined) throw new RangeError(`No existe el menú ${id}.`);
    const inventory = await staticExact<PaperHandle>(
      Bukkit,
      'createInventory',
      '(Lorg/bukkit/inventory/InventoryHolder;ILnet/kyori/adventure/text/Component;)Lorg/bukkit/inventory/Inventory;',
      null,
      menu.rows * 9,
      await component(menu.title),
    );
    for (const definition of menu.slots)
      await callExact(
        inventory,
        'setItem',
        '(ILorg/bukkit/inventory/ItemStack;)V',
        definition.slot,
        await this.createItem(definition, `menu:${id}`),
      );
    const playerId = await playerUniqueId(current);
    this.#menuSessions.set(playerId, { inventory, menu });
    await call(current, 'openInventory', inventory);
  }

  private async executeAction(
    current: Ref<'org.bukkit.entity.Player'>,
    action: LobbyAction,
  ): Promise<void> {
    if (action.type === 'none') return;
    if (action.type === 'spawn') return this.teleportToSpawn(current);
    if (action.type === 'menu' && action.target !== undefined)
      return this.openMenu(current, action.target);
    if (action.type === 'visibility')
      return this.setVisibility(current, (action.target ?? 'all') as Visibility | 'cycle');
    if (action.type === 'connect' && action.target !== undefined)
      return this.connect(current, action.target);
    if (action.type === 'sound' && action.target !== undefined) {
      const sound = this.soundAsset(action.target);
      await callExact(
        current,
        'playSound',
        '(Lorg/bukkit/Location;Lorg/bukkit/Sound;FF)V',
        await call(current, 'getLocation'),
        await constant('org.bukkit.Sound', String(sound['sound'])),
        Number(sound['volume']),
        Number(sound['pitch']),
      );
      return;
    }
    if (action.type === 'title' && action.target !== undefined) {
      const asset = this.titleAsset(action.target);
      const title = await staticExact<PaperHandle>(
        paperJava.resolve(JAVA_TYPES['net.kyori.adventure.title.Title']),
        'title',
        '(Lnet/kyori/adventure/text/Component;Lnet/kyori/adventure/text/Component;III)Lnet/kyori/adventure/title/Title;',
        await component(String(asset['title'])),
        await component(String(asset['subtitle'])),
        Number(asset['fade-in-ticks']),
        Number(asset['stay-ticks']),
        Number(asset['fade-out-ticks']),
      );
      await callExact(current, 'showTitle', '(Lnet/kyori/adventure/title/Title;)V', title);
      return;
    }
    if (action.type === 'particle' && action.target !== undefined) {
      const asset = this.particleAsset(action.target);
      await callExact(
        current,
        'spawnParticle',
        '(Lorg/bukkit/Particle;Lorg/bukkit/Location;IDDDD)V',
        await constant('org.bukkit.Particle', String(asset['particle'])),
        await call<Ref<'org.bukkit.Location'>>(current, 'getLocation'),
        Number(asset['count']),
        Number(asset['offset-x']),
        Number(asset['offset-y']),
        Number(asset['offset-z']),
        Number(asset['speed']),
      );
    }
  }

  private async connect(current: Ref<'org.bukkit.entity.Player'>, id: string): Promise<void> {
    const server = this.configuration.servers.find(
      (candidate) => candidate.id === id && candidate.enabled,
    );
    if (server === undefined) throw new RangeError(`No existe el servidor ${id}.`);
    const playerId = await playerUniqueId(current);
    const now = Date.now();
    if ((this.#transferCooldowns.get(playerId) ?? 0) > now) return;
    this.#transferCooldowns.set(
      playerId,
      now + this.configuration.settings.transfers['cooldown-ms'],
    );
    await call(current, 'sendPluginMessage', plugin, 'BungeeCord', connectPayload(server.target));
  }

  private async deferPlayer(
    current: Ref<'org.bukkit.entity.Player'>,
    action: () => Promise<void>,
  ): Promise<void> {
    if (this.#closed || this.#reloading) return;
    const revision = this.#revision;
    const scheduler = await call<PaperHandle>(current, 'getScheduler');
    let task: PaperHandle | null = null;
    const callback = (): void => {
      runOutsidePaperFrame(() => {
        this.startDetached(
          'Deferred player action',
          async () => {
            if (!this.#closed && revision === this.#revision) await action();
          },
          async () => {
            if (task !== null) {
              this.#deferredTasks.delete(task);
              await task.$release();
            }
          },
        );
      });
    };
    task = await callExact<PaperHandle | null>(
      scheduler,
      'run',
      '(Lorg/bukkit/plugin/Plugin;Ljava/util/function/Consumer;Ljava/lang/Runnable;)Lio/papermc/paper/threadedregions/scheduler/ScheduledTask;',
      plugin,
      callback,
      null,
    );
    if (task !== null) this.#deferredTasks.add(task);
  }

  private startDetached(
    label: string,
    action: () => Promise<void>,
    complete: () => void | Promise<void> = () => undefined,
  ): void {
    const tracked = Promise.resolve()
      .then(action)
      .catch((error: unknown) => this.reportDetachedFailure(`${label} failed.`, error))
      .then(complete)
      .catch((error: unknown) => this.reportDetachedFailure(`${label} cleanup failed.`, error));
    this.#pendingActions.add(tracked);
    void tracked.then(() => this.#pendingActions.delete(tracked));
  }

  private async reportDetachedFailure(message: string, error: unknown): Promise<void> {
    if (this.#closed) return;
    try {
      if ((await paperJava.describe())['platformEnabled'] === false) return;
    } catch {
      return;
    }
    console.error(`[ShaLobby] ${message}`, error);
  }

  private async awaitPendingActions(): Promise<void> {
    while (this.#pendingActions.size > 0) await Promise.allSettled([...this.#pendingActions]);
  }

  private async stopTasks(): Promise<void> {
    const tasks = this.#tasks.splice(0);
    const results = await Promise.allSettled(
      tasks.map(async (task) => {
        try {
          await call(task, 'cancel');
        } finally {
          await task.$release();
        }
      }),
    );
    const failures: unknown[] = [];
    for (const result of results) if (result.status === 'rejected') failures.push(result.reason);
    if (failures.length > 0) throw new AggregateError(failures, 'Unable to stop lobby tasks.');
  }

  private async stopDeferredTasks(): Promise<void> {
    const tasks = [...this.#deferredTasks];
    this.#deferredTasks.clear();
    await Promise.allSettled(
      tasks.map(async (task) => {
        try {
          await call(task, 'cancel');
        } finally {
          await task.$release();
        }
      }),
    );
  }

  private async setVisibility(
    current: Ref<'org.bukkit.entity.Player'>,
    requested: Visibility | 'cycle',
  ): Promise<void> {
    const id = await playerUniqueId(current);
    const previous = this.#visibility.get(id) ?? this.configuration.settings.visibility.default;
    const mode =
      requested === 'cycle'
        ? previous === 'all'
          ? 'staff'
          : previous === 'staff'
            ? 'none'
            : 'all'
        : requested;
    this.#visibility.set(id, mode);
    await this.applyVisibility(current);
    await this.updateSidebar(current);
  }

  private async applyVisibility(current: Ref<'org.bukkit.entity.Player'>): Promise<void> {
    const id = await playerUniqueId(current);
    const mode = this.#visibility.get(id) ?? this.configuration.settings.visibility.default;
    for (const other of await onlinePlayers()) {
      if (paperJava.same(current, other)) continue;
      const visible =
        mode === 'all' ||
        (mode === 'staff' &&
          (await call<boolean>(
            other,
            'hasPermission',
            this.configuration.settings.visibility['staff-permission'],
          )));
      await call(current, visible ? 'showPlayer' : 'hidePlayer', plugin, other);
    }
  }

  private async teleportToSpawn(current: Ref<'org.bukkit.entity.Player'>): Promise<void> {
    if (!this.configuration.spawn.configured)
      throw new Error('El punto de aparición no está configurado.');
    await call(current, 'teleportAsync', await this.spawnLocation());
  }

  private async spawnLocation(): Promise<Ref<'org.bukkit.Location'>> {
    const spawn = this.configuration.spawn;
    const world = await staticExact<Ref<'org.bukkit.World'> | null>(
      Bukkit,
      'getWorld',
      '(Ljava/lang/String;)Lorg/bukkit/World;',
      spawn.world,
    );
    if (world === null) throw new Error(`El mundo ${String(spawn.world)} no está cargado.`);
    return construct(
      'org.bukkit.Location',
      '(Lorg/bukkit/World;DDDFF)V',
      world,
      spawn.x,
      spawn.y,
      spawn.z,
      spawn.yaw ?? 0,
      spawn.pitch ?? 0,
    );
  }

  private async capturePortalPosition(
    current: Ref<'org.bukkit.entity.Player'>,
    kind: 'portal-pos1' | 'portal-pos2',
    selected?: Ref<'org.bukkit.Location'>,
  ): Promise<ManagedLobbyResult> {
    const id = await playerUniqueId(current);
    const location = selected ?? (await call<Ref<'org.bukkit.Location'>>(current, 'getLocation'));
    const world = await call<Ref<'org.bukkit.World'>>(location, 'getWorld');
    const position: Position = {
      world: await call<string>(world, 'getName'),
      x: await call<number>(location, 'getBlockX'),
      y: await call<number>(location, 'getBlockY'),
      z: await call<number>(location, 'getBlockZ'),
    };
    const selection = this.#portalSelections.get(id) ?? {};
    if (kind === 'portal-pos1') selection.first = position;
    else selection.second = position;
    this.#portalSelections.set(id, selection);
    return {
      ok: true,
      state: kind,
      position: data(position),
      message: `Posición guardada en ${position.world}.`,
    };
  }

  private portal(id: string): LobbyPortal {
    const result = this.configuration.portals.find((portal) => portal.id === id);
    if (result === undefined) throw new RangeError(`No existe el portal ${id}.`);
    return result;
  }

  private async portalAt(location: Ref<'org.bukkit.Location'>): Promise<LobbyPortal | undefined> {
    const world = await call<Ref<'org.bukkit.World'>>(location, 'getWorld');
    const name = await call<string>(world, 'getName');
    const x = await call<number>(location, 'getX');
    const y = await call<number>(location, 'getY');
    const z = await call<number>(location, 'getZ');
    return this.configuration.portals
      .filter(
        (portal) =>
          portal.enabled &&
          portal.world === name &&
          x >= portal.min.x &&
          x <= portal.max.x &&
          y >= portal.min.y &&
          y <= portal.max.y &&
          z >= portal.min.z &&
          z <= portal.max.z,
      )
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))[0];
  }

  private async applyWorldSettings(): Promise<void> {
    for (const settings of this.configuration.settings.worlds) {
      const world = await staticExact<Ref<'org.bukkit.World'> | null>(
        Bukkit,
        'getWorld',
        '(Ljava/lang/String;)Lorg/bukkit/World;',
        settings.name,
      );
      if (world === null) continue;
      try {
        await call(world, 'setTime', settings.time);
        await call(world, 'setStorm', settings.storm);
        await call(world, 'setThundering', settings.thundering);
        for (const [name, value] of Object.entries(settings['game-rules'])) {
          const rule = await gameRule(name);
          try {
            await call(world, 'setGameRule', rule, value);
          } finally {
            await rule.$release();
          }
        }
      } finally {
        await world.$release();
      }
    }
  }

  private async captureWorldSettings(
    configuration: LobbyConfiguration,
  ): Promise<readonly WorldSettingsSnapshot[]> {
    const snapshots: WorldSettingsSnapshot[] = [];
    for (const settings of configuration.settings.worlds) {
      const world = await staticExact<Ref<'org.bukkit.World'> | null>(
        Bukkit,
        'getWorld',
        '(Ljava/lang/String;)Lorg/bukkit/World;',
        settings.name,
      );
      if (world === null) continue;
      const gameRules: { name: string; value: boolean | number }[] = [];
      for (const name of Object.keys(settings['game-rules'])) {
        const rule = await gameRule(name);
        try {
          const value = await call(world, 'getGameRuleValue', rule);
          if (typeof value === 'boolean' || typeof value === 'number')
            gameRules.push({ name, value });
        } finally {
          await rule.$release();
        }
      }
      snapshots.push({
        gameRules,
        name: settings.name,
        storm: await call<boolean>(world, 'hasStorm'),
        thundering: await call<boolean>(world, 'isThundering'),
        time: await call<number>(world, 'getTime'),
      });
      await world.$release();
    }
    return snapshots;
  }

  private async restoreWorldSettings(snapshots: readonly WorldSettingsSnapshot[]): Promise<void> {
    const failures: unknown[] = [];
    for (const snapshot of snapshots) {
      let world: Ref<'org.bukkit.World'> | null;
      try {
        world = await staticExact<Ref<'org.bukkit.World'> | null>(
          Bukkit,
          'getWorld',
          '(Ljava/lang/String;)Lorg/bukkit/World;',
          snapshot.name,
        );
      } catch (error: unknown) {
        failures.push(error);
        continue;
      }
      if (world === null) continue;
      for (const [name, value] of [
        ['setTime', snapshot.time],
        ['setStorm', snapshot.storm],
        ['setThundering', snapshot.thundering],
      ] as const)
        try {
          await call(world, name, value);
        } catch (error: unknown) {
          failures.push(error);
        }
      for (const { name, value } of snapshot.gameRules) {
        try {
          const rule = await gameRule(name);
          try {
            await call(world, 'setGameRule', rule, value);
          } finally {
            await rule.$release();
          }
        } catch (error: unknown) {
          failures.push(error);
        }
      }
      try {
        await world.$release();
      } catch (error: unknown) {
        failures.push(error);
      }
    }
    if (failures.length > 0)
      throw new AggregateError(failures, 'One or more world settings could not be restored.');
  }

  private async preflight(candidate: LobbyConfiguration): Promise<void> {
    new MessageCatalog().replace(candidate.messagesContent);
    const texts = [
      ...candidate.items.flatMap((item) => [item.name, ...item.lore]),
      ...candidate.menus.flatMap((menu) => [
        menu.title,
        ...menu.slots.flatMap((item) => [item.name, ...item.lore]),
      ]),
      ...candidate.sidebar['title-frames'],
      ...candidate.sidebar.lines,
      ...candidate.servers.map((server) => server['display-name']),
    ];
    for (const value of texts) await (await component(value)).$release();
    for (const matched of candidate.messagesContent.matchAll(
      / {4}(?:title|subtitle): ['"](.*?)['"]$/gmu,
    ))
      await (await component(matched[1] ?? '')).$release();
    const materials = new Set([
      ...candidate.items.map((item) => item.material),
      ...candidate.menus.flatMap((menu) => menu.slots.map((item) => item.material)),
      'BLAZE_ROD',
    ]);
    for (const material of materials) await constant('org.bukkit.Material', material);
    for (const matched of candidate.messagesContent.matchAll(/^ {4}sound: ([A-Z0-9_]+)$/gmu))
      await (await constant('org.bukkit.Sound', matched[1] ?? '')).$release();
    for (const matched of candidate.messagesContent.matchAll(/^ {4}particle: ([A-Z0-9_]+)$/gmu))
      await constant('org.bukkit.Particle', matched[1] ?? '');
    for (const settings of candidate.settings.worlds) {
      const world = await staticExact<Ref<'org.bukkit.World'> | null>(
        Bukkit,
        'getWorld',
        '(Ljava/lang/String;)Lorg/bukkit/World;',
        settings.name,
      );
      if (world === null) throw new Error(`El mundo ${settings.name} no está cargado.`);
      await world.$release();
      for (const name of Object.keys(settings['game-rules'])) {
        try {
          await (await gameRule(name)).$release();
        } catch (cause: unknown) {
          throw new Error(`La regla de juego ${name} no existe.`, { cause });
        }
      }
    }
  }

  private async registerMessaging(): Promise<void> {
    const messenger = await staticExact<PaperHandle>(
      Bukkit,
      'getMessenger',
      '()Lorg/bukkit/plugin/messaging/Messenger;',
    );
    await registerOutgoingPluginChannel(messenger, 'BungeeCord');
    await messenger.$release();
  }

  private async restartTasks(): Promise<void> {
    const scheduler = await staticExact<PaperHandle>(
      Bukkit,
      'getGlobalRegionScheduler',
      '()Lio/papermc/paper/threadedregions/scheduler/GlobalRegionScheduler;',
    );
    const sidebarTask = await callExact<PaperHandle>(
      scheduler,
      'runAtFixedRate',
      '(Lorg/bukkit/plugin/Plugin;Ljava/util/function/Consumer;JJ)Lio/papermc/paper/threadedregions/scheduler/ScheduledTask;',
      plugin,
      () => {
        runOutsidePaperFrame(() => {
          if (this.#closed || this.#reloading || this.#sidebarRefreshActive) return;
          this.#sidebarRefreshActive = true;
          this.startDetached(
            'Sidebar refresh',
            () => this.refreshSidebars(),
            () => {
              this.#sidebarRefreshActive = false;
            },
          );
        });
      },
      1,
      Math.max(1, this.configuration.sidebar['interval-ticks']),
    );
    let enforcementTask: PaperHandle;
    try {
      enforcementTask = await callExact<PaperHandle>(
        scheduler,
        'runAtFixedRate',
        '(Lorg/bukkit/plugin/Plugin;Ljava/util/function/Consumer;JJ)Lio/papermc/paper/threadedregions/scheduler/ScheduledTask;',
        plugin,
        () => {
          runOutsidePaperFrame(() => {
            if (this.#closed || this.#reloading || this.#enforcementActive) return;
            this.#enforcementActive = true;
            this.startDetached(
              'Policy enforcement',
              () => this.enforceLobby(),
              () => {
                this.#enforcementActive = false;
              },
            );
          });
        },
        1,
        Math.max(1, this.configuration.settings['enforcement-ticks']),
      );
    } catch (error) {
      await call(sidebarTask, 'cancel');
      await sidebarTask.$release();
      throw error;
    }
    this.#tasks = [sidebarTask, enforcementTask];
  }

  private async refreshSidebars(): Promise<void> {
    if (this.#closed) return;
    const online = await onlinePlayers();
    for (const current of online) {
      if (await this.isManagedPlayer(current)) await this.updateSidebar(current, online.length);
      else {
        const id = await playerUniqueId(current);
        if (this.#sidebarSessions.has(id)) await this.leaveManagedPlayer(current);
      }
    }
  }

  private async enforceLobby(): Promise<void> {
    if (this.#closed) return;
    await this.applyWorldSettings();
    const online = await onlinePlayers();
    for (const current of online) {
      const id = await playerUniqueId(current);
      if (await this.isManagedPlayer(current)) {
        if (!this.#initializedPlayers.has(id)) {
          await this.initializeJoinedPlayer(current);
          this.#initializedPlayers.add(id);
          continue;
        }
        await this.giveItems(current);
        await this.applyVisibility(current);
        await this.visualizePortals(current);
      } else if (!this.#initializedPlayers.has(id)) {
        await this.removeManagedItems(current);
        for (const other of online)
          if (!paperJava.same(current, other)) await call(current, 'showPlayer', plugin, other);
        this.#initializedPlayers.add(id);
      }
    }
  }

  private async updateSidebar(
    current: Ref<'org.bukkit.entity.Player'>,
    onlineCount?: number,
  ): Promise<void> {
    const id = await playerUniqueId(current);
    if (!this.configuration.sidebar.enabled) {
      const existing = this.#sidebarSessions.get(id);
      if (existing !== undefined) {
        const manager = await staticExact<PaperHandle>(
          Bukkit,
          'getScoreboardManager',
          '()Lorg/bukkit/scoreboard/ScoreboardManager;',
        );
        await call(current, 'setScoreboard', await call<PaperHandle>(manager, 'getMainScoreboard'));
        await this.releaseSidebar(existing);
        this.#sidebarSessions.delete(id);
      }
      return;
    }
    let session = this.#sidebarSessions.get(id);
    if (session === undefined) {
      session = await this.createSidebar(current);
      this.#sidebarSessions.set(id, session);
    } else {
      const assigned = await call<PaperHandle>(current, 'getScoreboard');
      if (!paperJava.same(assigned, session.scoreboard))
        await call(current, 'setScoreboard', session.scoreboard);
      await assigned.$release();
    }
    const frame =
      Math.floor(Date.now() / 1_000) % this.configuration.sidebar['title-frames'].length;
    await call(
      session.objective,
      'displayName',
      await component(this.configuration.sidebar['title-frames'][frame] ?? 'ShaLobby'),
    );
    const location = await call<Ref<'org.bukkit.Location'>>(current, 'getLocation');
    const world = await call<Ref<'org.bukkit.World'>>(location, 'getWorld');
    const replacements: Record<string, string | number> = {
      player: await call<string>(current, 'getName'),
      online: onlineCount ?? (await onlinePlayers()).length,
      world: await call<string>(world, 'getName'),
      x: await call<number>(location, 'getBlockX'),
      y: await call<number>(location, 'getBlockY'),
      z: await call<number>(location, 'getBlockZ'),
      ping: await call<number>(current, 'getPing'),
      visibility: this.#visibility.get(id) ?? this.configuration.settings.visibility.default,
    };
    await Promise.all(
      session.teams.map(async (team, index) =>
        call(
          team,
          'prefix',
          await component(message(this.configuration.sidebar.lines[index] ?? '', replacements)),
        ),
      ),
    );
  }

  private async createSidebar(current: Ref<'org.bukkit.entity.Player'>): Promise<SidebarSession> {
    const manager = await staticExact<PaperHandle>(
      Bukkit,
      'getScoreboardManager',
      '()Lorg/bukkit/scoreboard/ScoreboardManager;',
    );
    const scoreboard = await call<PaperHandle>(manager, 'getNewScoreboard');
    const objective = await callExact<PaperHandle>(
      scoreboard,
      'registerNewObjective',
      '(Ljava/lang/String;Ljava/lang/String;Lnet/kyori/adventure/text/Component;)Lorg/bukkit/scoreboard/Objective;',
      'shalobby',
      'dummy',
      await component('ShaLobby'),
    );
    await call(
      objective,
      'setDisplaySlot',
      await constant('org.bukkit.scoreboard.DisplaySlot', DISPLAY_SLOT),
    );
    const teams: PaperHandle[] = [];
    const entries = '0123456789abcdef';
    for (const [index] of this.configuration.sidebar.lines.entries()) {
      const entry = `§${entries[index] ?? 'r'}`;
      const team = await call<PaperHandle>(scoreboard, 'registerNewTeam', `line${String(index)}`);
      await call(team, 'addEntry', entry);
      const score = await call<PaperHandle>(objective, 'getScore', entry);
      await call(score, 'setScore', this.configuration.sidebar.lines.length - index);
      await score.$release();
      teams.push(team);
    }
    await call(current, 'setScoreboard', scoreboard);
    return { scoreboard, objective, teams };
  }

  private async releaseSidebar(session: SidebarSession): Promise<void> {
    for (const team of session.teams) await team.$release();
    await session.objective.$release();
    await session.scoreboard.$release();
  }

  private async resetPresentation(
    online: readonly Ref<'org.bukkit.entity.Player'>[],
  ): Promise<void> {
    const manager = await staticExact<PaperHandle>(
      Bukkit,
      'getScoreboardManager',
      '()Lorg/bukkit/scoreboard/ScoreboardManager;',
    );
    const main = await call<PaperHandle>(manager, 'getMainScoreboard');
    const failures: unknown[] = [];
    for (const current of online) {
      try {
        const id = await playerUniqueId(current);
        const sidebar = this.#sidebarSessions.get(id);
        if (sidebar !== undefined) {
          this.#sidebarSessions.delete(id);
          await call(current, 'setScoreboard', main);
          await this.releaseSidebar(sidebar);
        }
        const menu = this.#menuSessions.get(id);
        if (menu !== undefined) {
          this.#menuSessions.delete(id);
          await call(current, 'closeInventory');
          await menu.inventory.$release();
        }
      } catch (error: unknown) {
        failures.push(error);
      }
    }
    this.#sidebarSessions.clear();
    this.#menuSessions.clear();
    try {
      await main.$release();
    } catch (error: unknown) {
      failures.push(error);
    }
    try {
      await manager.$release();
    } catch (error: unknown) {
      failures.push(error);
    }
    if (failures.length > 0)
      throw new AggregateError(failures, 'One or more lobby presentations could not be reset.');
  }

  private message(key: string): string {
    const root = this.configuration.messagesContent;
    const matched = new RegExp(`^  ${key}: ['"]?(.*?)['"]?$`, 'mu').exec(root);
    return matched?.[1] ?? key;
  }

  private soundAsset(id: string): Record<string, unknown> {
    const parsed = this.configuration.messagesContent;
    const sound = new RegExp(
      `  - id: ${id}\\n    sound: ([A-Z0-9_]+)\\n    volume: ([0-9.]+)\\n    pitch: ([0-9.]+)`,
      'u',
    ).exec(parsed);
    if (sound !== null)
      return { sound: sound[1], volume: Number(sound[2]), pitch: Number(sound[3]) };
    throw new RangeError(`No existe el recurso sounds.${id}.`);
  }

  private titleAsset(id: string): Record<string, unknown> {
    const title = new RegExp(
      `  - id: ${id}\\n    title: ['"](.*?)['"]\\n    subtitle: ['"](.*?)['"]\\n    fade-in-ticks: ([0-9]+)\\n    stay-ticks: ([0-9]+)\\n    fade-out-ticks: ([0-9]+)`,
      'u',
    ).exec(this.configuration.messagesContent);
    if (title !== null)
      return {
        title: title[1],
        subtitle: title[2],
        'fade-in-ticks': Number(title[3]),
        'stay-ticks': Number(title[4]),
        'fade-out-ticks': Number(title[5]),
      };
    throw new RangeError(`No existe el recurso titles.${id}.`);
  }

  private particleAsset(id: string): Record<string, unknown> {
    const particle = new RegExp(
      `  - id: ${id}\\n    particle: ([A-Z0-9_]+)\\n    count: ([0-9]+)\\n    offset-x: ([0-9.]+)\\n    offset-y: ([0-9.]+)\\n    offset-z: ([0-9.]+)\\n    speed: ([0-9.]+)`,
      'u',
    ).exec(this.configuration.messagesContent);
    if (particle !== null)
      return {
        particle: particle[1],
        count: Number(particle[2]),
        'offset-x': Number(particle[3]),
        'offset-y': Number(particle[4]),
        'offset-z': Number(particle[5]),
        speed: Number(particle[6]),
      };
    throw new RangeError(`No existe el recurso particles.${id}.`);
  }

  private enumName(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value !== null && typeof value === 'object') {
      const name: unknown = Reflect.get(value, 'name');
      if (typeof name === 'string') return name;
    }
    throw new TypeError('Paper returned an invalid enum value.');
  }

  private async isManagedPlayer(current: Ref<'org.bukkit.entity.Player'>): Promise<boolean> {
    return this.isManagedWorld(await call<PaperHandle>(current, 'getWorld'));
  }

  private async isManagedLocation(location: Ref<'org.bukkit.Location'>): Promise<boolean> {
    const world = await call<PaperHandle | null>(location, 'getWorld');
    return world !== null && this.isManagedWorld(world);
  }

  private async isManagedWorld(world: PaperHandle): Promise<boolean> {
    const name = await call<string>(world, 'getName');
    return this.configuration.settings.worlds.some((settings) => settings.name === name);
  }

  private async visualizePortals(current: Ref<'org.bukkit.entity.Player'>): Promise<void> {
    const id = await playerUniqueId(current);
    const world = await call<PaperHandle>(current, 'getWorld');
    const worldName = await call<string>(world, 'getName');
    const portals = this.configuration.portals.filter(
      (portal) =>
        portal.world === worldName &&
        portal.enabled &&
        (portal.visualize || this.#visualizers.has(id)),
    );
    if (portals.length === 0) return;
    const particle = await constant('org.bukkit.Particle', 'END_ROD');
    for (const portal of portals)
      for (const x of [portal.min.x, portal.max.x])
        for (const y of [portal.min.y, portal.max.y])
          for (const z of [portal.min.z, portal.max.z])
            await callExact(
              current,
              'spawnParticle',
              '(Lorg/bukkit/Particle;DDDI)V',
              particle,
              x,
              y,
              z,
              1,
            );
  }
}

export const shaLobbyRuntime = new ShaLobbyRuntime();
