export interface LobbySidebar {
  readonly enabled: boolean;
  readonly 'interval-ticks': number;
  readonly 'title-frames': readonly string[];
  readonly lines: readonly string[];
}

export interface LobbyPresentation {
  readonly bossbar: {
    readonly enabled: boolean;
    readonly color: 'BLUE' | 'GREEN' | 'PINK' | 'PURPLE' | 'RED' | 'WHITE' | 'YELLOW';
    readonly overlay: 'PROGRESS' | 'NOTCHED_6' | 'NOTCHED_10' | 'NOTCHED_12' | 'NOTCHED_20';
    readonly progress: number;
    readonly 'frame-ticks': number;
    readonly 'last-frame-ticks': number;
    readonly 'title-frames': readonly string[];
  };
  readonly 'player-list': {
    readonly enabled: boolean;
    readonly header: string;
    readonly footer: string;
  };
}
