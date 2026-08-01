import type { LobbyItem } from './items.js';

export type LobbyMenuFiller = Omit<LobbyItem, 'action' | 'slot'>;

export interface LobbyMenu {
  readonly id: string;
  readonly rows: number;
  readonly title: string;
  readonly filler?: LobbyMenuFiller;
  readonly slots: readonly LobbyItem[];
}
