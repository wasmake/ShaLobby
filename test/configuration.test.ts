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
  });

  it('rejects cross-file references to unavailable destinations', async () => {
    contents.set(
      'items.yml',
      String(contents.get('items.yml')).replace('target: game-selector', 'target: missing-menu'),
    );

    await expect(new LobbyConfigurationStore().load()).rejects.toThrow('unknown menu');
  });
});
