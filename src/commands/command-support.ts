import type { Player } from '@shamoo/commands';
import { miniMessage, type PaperCommandContext } from '@shamoo/paper';

import { ManagedLobbyHostError, type ManagedLobbyExecuteAction } from '../api/managed-lobby.js';
import { shaLobbyHandler } from '../composition.js';
import { logError, logInfo } from '../messages/console-logger.js';
import type { CommandMessageKey, MessageValues } from '../messages/message-catalog.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const ID = /^[a-z][a-z0-9_-]{0,63}$/u;
const PERMISSION = /^[A-Za-z0-9._-]{1,128}$/u;

export interface CommandReply {
  readonly key: CommandMessageKey;
  readonly values?: MessageValues;
}

class PlayerContextError extends Error {
  public constructor() {
    super('A canonical player UUID is required.');
    this.name = 'PlayerContextError';
  }
}

class CommandInputError extends Error {
  public constructor() {
    super('The command contains invalid arguments.');
    this.name = 'CommandInputError';
  }
}

export function requirePlayerUuid(context: PaperCommandContext, player?: Player): string {
  const id =
    player?.id ??
    (context.sender.kind === 'player' && typeof context.sender.id === 'string'
      ? context.sender.id
      : undefined);
  if (id === undefined || !UUID.test(id)) throw new PlayerContextError();
  return id;
}

export function displayName(context: PaperCommandContext, player?: Player): string {
  return player?.name ?? context.sender.name;
}

export function inputId(value: string): string {
  if (!ID.test(value)) throw new CommandInputError();
  return value;
}

export function inputPermission(value: string | undefined): string | undefined {
  if (value !== undefined && !PERMISSION.test(value)) throw new CommandInputError();
  return value;
}

export function inputInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < minimum || value > maximum)) {
    throw new CommandInputError();
  }
  return value;
}

export async function runCommand(
  context: PaperCommandContext,
  command: string,
  operation: () => Promise<CommandReply> | CommandReply,
): Promise<void> {
  try {
    const response = await operation();
    await reply(context, response.key, response.values);
    logInfo('command-succeeded', { command, sender: context.sender.name });
  } catch (error: unknown) {
    if (error instanceof CommandInputError) {
      logInfo('command-rejected', {
        command,
        reason: 'invalid-arguments',
        sender: context.sender.name,
      });
    } else {
      logError('command-failed', error, { command, sender: context.sender.name });
    }
    await reply(context, failureMessage(error));
  }
}

export async function execute(
  action: ManagedLobbyExecuteAction,
  response: CommandReply,
): Promise<CommandReply> {
  await shaLobbyHandler.managedLobby.execute(action);
  return response;
}

async function reply(
  context: PaperCommandContext,
  key: CommandMessageKey,
  values: MessageValues = {},
): Promise<void> {
  try {
    await context.reply(miniMessage(shaLobbyHandler.messages.render(key, values)));
  } catch (error: unknown) {
    logError('command-reply-failed', error, {
      alias: context.alias,
      sender: context.sender.name,
    });
  }
}

function failureMessage(error: unknown): CommandMessageKey {
  if (error instanceof PlayerContextError) return 'player-required';
  if (error instanceof CommandInputError) return 'invalid-arguments';
  if (error instanceof ManagedLobbyHostError) {
    if (error.state === 'unavailable') return 'unavailable';
    if (error.state === 'unknown') return 'unknown';
    if (error.state === 'invalid') return 'invalid';
    if (error.state === 'overloaded') return 'overloaded';
  }
  return 'command-error';
}
