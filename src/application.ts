import { OnDisable, OnEnable } from '@shamoo/lifecycle';
import { Plugin } from '@shamoo/decorators';

import { logError, logInfo, logStartupComplete } from './logging.js';
import { ManagedLobbyClient, type ManagedLobbyReloadSuccess } from './managed-lobby.js';
import { MessageCatalog } from './messages.js';
import { shaLobbyRuntime } from './lobby.js';

export interface ApplicationReloadResult {
  readonly runtime: ManagedLobbyReloadSuccess;
  readonly messages: MessageCatalog;
}

export class ShaLobbyApplication {
  public readonly messages: MessageCatalog;
  public readonly managedLobby: ManagedLobbyClient;
  #configurationAccepted = false;
  #reloadQueue: Promise<void> = Promise.resolve();
  readonly #shutdown: () => Promise<void>;
  #stopPromise: Promise<void> | undefined;
  #stopping = false;

  public constructor(
    managedLobby: ManagedLobbyClient = new ManagedLobbyClient((request) =>
      shaLobbyRuntime.request(request),
    ),
    messages: MessageCatalog = new MessageCatalog(),
    shutdown: () => Promise<void> = () => shaLobbyRuntime.close(),
  ) {
    this.managedLobby = managedLobby;
    this.messages = messages;
    this.#shutdown = shutdown;
  }

  public get configurationAccepted(): boolean {
    return this.#configurationAccepted;
  }

  public async start(): Promise<ApplicationReloadResult> {
    this.assertRunning();
    this.#configurationAccepted = false;
    await this.managedLobby.ensure();
    const result = await this.reload();
    this.assertRunning();
    this.#configurationAccepted = true;
    return result;
  }

  public reload(): Promise<ApplicationReloadResult> {
    if (this.#stopping) return Promise.reject(new Error('ShaLobby is stopping.'));
    const transaction = this.#reloadQueue.then(() => this.reloadTransaction());
    this.#reloadQueue = transaction.then(
      () => undefined,
      () => undefined,
    );
    return transaction;
  }

  public stop(): Promise<void> {
    if (this.#stopPromise !== undefined) return this.#stopPromise;
    this.#stopping = true;
    this.#configurationAccepted = false;
    const transaction = this.#reloadQueue.then(() => this.#shutdown());
    this.#reloadQueue = transaction.then(
      () => undefined,
      () => undefined,
    );
    this.#stopPromise = transaction;
    return transaction;
  }

  private async reloadTransaction(): Promise<ApplicationReloadResult> {
    const runtime = await this.managedLobby.reload();
    const candidate = new MessageCatalog();
    candidate.replace(runtime.messagesContent);
    this.messages.commit(candidate);
    return Object.freeze({ messages: this.messages, runtime });
  }

  private assertRunning(): void {
    if (this.#stopping) throw new Error('ShaLobby is stopping.');
  }
}

export const shaLobbyApplication = new ShaLobbyApplication();

@Plugin({ name: 'shalobby' })
export class ShaLobbyPlugin {
  @OnEnable()
  public async enable(): Promise<void> {
    const startedAt = performance.now();
    try {
      const result = await shaLobbyApplication.start();
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
    await shaLobbyApplication.stop();
    logInfo('shutdown-complete');
  }
}
