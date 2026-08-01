import type { LobbyAction } from './actions.js';

export interface LobbyItem {
  readonly id?: string;
  readonly slot: number;
  readonly material: string;
  readonly amount: number;
  readonly name: string;
  readonly lore: readonly string[];
  readonly 'cooldown-ms'?: number;
  readonly action: LobbyAction;
}
