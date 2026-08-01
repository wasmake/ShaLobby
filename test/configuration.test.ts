import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { pluginFiles } from '@shamoo/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LOBBY_FILES } from '../src/configuration/files.js';
import { YamlLobbyConfigurationProvider } from '../src/providers/lobby-configuration-provider.js';

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
    const configuration = await new YamlLobbyConfigurationProvider().load();

    expect(configuration.settings.worlds.map((world) => world.name)).toEqual(['world']);
    expect(configuration.items).toHaveLength(5);
    expect(configuration.menus).toHaveLength(4);
    expect(configuration.menus[0]?.filler?.material).toBe('GRAY_STAINED_GLASS_PANE');
    expect(configuration.servers).toHaveLength(6);
    expect(configuration.portals).toHaveLength(3);
    expect(configuration.presentation.bossbar.enabled).toBe(true);
    expect(configuration.presentation['player-list'].enabled).toBe(true);
    expect(configuration.messageResources.messages['bienvenida']).toContain('Bienvenido');
    expect(configuration.messageResources.titles['bienvenida']?.['stay-ticks']).toBe(60);
    expect(configuration.messageResources.sounds['bienvenida']?.sound).toBe(
      'UI_TOAST_CHALLENGE_COMPLETE',
    );
    expect(configuration.messageResources.particles['bienvenida']?.particle).toBe('HAPPY_VILLAGER');
    expect(Reflect.get(configuration.messageResources.messages, 'constructor')).toBeUndefined();
  });

  it('decodes message resources independently of YAML field order', async () => {
    contents.set(
      'messages.yml',
      String(contents.get('messages.yml')).replace(
        `  - id: bienvenida
    title: '<gradient:#38D9FF:#4F7CFF:#A855F7><bold>✦ AKARDOO NETWORK ✦</bold></gradient>'
    subtitle: '<#A8B3C7>Tu aventura comienza aquí</#A8B3C7>'
    fade-in-ticks: 10
    stay-ticks: 60
    fade-out-ticks: 20`,
        `  - subtitle: '<#A8B3C7>Tu aventura comienza aquí</#A8B3C7>'
    stay-ticks: 60
    id: bienvenida
    fade-out-ticks: 20
    title: '<gradient:#38D9FF:#4F7CFF:#A855F7><bold>✦ AKARDOO NETWORK ✦</bold></gradient>'
    fade-in-ticks: 10`,
      ),
    );

    const resources = (await new YamlLobbyConfigurationProvider().load()).messageResources;

    expect(resources.titles['bienvenida']).toEqual({
      title: '<gradient:#38D9FF:#4F7CFF:#A855F7><bold>✦ AKARDOO NETWORK ✦</bold></gradient>',
      subtitle: '<#A8B3C7>Tu aventura comienza aquí</#A8B3C7>',
      'fade-in-ticks': 10,
      'stay-ticks': 60,
      'fade-out-ticks': 20,
    });
  });

  it('rejects cross-file references to unavailable destinations', async () => {
    contents.set(
      'items.yml',
      String(contents.get('items.yml')).replace('target: game-selector', 'target: missing-menu'),
    );

    await expect(new YamlLobbyConfigurationProvider().load()).rejects.toThrow('unknown menu');
  });

  it('accepts ignored legacy targets on none and spawn actions', async () => {
    contents.set(
      'menus.yml',
      String(contents.get('menus.yml')).replace(
        'action: { type: spawn }',
        'action: { type: spawn, target: legacy }',
      ),
    );

    await expect(new YamlLobbyConfigurationProvider().load()).resolves.toBeDefined();
  });

  it('rejects duplicate message keys before accepting the runtime snapshot', async () => {
    contents.set(
      'messages.yml',
      String(contents.get('messages.yml')).replace(
        'messages:\n',
        'messages:\n  duplicate: first\n  duplicate: second\n',
      ),
    );

    await expect(new YamlLobbyConfigurationProvider().load()).rejects.toThrow(
      'messages.yml no es YAML válido',
    );
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

    await expect(new YamlLobbyConfigurationProvider().load()).rejects.toThrow(
      'cannot be empty while enabled',
    );
  });

  it('uses the Akardoo presentation defaults for an existing scoreboard file', async () => {
    contents.set(
      'scoreboard.yml',
      String(contents.get('scoreboard.yml')).replace(/\npresentation:[\s\S]*$/u, '\n'),
    );

    const configuration = await new YamlLobbyConfigurationProvider().load();

    expect(configuration.presentation.bossbar['title-frames'].at(-1)).toContain('AKARDOO NETWORK');
    expect(configuration.presentation['player-list'].header).toContain('Bienvenido');
  });

  it('rejects an invalid bossbar color', async () => {
    contents.set(
      'scoreboard.yml',
      String(contents.get('scoreboard.yml')).replace('color: PURPLE', 'color: ORANGE'),
    );

    await expect(new YamlLobbyConfigurationProvider().load()).rejects.toThrow(
      'bossbar.color is invalid',
    );
  });

  it('normalizes legacy timing and player-list frame arrays', async () => {
    contents.set(
      'scoreboard.yml',
      String(contents.get('scoreboard.yml')).replace(
        /presentation:[\s\S]*$/u,
        `presentation:
  interval-ticks: 1728000
  bossbar:
    enabled: true
    color: PURPLE
    overlay: PROGRESS
    progress: 1
    title-frames:
      - Legacy shop
  player-list:
    enabled: true
    header-frames:
      - First header
      - Ignored header
    footer-frames:
      - First footer
      - Ignored footer
`,
      ),
    );

    const presentation = (await new YamlLobbyConfigurationProvider().load()).presentation;

    expect(presentation.bossbar['frame-ticks']).toBe(1_727_999);
    expect(presentation.bossbar['last-frame-ticks']).toBe(1_728_000);
    expect(presentation['player-list'].header).toBe('First header');
    expect(presentation['player-list'].footer).toBe('First footer');
  });

  it('requires the final bossbar frame to outlast ordinary frames', async () => {
    contents.set(
      'scoreboard.yml',
      String(contents.get('scoreboard.yml')).replace('last-frame-ticks: 60', 'last-frame-ticks: 2'),
    );

    await expect(new YamlLobbyConfigurationProvider().load()).rejects.toThrow(
      'last-frame-ticks must exceed frame-ticks',
    );
  });
});
