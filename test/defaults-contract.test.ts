import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { promisify } from 'node:util';

import { parseDocument } from 'yaml';
import { describe, expect, it } from 'vitest';

import { COMMAND_MESSAGE_FALLBACKS } from '../src/messages.js';

const DEFAULT_FILES = Object.freeze([
  'config.yml',
  'items.yml',
  'menus.yml',
  'messages.yml',
  'portals.yml',
  'scoreboard.yml',
  'servers.yml',
  'spawn.yml',
] as const);
const DEFAULTS = resolve(import.meta.dirname, '../defaults');
const PROJECT = resolve(import.meta.dirname, '..');
const DIST = resolve(PROJECT, 'dist');
const RUNTIME_DEFAULTS = process.env['SHALOBBY_RUNTIME_DEFAULTS_DIR'];
const ID = /^[a-z][a-z0-9_-]{0,63}$/u;
const PLACEHOLDER = /%[a-z][a-z0-9_-]{0,63}%/gu;
const executeFile = promisify(execFile);
const DEFAULT_MENU_IDS = Object.freeze([
  'game-selector',
  'lobby-selector',
  'profile',
  'settings',
] as const);
const DEFAULT_SERVER_IDS = Object.freeze([
  'survival',
  'skyblock',
  'minigames',
  'lobby-1',
  'lobby-2',
  'lobby-3',
] as const);
const DEFAULT_PORTAL_IDS = Object.freeze([
  'portal-survival',
  'portal-skyblock',
  'portal-minigames',
] as const);
const DIST_FILES = Object.freeze(['index.js', 'index.js.map', 'shamoo-plugin.json'] as const);
const BUILD_FILES = Object.freeze([
  ...DIST_FILES,
  ...DEFAULT_FILES.map((file) => `data/${file}`),
] as const);
const SCOREBOARD_PLACEHOLDERS = Object.freeze([
  '%online%',
  '%ping%',
  '%player%',
  '%visibility%',
  '%world%',
  '%x%',
  '%y%',
  '%z%',
] as const);
const NATIVE_MESSAGE_KEYS = new Set([
  'bienvenida',
  'sin-permiso',
  'configuracion-invalida',
  'recarga-completada',
  'recarga-fallida',
  'spawn-no-configurado',
  'spawn-establecido',
  'spawn-solicitado',
  'objetos-restaurados',
  'menu-abierto',
  'menu-no-disponible',
  'visibilidad-todos',
  'visibilidad-personal',
  'visibilidad-ninguno',
  'visibilidad-actualizada',
  'transferencia-iniciada',
  'transferencia-espera',
  'item-cooldown',
  'portal-cooldown',
  'servidor-no-disponible',
  'portal-varita',
  'portal-seleccion-incompleta',
  'portal-mundos-distintos',
  'portal-creado',
  'portal-eliminado',
  'portal-no-encontrado',
  'portal-habilitado',
  'portal-deshabilitado',
  'portal-destino',
  'portal-visualizacion',
  'portal-lista',
]);
const FALLBACK_PALETTE = Object.freeze([
  '#38D9FF',
  '#4F7CFF',
  '#A855F7',
  '#55FF88',
  '#FFB347',
  '#FF5C7A',
  '#A8B3C7',
  '#303746',
  '#F8FAFC',
] as const);
const NAMED_COLOR =
  /<\/?(?:aqua|black|blue|dark_aqua|dark_blue|dark_gray|dark_green|dark_purple|dark_red|gold|gray|green|light_purple|red|white|yellow)>/iu;

type DefaultFile = (typeof DEFAULT_FILES)[number];
type Mapping = Readonly<Record<string, unknown>>;

