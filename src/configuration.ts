import { pluginFiles } from '@shamoo/config';
import { parse, stringify } from 'yaml';

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

export interface LobbyAction {
  readonly type:
    | 'none'
    | 'spawn'
    | 'connect'
    | 'menu'
    | 'visibility'
    | 'title'
    | 'sound'
    | 'particle';
  readonly target?: string;
}

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

export interface LobbyMenu {
  readonly id: string;
  readonly rows: number;
  readonly title: string;
  readonly slots: readonly LobbyItem[];
}

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

export interface LobbySpawn {
  configured: boolean;
  world?: string;
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  pitch?: number;
}

export interface LobbyServer {
  readonly id: string;
  readonly enabled: boolean;
  readonly target: string;
  readonly 'display-name': string;
}

export interface LobbySidebar {
  readonly enabled: boolean;
  readonly 'interval-ticks': number;
  readonly 'title-frames': readonly string[];
  readonly lines: readonly string[];
}

export interface LobbyPresentation {
  readonly 'interval-ticks': number;
  readonly bossbar: {
    readonly enabled: boolean;
    readonly color: 'BLUE' | 'GREEN' | 'PINK' | 'PURPLE' | 'RED' | 'WHITE' | 'YELLOW';
    readonly overlay: 'PROGRESS' | 'NOTCHED_6' | 'NOTCHED_10' | 'NOTCHED_12' | 'NOTCHED_20';
    readonly progress: number;
    readonly 'title-frames': readonly string[];
  };
  readonly 'player-list': {
    readonly enabled: boolean;
    readonly 'header-frames': readonly string[];
    readonly 'footer-frames': readonly string[];
  };
}

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

export type Visibility = 'all' | 'staff' | 'none';

export interface LobbyConfiguration {
  readonly settings: LobbySettings;
  readonly messagesContent: string;
  readonly items: readonly LobbyItem[];
  readonly menus: readonly LobbyMenu[];
  readonly sidebar: LobbySidebar;
  readonly presentation: LobbyPresentation;
  readonly servers: readonly LobbyServer[];
  readonly spawn: LobbySpawn;
  readonly portals: LobbyPortal[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value;
}

function parsed(content: string, label: string): Record<string, unknown> {
  return record(
    parse(content, {
      logLevel: 'silent',
      maxAliasCount: 16,
      merge: false,
      prettyErrors: false,
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
      version: '1.2',
    }),
    label,
  );
}

function keys(
  value: Record<string, unknown>,
  label: string,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional]);
  for (const name of required)
    if (!(name in value)) throw new TypeError(`${label}.${name} is required.`);
  for (const name of Object.keys(value))
    if (!allowed.has(name)) throw new TypeError(`${label}.${name} is not supported.`);
}

