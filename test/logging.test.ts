import { afterEach, describe, expect, it, vi } from 'vitest';

import { logStartupComplete } from '../src/messages/console-logger.js';

afterEach(() => vi.restoreAllMocks());

describe('console logging', () => {
  it('prints a colored startup completion message with elapsed time', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logStartupComplete(123.456);

    expect(info).toHaveBeenCalledWith(
      '\u001B[96m[ShaLobby]\u001B[0m \u001B[92mFinished loading successfully\u001B[0m \u001B[93min 123.46 ms.\u001B[0m',
    );
  });
});
