export const LOBBY_FILES = Object.freeze([
  'config.yml',
  'messages.yml',
  'items.yml',
  'menus.yml',
  'scoreboard.yml',
  'servers.yml',
  'spawn.yml',
  'portals.yml',
] as const);

export type LobbyFile = (typeof LOBBY_FILES)[number];
