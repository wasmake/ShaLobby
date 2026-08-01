export interface LobbyServer {
  readonly id: string;
  readonly enabled: boolean;
  readonly target: string;
  readonly 'display-name': string;
}