function text(value: unknown, label: string, maximum = 4_096): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum)
    throw new TypeError(`${label} must be nonempty text.`);
  return value;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be boolean.`);
  return value;
}

function finite(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
    throw new TypeError(`${label} is outside its allowed range.`);
  return value;
}

function integer(value: unknown, label: string, minimum: number, maximum: number): number {
  const result = finite(value, label, minimum, maximum);
  if (!Number.isSafeInteger(result)) throw new TypeError(`${label} must be an integer.`);
  return result;
}

function validateAction(value: unknown, label: string): asserts value is LobbyAction {
  const action = record(value, label);
  keys(action, label, ['type'], ['target']);
  const type = text(action['type'], `${label}.type`, 32);
  const types = new Set([
    'none',
    'spawn',
    'connect',
    'menu',
    'visibility',
    'title',
    'sound',
    'particle',
  ]);
  if (!types.has(type)) throw new TypeError(`${label}.type is invalid.`);
  const target =
    action['target'] === undefined ? undefined : text(action['target'], `${label}.target`, 128);
  if (
    ['connect', 'menu', 'title', 'sound', 'particle'].includes(type) &&
    action['target'] === undefined
  )
    throw new TypeError(`${label}.target is required for ${type}.`);
  if (
    type === 'visibility' &&
    target !== undefined &&
    !['all', 'staff', 'none', 'cycle'].includes(target)
  )
    throw new TypeError(`${label}.target is not a visibility mode.`);
}

function validateIdentityList(values: readonly unknown[], label: string): void {
  if (values.length > 256) throw new TypeError(`${label} contains too many entries.`);
  const ids = new Set<string>();
  for (const [index, value] of values.entries()) {
    const item = record(value, `${label}[${String(index)}]`);
    if (typeof item['id'] !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/u.test(item['id']))
      throw new TypeError(`${label}[${String(index)}].id is invalid.`);
    if (ids.has(item['id'])) throw new TypeError(`${label} IDs must be unique.`);
    ids.add(item['id']);
  }
}

function validateItems(
  values: readonly unknown[],
  label: string,
  maximumSlot = 40,
): asserts values is readonly LobbyItem[] {
  if (values.length > 256) throw new TypeError(`${label} contains too many entries.`);
  const slots = new Set<number>();
  const ids = new Set<string>();
  for (const [index, value] of values.entries()) {
    const item = record(value, `${label}[${String(index)}]`);
    const itemLabel = `${label}[${String(index)}]`;
    keys(
      item,
      itemLabel,
      ['slot', 'material', 'amount', 'name', 'lore', 'action'],
      ['id', 'cooldown-ms'],
    );
    const slot = integer(item['slot'], `${itemLabel}.slot`, 0, maximumSlot);
    if (slots.has(slot)) throw new TypeError(`${label} slots must be unique.`);
    slots.add(slot);
    const material = text(item['material'], `${itemLabel}.material`, 128);
    if (!/^[A-Z][A-Z0-9_]{0,127}$/u.test(material))
      throw new TypeError(`${itemLabel}.material is invalid.`);
    text(item['name'], `${itemLabel}.name`);
    integer(item['amount'], `${itemLabel}.amount`, 1, 99);
    const lore = array(item['lore'], `${itemLabel}.lore`);
    if (lore.length > 64) throw new TypeError(`${itemLabel}.lore contains too many lines.`);
    lore.forEach((line, lineIndex) => text(line, `${itemLabel}.lore[${String(lineIndex)}]`));
    if (item['id'] !== undefined) {
      const id = text(item['id'], `${itemLabel}.id`, 64);
      if (!/^[a-z][a-z0-9_-]{0,63}$/u.test(id)) throw new TypeError(`${itemLabel}.id is invalid.`);
      if (ids.has(id)) throw new TypeError(`${label} IDs must be unique.`);
      ids.add(id);
    }
    if (item['cooldown-ms'] !== undefined)
      integer(item['cooldown-ms'], `${itemLabel}.cooldown-ms`, 0, 86_400_000);
    validateAction(item['action'], `${itemLabel}.action`);
  }
}

function validateSettings(value: Record<string, unknown>): void {
  keys(value, 'config.yml', [
    'join',
    'void-rescue-y',
    'protection',
    'portal-cooldown-ms',
    'enforcement-ticks',
    'worlds',
    'visibility',
    'transfers',
  ]);
  const join = record(value['join'], 'config.yml.join');
  keys(join, 'config.yml.join', [
    'suppress-message',
    'teleport',
    'reset',
    'welcome-title',
    'welcome-sound',
    'welcome-particle',
    'welcome-message',
  ]);
  bool(join['suppress-message'], 'config.yml.join.suppress-message');
  bool(join['teleport'], 'config.yml.join.teleport');
  bool(join['reset'], 'config.yml.join.reset');
  for (const name of ['welcome-title', 'welcome-sound', 'welcome-particle', 'welcome-message']) {
    const id = text(join[name], `config.yml.join.${name}`, 64);
    if (!/^[a-z][a-z0-9_-]{0,63}$/u.test(id))
      throw new TypeError(`config.yml.join.${name} is not a valid resource ID.`);
  }
  finite(value['void-rescue-y'], 'config.yml.void-rescue-y', -2_048, 2_048);
  integer(value['portal-cooldown-ms'], 'config.yml.portal-cooldown-ms', 0, 86_400_000);
  integer(value['enforcement-ticks'], 'config.yml.enforcement-ticks', 1, 1_728_000);
  const protection = record(value['protection'], 'config.yml.protection');
  keys(protection, 'config.yml.protection', ['enabled', 'bypass-permission']);
  bool(protection['enabled'], 'config.yml.protection.enabled');
  text(protection['bypass-permission'], 'config.yml.protection.bypass-permission', 128);
  const worlds = array(value['worlds'], 'config.yml.worlds');
  if (worlds.length === 0 || worlds.length > 64)
    throw new TypeError('config.yml.worlds must contain between 1 and 64 worlds.');
  const worldNames = new Set<string>();
  for (const [index, worldValue] of worlds.entries()) {
    const label = `config.yml.worlds[${String(index)}]`;
    const world = record(worldValue, label);
    keys(world, label, ['name', 'time', 'storm', 'thundering', 'game-rules']);
    const name = text(world['name'], `${label}.name`, 128);
    if (worldNames.has(name)) throw new TypeError('config.yml world names must be unique.');
    worldNames.add(name);
    integer(world['time'], `${label}.time`, 0, 24_000);
    bool(world['storm'], `${label}.storm`);
    bool(world['thundering'], `${label}.thundering`);
    const rules = record(world['game-rules'], `${label}.game-rules`);
    if (Object.keys(rules).length > 256) throw new TypeError(`${label}.game-rules is too large.`);
    for (const [rule, ruleValue] of Object.entries(rules)) {
      text(rule, `${label}.game-rules key`, 128);
      if (typeof ruleValue !== 'boolean' && !Number.isSafeInteger(ruleValue))
        throw new TypeError(`${label}.game-rules.${rule} must be boolean or integer.`);
    }
  }
  const visibility = record(value['visibility'], 'config.yml.visibility');
  keys(visibility, 'config.yml.visibility', ['default', 'staff-permission']);
  if (!['all', 'staff', 'none'].includes(String(visibility['default'])))
    throw new TypeError('config.yml.visibility.default is invalid.');
  text(visibility['staff-permission'], 'config.yml.visibility.staff-permission', 128);
  const transfers = record(value['transfers'], 'config.yml.transfers');
  keys(transfers, 'config.yml.transfers', ['cooldown-ms']);
  integer(transfers['cooldown-ms'], 'config.yml.transfers.cooldown-ms', 0, 86_400_000);
}

function validateSidebar(value: Record<string, unknown>): void {
  keys(value, 'scoreboard.yml.sidebar', ['enabled', 'interval-ticks', 'title-frames', 'lines']);
  const enabled = bool(value['enabled'], 'scoreboard.yml.sidebar.enabled');
  integer(value['interval-ticks'], 'scoreboard.yml.sidebar.interval-ticks', 1, 1_728_000);
  const titles = array(value['title-frames'], 'scoreboard.yml.sidebar.title-frames');
  if (titles.length === 0 || titles.length > 128)
    throw new TypeError('scoreboard.yml.sidebar.title-frames has an invalid size.');
  titles.forEach((title, index) => text(title, `scoreboard title ${String(index)}`));
  const lines = array(value['lines'], 'scoreboard.yml.sidebar.lines');
  if (enabled && lines.length === 0)
    throw new TypeError('scoreboard.yml.sidebar.lines cannot be empty while enabled.');
  if (lines.length > 15)
    throw new TypeError('scoreboard.yml.sidebar.lines cannot exceed 15 lines.');
  lines.forEach((line, index) => {
    if (typeof line !== 'string' || line.length > 4_096)
      throw new TypeError(`scoreboard line ${String(index)} must be text.`);
  });
}

const DEFAULT_PRESENTATION: LobbyPresentation = {
  'interval-ticks': 20,
  bossbar: {
    enabled: true,
    color: 'PURPLE',
    overlay: 'PROGRESS',
    progress: 1,
    'title-frames': [
      '<gradient:#38D9FF:#A855F7><bold>TIENDA SHALOBBY</bold></gradient> <#F8FAFC>Rangos, cosméticos y más</#F8FAFC>',
      '<#FFB347><bold>OFERTAS EXCLUSIVAS</bold></#FFB347> <#F8FAFC>Visita nuestra tienda</#F8FAFC>',
      '<#55FF88><bold>APOYA AL SERVIDOR</bold></#55FF88> <#F8FAFC>Descubre ventajas increíbles</#F8FAFC>',
    ],
  },
  'player-list': {
    enabled: true,
    'header-frames': [
      '<gradient:#38D9FF:#4F7CFF:#A855F7><bold>✦ SHALOBBY ✦</bold></gradient>\n<#A8B3C7>Bienvenido, <#F8FAFC>%player%</#F8FAFC></#A8B3C7>',
      '<gradient:#A855F7:#4F7CFF:#38D9FF><bold>◆ SHALOBBY ◆</bold></gradient>\n<#A8B3C7>Elige tu próxima aventura</#A8B3C7>',
    ],
    'footer-frames': [
      '<#A8B3C7>Jugadores en línea: <#F8FAFC>%online%</#F8FAFC></#A8B3C7>\n<#55FF88>¡Que disfrutes tu estancia!</#55FF88>',
      '<#FFB347>Visita la tienda y descubre nuestras ofertas</#FFB347>\n<#A8B3C7>Gracias por jugar en ShaLobby</#A8B3C7>',
    ],
  },
};

function validatePresentation(value: unknown): LobbyPresentation {
  if (value === undefined) return DEFAULT_PRESENTATION;
  const presentation = record(value, 'scoreboard.yml.presentation');
  keys(presentation, 'scoreboard.yml.presentation', ['interval-ticks', 'bossbar', 'player-list']);
  integer(
    presentation['interval-ticks'],
    'scoreboard.yml.presentation.interval-ticks',
    1,
    1_728_000,
  );
  const bossbar = record(presentation['bossbar'], 'scoreboard.yml.presentation.bossbar');
  keys(bossbar, 'scoreboard.yml.presentation.bossbar', [
    'enabled',
    'color',
    'overlay',
    'progress',
    'title-frames',
  ]);
  const bossbarEnabled = bool(bossbar['enabled'], 'scoreboard.yml.presentation.bossbar.enabled');
  if (
    !['BLUE', 'GREEN', 'PINK', 'PURPLE', 'RED', 'WHITE', 'YELLOW'].includes(
      String(bossbar['color']),
    )
  )
    throw new TypeError('scoreboard.yml.presentation.bossbar.color is invalid.');
  if (
    !['PROGRESS', 'NOTCHED_6', 'NOTCHED_10', 'NOTCHED_12', 'NOTCHED_20'].includes(
      String(bossbar['overlay']),
    )
  )
    throw new TypeError('scoreboard.yml.presentation.bossbar.overlay is invalid.');
  finite(bossbar['progress'], 'scoreboard.yml.presentation.bossbar.progress', 0, 1);
  const titleFrames = array(
    bossbar['title-frames'],
    'scoreboard.yml.presentation.bossbar.title-frames',
  );
  if ((bossbarEnabled && titleFrames.length === 0) || titleFrames.length > 128)
    throw new TypeError('scoreboard.yml.presentation.bossbar.title-frames has an invalid size.');
  titleFrames.forEach((frame, index) =>
    text(frame, `scoreboard.yml.presentation.bossbar.title-frames[${String(index)}]`),
  );
  const playerList = record(presentation['player-list'], 'scoreboard.yml.presentation.player-list');
  keys(playerList, 'scoreboard.yml.presentation.player-list', [
    'enabled',
    'header-frames',
    'footer-frames',
  ]);
  const playerListEnabled = bool(
    playerList['enabled'],
    'scoreboard.yml.presentation.player-list.enabled',
  );
  for (const field of ['header-frames', 'footer-frames'] as const) {
    const frames = array(playerList[field], `scoreboard.yml.presentation.player-list.${field}`);
    if ((playerListEnabled && frames.length === 0) || frames.length > 128)
      throw new TypeError(`scoreboard.yml.presentation.player-list.${field} has an invalid size.`);
    frames.forEach((frame, index) =>
      text(frame, `scoreboard.yml.presentation.player-list.${field}[${String(index)}]`),
    );
  }
  return presentation as unknown as LobbyPresentation;
}

function validateSpawn(value: Record<string, unknown>): void {
  keys(value, 'spawn.yml.spawn', ['configured'], ['world', 'x', 'y', 'z', 'yaw', 'pitch']);
  const configured = bool(value['configured'], 'spawn.yml.spawn.configured');
  if (!configured) return;
  text(value['world'], 'spawn.yml.spawn.world', 128);
  for (const coordinate of ['x', 'y', 'z'])
    finite(value[coordinate], `spawn.yml.spawn.${coordinate}`, -30_000_000, 30_000_000);
  finite(value['yaw'] ?? 0, 'spawn.yml.spawn.yaw', -360, 360);
  finite(value['pitch'] ?? 0, 'spawn.yml.spawn.pitch', -90, 90);
}

function validateReference(
  action: LobbyAction,
  label: string,
  menus: ReadonlySet<string>,
  servers: ReadonlySet<string>,
  titles: ReadonlySet<string>,
  sounds: ReadonlySet<string>,
  particles: ReadonlySet<string>,
): void {
  if (action.type === 'menu' && !menus.has(String(action.target)))
    throw new TypeError(`${label} references an unknown menu.`);
  if (action.type === 'connect' && !servers.has(String(action.target)))
    throw new TypeError(`${label} references an unavailable server.`);
  if (action.type === 'title' && !titles.has(String(action.target)))
    throw new TypeError(`${label} references an unknown title.`);
  if (action.type === 'sound' && !sounds.has(String(action.target)))
    throw new TypeError(`${label} references an unknown sound.`);
  if (action.type === 'particle' && !particles.has(String(action.target)))
    throw new TypeError(`${label} references an unknown particle.`);
}

export class LobbyConfigurationStore {
  public async load(): Promise<LobbyConfiguration> {
    const contents = Object.fromEntries(
      await Promise.all(
        LOBBY_FILES.map(async (file) => [file, await pluginFiles.read(`data/${file}`)] as const),
      ),
    ) as Record<LobbyFile, string>;
    const settings = parsed(contents['config.yml'], 'config.yml');
    const itemValues = array(
      parsed(contents['items.yml'], 'items.yml')['items'],
      'items.yml.items',
    );
    const menuValues = array(
      parsed(contents['menus.yml'], 'menus.yml')['menus'],
      'menus.yml.menus',
    );
    const serverValues = array(
      parsed(contents['servers.yml'], 'servers.yml')['servers'],
      'servers.yml.servers',
    );
    const portalValues = array(
      parsed(contents['portals.yml'], 'portals.yml')['portals'],
      'portals.yml.portals',
    );
    const messageRoot = parsed(contents['messages.yml'], 'messages.yml');
    keys(messageRoot, 'messages.yml', ['messages', 'titles', 'sounds', 'particles']);
    const titleValues = array(messageRoot['titles'], 'messages.yml.titles');
    const soundValues = array(messageRoot['sounds'], 'messages.yml.sounds');
    const particleValues = array(messageRoot['particles'], 'messages.yml.particles');
    validateItems(itemValues, 'items.yml.items');
    validateIdentityList(menuValues, 'menus.yml.menus');
    validateIdentityList(serverValues, 'servers.yml.servers');
    validateIdentityList(portalValues, 'portals.yml.portals');
    validateIdentityList(titleValues, 'messages.yml.titles');
    validateIdentityList(soundValues, 'messages.yml.sounds');
    validateIdentityList(particleValues, 'messages.yml.particles');
    const menuIds = new Set(menuValues.map((value) => String(record(value, 'menu')['id'])));
    const serverIds = new Set<string>();
    const titleIds = new Set(titleValues.map((value) => String(record(value, 'title')['id'])));
    const soundIds = new Set(soundValues.map((value) => String(record(value, 'sound')['id'])));
    const particleIds = new Set(
      particleValues.map((value) => String(record(value, 'particle')['id'])),
    );
    for (const [index, value] of titleValues.entries()) {
      const label = `messages.yml.titles[${String(index)}]`;
      const title = record(value, label);
      keys(title, label, [
        'id',
        'title',
        'subtitle',
        'fade-in-ticks',
        'stay-ticks',
        'fade-out-ticks',
      ]);
      text(title['title'], `${label}.title`);
      text(title['subtitle'], `${label}.subtitle`);
      integer(title['fade-in-ticks'], `${label}.fade-in-ticks`, 0, 72_000);
      integer(title['stay-ticks'], `${label}.stay-ticks`, 0, 72_000);
      integer(title['fade-out-ticks'], `${label}.fade-out-ticks`, 0, 72_000);
    }
    for (const [index, value] of soundValues.entries()) {
      const label = `messages.yml.sounds[${String(index)}]`;
      const sound = record(value, label);
      keys(sound, label, ['id', 'sound', 'volume', 'pitch']);
      const name = text(sound['sound'], `${label}.sound`, 128);
      if (!/^[A-Z][A-Z0-9_]{0,127}$/u.test(name)) throw new TypeError(`${label}.sound is invalid.`);
      finite(sound['volume'], `${label}.volume`, 0, 16);
      finite(sound['pitch'], `${label}.pitch`, 0, 2);
    }
    for (const [index, value] of particleValues.entries()) {
      const label = `messages.yml.particles[${String(index)}]`;
      const particle = record(value, label);
      keys(particle, label, [
        'id',
        'particle',
        'count',
        'offset-x',
        'offset-y',
        'offset-z',
        'speed',
      ]);
      const name = text(particle['particle'], `${label}.particle`, 128);
      if (!/^[A-Z][A-Z0-9_]{0,127}$/u.test(name))
        throw new TypeError(`${label}.particle is invalid.`);
      integer(particle['count'], `${label}.count`, 0, 10_000);
      for (const property of ['offset-x', 'offset-y', 'offset-z', 'speed'])
        finite(particle[property], `${label}.${property}`, 0, 1_000);
    }
    for (const [index, value] of menuValues.entries()) {
      const label = `menus.yml.menus[${String(index)}]`;
      const menu = record(value, label);
      keys(menu, label, ['id', 'rows', 'title', 'slots']);
      const rows = integer(menu['rows'], `${label}.rows`, 1, 6);
      text(menu['title'], `${label}.title`);
      const slots = array(menu['slots'], `${label}.slots`);
      validateItems(slots, `${label}.slots`, rows * 9 - 1);
    }
    for (const [index, value] of serverValues.entries()) {
      const label = `servers.yml.servers[${String(index)}]`;
      const server = record(value, label);
      keys(server, label, ['id', 'enabled', 'target', 'display-name']);
      bool(server['enabled'], `${label}.enabled`);
      text(server['target'], `${label}.target`, 128);
      text(server['display-name'], `${label}.display-name`);
      if (server['enabled'] === true) serverIds.add(String(server['id']));
    }
    for (const [index, value] of portalValues.entries()) {
      const label = `portals.yml.portals[${String(index)}]`;
      const portal = record(value, label);
      keys(
        portal,
        label,
        ['id', 'enabled', 'world', 'min', 'max', 'priority', 'cooldown-ms', 'action', 'visualize'],
        ['permission', 'destination'],
      );
      bool(portal['enabled'], `${label}.enabled`);
      text(portal['world'], `${label}.world`, 128);
      if (portal['permission'] !== undefined)
        text(portal['permission'], `${label}.permission`, 128);
      integer(portal['priority'], `${label}.priority`, -1_000_000, 1_000_000);
      integer(portal['cooldown-ms'], `${label}.cooldown-ms`, 0, 86_400_000);
      bool(portal['visualize'], `${label}.visualize`);
      const minimum = record(portal['min'], `${label}.min`);
      const maximum = record(portal['max'], `${label}.max`);
      keys(minimum, `${label}.min`, ['x', 'y', 'z']);
      keys(maximum, `${label}.max`, ['x', 'y', 'z']);
      for (const coordinate of ['x', 'y', 'z']) {
        const low = finite(
          minimum[coordinate],
          `${label}.min.${coordinate}`,
          -30_000_000,
          30_000_000,
        );
        const high = finite(
          maximum[coordinate],
          `${label}.max.${coordinate}`,
          -30_000_000,
          30_000_000,
        );
        if (low > high) throw new TypeError(`${label}.${coordinate} bounds are reversed.`);
      }
      validateAction(portal['action'], `${label}.action`);
    }
    const scoreboard = parsed(contents['scoreboard.yml'], 'scoreboard.yml');
    keys(scoreboard, 'scoreboard.yml', ['sidebar'], ['presentation']);
    const sidebar = record(scoreboard['sidebar'], 'scoreboard.yml.sidebar');
    const presentation = validatePresentation(scoreboard['presentation']);
    const spawn = record(parsed(contents['spawn.yml'], 'spawn.yml')['spawn'], 'spawn');
    validateSettings(settings);
    validateSidebar(sidebar);
    validateSpawn(spawn);
    for (const [index, item] of itemValues.entries())
      validateReference(
        item.action,
        `items.yml.items[${String(index)}].action`,
        menuIds,
        serverIds,
        titleIds,
        soundIds,
        particleIds,
      );
    for (const [menuIndex, menu] of (menuValues as unknown as readonly LobbyMenu[]).entries())
      for (const [slotIndex, item] of menu.slots.entries())
        validateReference(
          item.action,
          `menus.yml.menus[${String(menuIndex)}].slots[${String(slotIndex)}].action`,
          menuIds,
          serverIds,
          titleIds,
          soundIds,
          particleIds,
        );
    for (const [index, portal] of (portalValues as unknown as readonly LobbyPortal[]).entries())
      validateReference(
        portal.action,
        `portals.yml.portals[${String(index)}].action`,
        menuIds,
        serverIds,
        titleIds,
        soundIds,
        particleIds,
      );
    const join = record(settings['join'], 'config.yml.join');
    if (!titleIds.has(String(join['welcome-title'])))
      throw new TypeError('config.yml.join.welcome-title references an unknown title.');
    if (!soundIds.has(String(join['welcome-sound'])))
      throw new TypeError('config.yml.join.welcome-sound references an unknown sound.');
    if (!particleIds.has(String(join['welcome-particle'])))
      throw new TypeError('config.yml.join.welcome-particle references an unknown particle.');
    return Object.freeze({
      settings: settings as unknown as LobbySettings,
      messagesContent: contents['messages.yml'],
      items: itemValues,
      menus: menuValues as unknown as readonly LobbyMenu[],
      sidebar: sidebar as unknown as LobbySidebar,
      presentation,
      servers: serverValues as unknown as readonly LobbyServer[],
      spawn: spawn as unknown as LobbySpawn,
      portals: portalValues.map((portal) => ({
        ...record(portal, 'portal'),
      })) as unknown as LobbyPortal[],
    });
  }

  public writeSpawn(spawn: LobbySpawn): Promise<void> {
    return pluginFiles.write('data/spawn.yml', stringify({ spawn }));
  }

  public writePortals(portals: readonly LobbyPortal[]): Promise<void> {
    return pluginFiles.write('data/portals.yml', stringify({ portals }));
  }
}
