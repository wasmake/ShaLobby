export type Visibility = 'all' | 'staff' | 'none';

export interface LobbySettings {
  readonly join: {
    readonly 'suppress-message': boolean;
    readonly teleport: boolean;
    readonly reset: boolean;
    readonly 'welcome-title': string;
    readonly 'welcome-sound': string;
    readonly 'welcome-particle': string;
    readonly 'welcome-message': string;
  };
  readonly 'void-rescue-y': number;
  readonly protection: { readonly enabled: boolean; readonly 'bypass-permission': string };
  readonly 'portal-cooldown-ms': number;
  readonly 'enforcement-ticks': number;
  readonly worlds: readonly {
    readonly name: string;
    readonly time: number;
    readonly storm: boolean;
    readonly thundering: boolean;
    readonly 'game-rules': Readonly<Record<string, boolean | number>>;
  }[];
  readonly visibility: { readonly default: Visibility; readonly 'staff-permission': string };
  readonly transfers: { readonly 'cooldown-ms': number };
}
