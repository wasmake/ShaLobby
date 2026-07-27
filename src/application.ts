import { OnDisable, OnEnable } from '@shamoo/lifecycle';
import { Plugin } from '@shamoo/decorators';

import { logError, logInfo } from './logging.js';
import { ManagedLobbyClient, type ManagedLobbyReloadSuccess } from './managed-lobby.js';
import { MessageCatalog } from './messages.js';

export interface ApplicationReloadResult {
  readonly runtime: ManagedLobbyReloadSuccess;
  readonly messages: MessageCatalog;
}

export class ShaLobbyApplication {
  public readonly messages: MessageCatalog;
  public readonly managedLobby: ManagedLobbyClient;
  #configurationAccepted = false;
  #reloadQueue: Promise<void> = Promise.resolve();

  public constructor(
    managedLobby: ManagedLobbyClient = new ManagedLobbyClient(),
    messages: MessageCatalog = new MessageCatalog(),
  ) {
    this.managedLobby = managedLobby;
    this.messages = messages;
  }

  public get configurationAccepted(): boolean {
    return this.#configurationAccepted;
  }

  public async start(): Promise<ApplicationReloadResult> {
    this.#configurationAccepted = false;
    await this.managedLobby.ensure();
    const result = await this.reload();
    this.#configurationAccepted = true;
    return result;
  }

  public reload(): Promise<ApplicationReloadResult> {
    const transaction = this.#reloadQueue.then(() => this.reloadTransaction());
    this.#reloadQueue = transaction.then(
      () => undefined,
      () => undefined,
    );
    return transaction;
  }

  private async reloadTransaction(): Promise<ApplicationReloadResult> {
    const runtime = await this.managedLobby.reload();
    const candidate = new MessageCatalog();
    candidate.replace(runtime.messagesContent);
    this.messages.commit(candidate);
    return Object.freeze({ messages: this.messages, runtime });
  }
}

export const shaLobbyApplication = new ShaLobbyApplication();

@Plugin({ name: 'shalobby' })
export class ShaLobbyPlugin {
  @OnEnable()
  public async enable(): Promise<void> {
    try {
      const result = await shaLobbyApplication.start();
      logInfo('startup-configuration-accepted', {
        state: result.runtime.state,
        messagesLoaded: true,
        nativeActivation: 'awaiting-runtime-admission',
      });
    } catch (error: unknown) {
      logError('startup-failed', error);
      throw error;
    }
  }

  @OnDisable()
  public disable(): void {
    logInfo('shutdown-complete');
  }
}
