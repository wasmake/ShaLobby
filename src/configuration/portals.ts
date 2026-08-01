import type { LobbyAction } from './actions.js';

export interface LobbyPortal {
  readonly id: string;
  enabled: boolean;
  readonly world: string;
  readonly min: { readonly x: number; readonly y: number; readonly z: number };
  readonly max: { readonly x: number; readonly y: number; readonly z: number };
  readonly permission?: string;
  readonly priority: number;
  readonly 'cooldown-ms': number;
  destination?: string;
  action: LobbyAction;
  readonly visualize: boolean;
}
