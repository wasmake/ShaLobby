import { Plugin } from '@shamoo/decorators';
import { OnDisable, OnEnable } from '@shamoo/lifecycle';

import { shaLobbyHandler } from '../../composition.js';
import { logError, logInfo, logStartupComplete } from '../../messages/console-logger.js';

@Plugin({ name: 'shalobby' })
export class ShaLobbyPlugin {
  @OnEnable()
  public async enable(): Promise<void> {
    const startedAt = performance.now();
    try {
      const result = await shaLobbyHandler.start();
      const durationMs = performance.now() - startedAt;
      logInfo('startup-configuration-accepted', {
        state: result.runtime.state,
        messagesLoaded: true,
        paperApi: 'generated-public-bindings',
        durationMs: Number(durationMs.toFixed(2)),
      });
      logStartupComplete(durationMs);
    } catch (error: unknown) {
      logError('startup-failed', error);
      throw error;
    }
  }

  @OnDisable()
  public async disable(): Promise<void> {
    await shaLobbyHandler.stop();
    logInfo('shutdown-complete');
  }
}
