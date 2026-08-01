export interface LobbyTitleAsset {
  readonly title: string;
  readonly subtitle: string;
  readonly 'fade-in-ticks': number;
  readonly 'stay-ticks': number;
  readonly 'fade-out-ticks': number;
}

export interface LobbySoundAsset {
  readonly sound: string;
  readonly volume: number;
  readonly pitch: number;
}

export interface LobbyParticleAsset {
  readonly particle: string;
  readonly count: number;
  readonly 'offset-x': number;
  readonly 'offset-y': number;
  readonly 'offset-z': number;
  readonly speed: number;
}

export interface LobbyMessageResources {
  readonly messages: Readonly<Record<string, string>>;
  readonly titles: Readonly<Record<string, LobbyTitleAsset>>;
  readonly sounds: Readonly<Record<string, LobbySoundAsset>>;
  readonly particles: Readonly<Record<string, LobbyParticleAsset>>;
}
