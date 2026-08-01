import type { Visibility } from './settings.js';

export type LobbyAction =
  | { readonly type: 'none' }
  | { readonly type: 'spawn' }
  | {
      readonly type: 'connect' | 'menu' | 'title' | 'sound' | 'particle';
      readonly target: string;
    }
  | { readonly type: 'visibility'; readonly target?: Visibility | 'cycle' };