function mapping(value: unknown, path: string): Mapping {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be a mapping.`);
  }
  return value as Mapping;
}

function sequence(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be a sequence.`);
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${path} must be nonempty text.`);
  }
  return value;
}

function integer(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new TypeError(`${path} must be an integer.`);
  }
  return value;
}

function canonicalId(value: unknown, path: string): string {
  const id = text(value, path);
  if (!ID.test(id)) throw new TypeError(`${path} must be a canonical ID.`);
  return id;
}

function idSet(value: unknown, path: string): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const [index, entry] of sequence(value, path).entries()) {
    const id = canonicalId(mapping(entry, `${path}[${String(index)}]`)['id'], `${path}.id`);
    if (ids.has(id)) throw new TypeError(`${path} contains duplicate ID ${id}.`);
    ids.add(id);
  }
  return ids;
}

function requireReference(values: ReadonlySet<string>, value: unknown, path: string): string {
  const id = canonicalId(value, path);
  if (!values.has(id)) throw new TypeError(`${path} references missing ID ${id}.`);
  return id;
}

function nonItalicItem(value: Mapping, path: string): void {
  expect(text(value['name'], `${path}.name`), `${path}.name`).toContain('<italic:false>');
  for (const [index, line] of sequence(value['lore'], `${path}.lore`).entries()) {
    expect(
      text(line, `${path}.lore[${String(index)}]`),
      `${path}.lore[${String(index)}]`,
    ).toContain('<italic:false>');
  }
}

function uniqueSlot(slots: Set<number>, value: unknown, maximum: number, path: string): void {
  const slot = integer(value, path);
  if (slot < 0 || slot >= maximum) throw new TypeError(`${path} is outside its inventory.`);
  if (slots.has(slot)) throw new TypeError(`${path} duplicates slot ${String(slot)}.`);
  slots.add(slot);
}

function actionReferences(
  value: unknown,
  path: string,
  references: {
    readonly menus: ReadonlySet<string>;
    readonly particles: ReadonlySet<string>;
    readonly servers: ReadonlySet<string>;
    readonly sounds: ReadonlySet<string>;
    readonly titles: ReadonlySet<string>;
  },
): void {
  const action = mapping(value, path);
  const type = text(action['type'], `${path}.type`);
  if (type === 'menu') requireReference(references.menus, action['target'], `${path}.target`);
  else if (type === 'connect') {
    requireReference(references.servers, action['target'], `${path}.target`);
  } else if (type === 'particle') {
    requireReference(references.particles, action['target'], `${path}.target`);
  } else if (type === 'sound') {
    requireReference(references.sounds, action['target'], `${path}.target`);
  } else if (type === 'title') {
    requireReference(references.titles, action['target'], `${path}.target`);
  } else if (type === 'visibility') {
    expect(['all', 'staff', 'none', 'cycle']).toContain(action['target']);
  } else if (type !== 'none' && type !== 'spawn') {
    throw new TypeError(`${path}.type is unsupported: ${type}.`);
  }
}

async function readDefaults(): Promise<Record<DefaultFile, Mapping>> {
  const entries = await Promise.all(
    DEFAULT_FILES.map(async (file) => {
      const source = await readFile(resolve(DEFAULTS, file), 'utf8');
      const document = parseDocument(source, {
        logLevel: 'silent',
        merge: false,
        prettyErrors: false,
        schema: 'core',
        strict: true,
        stringKeys: true,
        uniqueKeys: true,
        version: '1.2',
      });
      const problems = [...document.errors, ...document.warnings];
      if (problems.length > 0) {
        throw new TypeError(
          `${file} is not strict YAML: ${problems.map((problem) => problem.message).join('; ')}`,
        );
      }
      return [file, mapping(document.toJS({ maxAliasCount: 16 }), file)] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<DefaultFile, Mapping>;
}

async function buildHashes(): Promise<Readonly<Record<string, string>>> {
  await executeFile('pnpm', ['build'], {
    cwd: PROJECT,
    env: { ...process.env, NO_COLOR: '1' },
  });
  expect((await readdir(DIST)).sort()).toEqual([...DIST_FILES, 'data'].sort());
  expect((await readdir(resolve(DIST, 'data'))).sort()).toEqual([...DEFAULT_FILES].sort());
  const manifest: unknown = JSON.parse(await readFile(resolve(DIST, 'shamoo-plugin.json'), 'utf8'));
  const paper = mapping(
    mapping(mapping(manifest, 'manifest')['platforms'], 'manifest.platforms')['paper'],
    'manifest.platforms.paper',
  );
  expect(paper).toMatchObject({ enabled: true, minecraft: '26.2', paperApi: '26.2' });
  const bundle = await readFile(resolve(DIST, 'index.js'), 'utf8');
  expect(bundle).not.toContain('Dynamic require of "');
  expect(bundle).not.toMatch(
    /\b(?:__require\(|require\(|from\s+|import\s*)["'](?:node:)?(?:buffer|process)["']/u,
  );
  return Object.fromEntries(
    await Promise.all(
      BUILD_FILES.map(async (file) => {
        const content = await readFile(resolve(DIST, file));
        return [file, createHash('sha256').update(content).digest('hex')] as const;
      }),
    ),
  );
}

describe('managed lobby defaults contract', () => {
  it('uses only the requested command fallback palette', () => {
    const fallbacks = Object.values(COMMAND_MESSAGE_FALLBACKS).join('\n');
    const colors = new Set(fallbacks.match(/#[\dA-F]{6}/gu) ?? []);

    expect([...colors]).toEqual(expect.arrayContaining([...FALLBACK_PALETTE]));
    expect(colors.size).toBe(FALLBACK_PALETTE.length);
    expect(fallbacks).not.toMatch(NAMED_COLOR);
  });

  it('contains exactly eight strict YAML files with unique keys', async () => {
    expect((await readdir(DEFAULTS)).sort()).toEqual([...DEFAULT_FILES].sort());
    await expect(readDefaults()).resolves.toBeDefined();
  });

  it('keeps command YAML defaults exactly equal to the compiled fallback catalog', async () => {
    const messages = mapping(
      (await readDefaults())['messages.yml']['messages'],
      'messages.yml.messages',
    );
    const commandDefaults = Object.fromEntries(
      Object.entries(messages).filter(([key]) => !NATIVE_MESSAGE_KEYS.has(key)),
    );

    expect(commandDefaults).toEqual(COMMAND_MESSAGE_FALLBACKS);
  });

  it('keeps native cooldown feedback distinct from command fallbacks', async () => {
    const messages = mapping(
      (await readDefaults())['messages.yml']['messages'],
      'messages.yml.messages',
    );

    expect(messages['item-cooldown']).toBe(
      '<#303746>◆</#303746> <#FFB347>Espera <#F8FAFC>%seconds%</#F8FAFC> s antes de volver a usar este objeto.</#FFB347>',
    );
    expect(messages['portal-cooldown']).toBe(
      '<#303746>◆</#303746> <#FFB347>Espera <#F8FAFC>%seconds%</#F8FAFC> s antes de volver a usar este portal.</#FFB347>',
    );
    expect(COMMAND_MESSAGE_FALLBACKS).not.toHaveProperty('item-cooldown');
    expect(COMMAND_MESSAGE_FALLBACKS).not.toHaveProperty('portal-cooldown');
  });

  it('ships an exact 15-line sidebar using only all supported Runtime placeholders', async () => {
    const scoreboard = (await readDefaults())['scoreboard.yml'];
    expect(Object.keys(scoreboard)).toEqual(['sidebar', 'presentation']);
    const sidebar = mapping(scoreboard['sidebar'], 'scoreboard.yml.sidebar');
    expect(Object.keys(sidebar).sort()).toEqual(
      ['enabled', 'interval-ticks', 'lines', 'title-frames'].sort(),
    );
    expect(sidebar['enabled']).toBe(true);
    expect(sidebar['interval-ticks']).toBe(10);
    const frames = sequence(sidebar['title-frames'], 'scoreboard.yml.sidebar.title-frames').map(
      (value, index) => text(value, `scoreboard.yml.sidebar.title-frames[${String(index)}]`),
    );
    const lines = sequence(sidebar['lines'], 'scoreboard.yml.sidebar.lines').map((value, index) =>
      typeof value === 'string'
        ? value
        : text(value, `scoreboard.yml.sidebar.lines[${String(index)}]`),
    );
    const placeholders = new Set([...frames, ...lines].join('\n').match(PLACEHOLDER) ?? []);

    expect(frames).toHaveLength(4);
    expect(lines).toHaveLength(15);
    expect([...placeholders].sort()).toEqual([...SCOREBOARD_PLACEHOLDERS].sort());

    const presentation = mapping(scoreboard['presentation'], 'scoreboard.yml.presentation');
    const bossbar = mapping(presentation['bossbar'], 'scoreboard.yml.presentation.bossbar');
    expect(bossbar['enabled']).toBe(true);
    expect(bossbar['color']).toBe('PURPLE');
    expect(bossbar['overlay']).toBe('PROGRESS');
    expect(bossbar['frame-ticks']).toBe(2);
    expect(bossbar['last-frame-ticks']).toBe(60);
    const bossbarFrames = sequence(
      bossbar['title-frames'],
      'scoreboard.yml.presentation.bossbar.title-frames',
    );
    expect(bossbarFrames).toHaveLength(15);
    expect(bossbarFrames[0]).toContain('>T<');
    expect(bossbarFrames.at(-1)).toContain('TIENDA SHALOBBY');
    const playerList = mapping(
      presentation['player-list'],
      'scoreboard.yml.presentation.player-list',
    );
    expect(playerList['enabled']).toBe(true);
    expect(text(playerList['header'], 'scoreboard.yml.presentation.player-list.header')).toContain(
      'Bienvenido',
    );
    expect(text(playerList['footer'], 'scoreboard.yml.presentation.player-list.footer')).toContain(
      'Jugadores en línea',
    );
  });

  it.skipIf(RUNTIME_DEFAULTS === undefined)(
    'matches an explicitly supplied Runtime-generated defaults directory byte for byte',
    async () => {
      if (RUNTIME_DEFAULTS === undefined || !isAbsolute(RUNTIME_DEFAULTS)) {
        throw new TypeError('SHALOBBY_RUNTIME_DEFAULTS_DIR must be an absolute path.');
      }
      for (const file of DEFAULT_FILES) {
        expect(await readFile(resolve(DEFAULTS, file)), file).toEqual(
          await readFile(resolve(RUNTIME_DEFAULTS, file)),
        );
      }
    },
  );

  it('keeps IDs, slots, presentation, and all cross-file references coherent', async () => {
    const files = await readDefaults();
    const config = files['config.yml'];
    const items = sequence(files['items.yml']['items'], 'items.yml.items');
    const menus = sequence(files['menus.yml']['menus'], 'menus.yml.menus');
    const messages = mapping(files['messages.yml']['messages'], 'messages.yml.messages');
    const portals = sequence(files['portals.yml']['portals'], 'portals.yml.portals');
    const servers = sequence(files['servers.yml']['servers'], 'servers.yml.servers');
    const worlds = new Set(
      sequence(config['worlds'], 'config.yml.worlds').map((entry, index) =>
        text(mapping(entry, `config.yml.worlds[${String(index)}]`)['name'], 'world.name'),
      ),
    );
    const menuIds = idSet(menus, 'menus.yml.menus');
    const serverIds = idSet(servers, 'servers.yml.servers');
    const portalIds = idSet(portals, 'portals.yml.portals');
    const itemIds = idSet(items, 'items.yml.items');
    const titles = idSet(files['messages.yml']['titles'], 'messages.yml.titles');
    const sounds = idSet(files['messages.yml']['sounds'], 'messages.yml.sounds');
    const particles = idSet(files['messages.yml']['particles'], 'messages.yml.particles');
    const references = { menus: menuIds, particles, servers: serverIds, sounds, titles };

    expect([...menuIds]).toEqual([...DEFAULT_MENU_IDS]);
    expect([...serverIds]).toEqual([...DEFAULT_SERVER_IDS]);
    expect([...portalIds]).toEqual([...DEFAULT_PORTAL_IDS]);
    expect(itemIds.size).toBe(items.length);
    expect(mapping(config['protection'], 'config.yml.protection')['bypass-permission']).toBe(
      'lobby.protection.bypass',
    );

    for (const key of Object.keys(COMMAND_MESSAGE_FALLBACKS)) {
      expect(messages, `messages.yml.messages.${key}`).toHaveProperty(key);
      text(messages[key], `messages.yml.messages.${key}`);
    }
    for (const key of Object.keys(messages)) canonicalId(key, `messages.yml.messages.${key}`);

    const join = mapping(config['join'], 'config.yml.join');
    const messageIds = new Set(Object.keys(messages));
    requireReference(messageIds, join['welcome-message'], 'config.yml.join.welcome-message');
    requireReference(titles, join['welcome-title'], 'config.yml.join.welcome-title');
    requireReference(sounds, join['welcome-sound'], 'config.yml.join.welcome-sound');
    requireReference(particles, join['welcome-particle'], 'config.yml.join.welcome-particle');

    const itemSlots = new Set<number>();
    for (const [index, entry] of items.entries()) {
      const item = mapping(entry, `items.yml.items[${String(index)}]`);
      uniqueSlot(itemSlots, item['slot'], 9, `items.yml.items[${String(index)}].slot`);
      nonItalicItem(item, `items.yml.items[${String(index)}]`);
      actionReferences(item['action'], `items.yml.items[${String(index)}].action`, references);
    }

    for (const [menuIndex, entry] of menus.entries()) {
      const menu = mapping(entry, `menus.yml.menus[${String(menuIndex)}]`);
      const rows = integer(menu['rows'], `menus.yml.menus[${String(menuIndex)}].rows`);
      expect(rows).toBeGreaterThanOrEqual(1);
      expect(rows).toBeLessThanOrEqual(6);
      const slots = new Set<number>();
      for (const [slotIndex, slotEntry] of sequence(
        menu['slots'],
        `menus.yml.menus[${String(menuIndex)}].slots`,
      ).entries()) {
        const slot = mapping(slotEntry, `menus[${String(menuIndex)}].slots[${String(slotIndex)}]`);
        uniqueSlot(slots, slot['slot'], rows * 9, `menus.slots[${String(slotIndex)}].slot`);
        nonItalicItem(slot, `menus[${String(menuIndex)}].slots[${String(slotIndex)}]`);
        actionReferences(
          slot['action'],
          `menus[${String(menuIndex)}].slots[${String(slotIndex)}].action`,
          references,
        );
      }
    }

    for (const [index, entry] of portals.entries()) {
      const portal = mapping(entry, `portals.yml.portals[${String(index)}]`);
      expect(worlds.has(text(portal['world'], `portals[${String(index)}].world`))).toBe(true);
      const destination = requireReference(
        serverIds,
        portal['destination'],
        `portals[${String(index)}].destination`,
      );
      const action = mapping(portal['action'], `portals[${String(index)}].action`);
      expect(action['type']).toBe('connect');
      expect(action['target']).toBe(destination);
    }

    for (const [index, entry] of servers.entries()) {
      const server = mapping(entry, `servers.yml.servers[${String(index)}]`);
      text(server['target'], `servers[${String(index)}].target`);
      text(server['display-name'], `servers[${String(index)}].display-name`);
    }

    const spawn = mapping(files['spawn.yml']['spawn'], 'spawn.yml.spawn');
    expect(typeof spawn['configured']).toBe('boolean');
    if (spawn['configured'] === false) {
      expect(Object.keys(spawn)).toEqual(['configured']);
    } else {
      expect(Object.keys(spawn).sort()).toEqual(
        ['configured', 'pitch', 'world', 'x', 'y', 'yaw', 'z'].sort(),
      );
      expect(worlds.has(text(spawn['world'], 'spawn.yml.spawn.world'))).toBe(true);
      for (const key of ['x', 'y', 'z', 'yaw', 'pitch']) {
        expect(typeof spawn[key], `spawn.yml.spawn.${key}`).toBe('number');
        expect(Number.isFinite(spawn[key]), `spawn.yml.spawn.${key}`).toBe(true);
      }
    }
  });

  it(
    'produces identical hashes for two consecutive complete builds',
    { timeout: 60_000 },
    async () => {
      const first = await buildHashes();
      const second = await buildHashes();

      expect(second).toEqual(first);
    },
  );
});
