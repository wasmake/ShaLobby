import type { ManagedLobbyClient, ManagedLobbyReloadSuccess } from '../api/managed-lobby.js';
import { MessageCatalog } from '../messages/message-catalog.js';

export interface HandlerReloadResult {
  readonly runtime: ManagedLobbyReloadSuccess;
  readonly messages: MessageCatalog;
}

export class ShaLobbyHandler {
  public readonly messages: MessageCatalog;
  public readonly managedLobby: ManagedLobbyClient;
  #configurationAccepted = false;
  #reloadQueue: Promise<void> = Promise.resolve();
  readonly #shutdown: () => Promise<void>;
  #stopPromise: Promise<void> | undefined;
  #stopping = false;

  public constructor(
    managedLobby: ManagedLobbyClient,
    messages: MessageCatalog = new MessageCatalog(),
    shutdown: () => Promise<void> = () => Promise.resolve(),
  ) {
    this.managedLobby = managedLobby;
    this.messages = messages;
    this.#shutdown = shutdown;
  }

  public get configurationAccepted(): boolean {
    return this.#configurationAccepted;
  }

  public async start(): Promise<HandlerReloadResult> {
    this.assertRunning();
    this.#configurationAccepted = false;
    await this.managedLobby.ensure();
    const result = await this.reload();
    this.assertRunning();
    this.#configurationAccepted = true;
    return result;
  }

  public reload(): Promise<HandlerReloadResult> {
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

  private async reloadTransaction(): Promise<HandlerReloadResult> {
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
