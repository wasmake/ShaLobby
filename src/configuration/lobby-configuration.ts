import type { LobbyItem } from './items.js';
import type { LobbyMenu } from './menus.js';
import type { LobbyMessageResources } from './message-resources.js';
import type { LobbyPortal } from './portals.js';
import type { LobbyPresentation, LobbySidebar } from './presentation.js';
import type { LobbyServer } from './servers.js';
import type { LobbySettings } from './settings.js';
import type { LobbySpawn } from './spawn.js';

export interface LobbyConfiguration {
  readonly settings: LobbySettings;
  readonly messagesContent: string;
  readonly messageResources: LobbyMessageResources;
  readonly items: readonly LobbyItem[];
  readonly menus: readonly LobbyMenu[];
  readonly sidebar: LobbySidebar;
  readonly presentation: LobbyPresentation;
  readonly servers: readonly LobbyServer[];
  readonly spawn: LobbySpawn;
  readonly portals: LobbyPortal[];
}
