import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { pluginFiles } from '@shamoo/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LOBBY_FILES, LobbyConfigurationStore } from '../src/configuration.js';

vi.mock('@shamoo/config', () => ({
  pluginFiles: {
    read: vi.fn(),
    write: vi.fn(),
  },
}));

const defaults = fileURLToPath(new URL('../defaults/', import.meta.url));
const contents = new Map<string, string>();

beforeEach(async () => {
  contents.clear();
  await Promise.all(
    LOBBY_FILES.map(async (file) => {
      contents.set(file, await readFile(`${defaults}${file}`, 'utf8'));
    }),
  );
  vi.mocked(pluginFiles.read).mockImplementation((path) => {
    const value = contents.get(path.replace(/^data\//u, ''));
    return value === undefined
      ? Promise.reject(new Error(`Missing fixture: ${path}`))
      : Promise.resolve(value);
  });
  vi.mocked(pluginFiles.write).mockResolvedValue(undefined);
});

describe('lobby configuration', () => {
  it('accepts the complete shipped defaults', async () => {
    const configuration = await new LobbyConfigurationStore().load();

    expect(configuration.settings.worlds.map((world) => world.name)).toEqual(['world']);
    expect(configuration.items).toHaveLength(5);
    expect(configuration.menus).toHaveLength(4);
    expect(configuration.servers).toHaveLength(6);
    expect(configuration.portals).toHaveLength(3);
    expect(configuration.presentation.bossbar.enabled).toBe(true);
    expect(configuration.presentation['player-list'].enabled).toBe(true);
  });

  it('rejects cross-file references to unavailable destinations', async () => {
    contents.set(
      'items.yml',
      String(contents.get('items.yml')).replace('target: game-selector', 'target: missing-menu'),
    );

    await expect(new LobbyConfigurationStore().load()).rejects.toThrow('unknown menu');
  });

  it('rejects an enabled sidebar without visible lines', async () => {
    contents.set(
      'scoreboard.yml',
      `sidebar:
  enabled: true
  interval-ticks: 20
  title-frames:
    - ShaLobby
  lines: []
`,
    );

    await expect(new LobbyConfigurationStore().load()).rejects.toThrow(
      'cannot be empty while enabled',
    );
  });

  it('uses the animated Spanish presentation defaults for an existing scoreboard file', async () => {
    contents.set(
      'scoreboard.yml',
      String(contents.get('scoreboard.yml')).replace(/\npresentation:[\s\S]*$/u, '\n'),
    );

    const configuration = await new LobbyConfigurationStore().load();

    expect(configuration.presentation.bossbar['title-frames'][0]).toContain('TIENDA');
    expect(configuration.presentation['player-list']['header-frames'][0]).toContain('Bienvenido');
  });

  it('rejects an invalid bossbar color', async () => {
    contents.set(
      'scoreboard.yml',
      String(contents.get('scoreboard.yml')).replace('color: PURPLE', 'color: ORANGE'),
    );

    await expect(new LobbyConfigurationStore().load()).rejects.toThrow('bossbar.color is invalid');
  });
});
