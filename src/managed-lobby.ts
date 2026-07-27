export const MANAGED_LOBBY_FILES = Object.freeze([
  'config.yml',
  'messages.yml',
  'items.yml',
  'menus.yml',
  'scoreboard.yml',
  'servers.yml',
  'spawn.yml',
  'portals.yml',
] as const);

export type ManagedLobbyData =
  | null
  | boolean
  | number
  | string
  | readonly ManagedLobbyData[]
  | ManagedLobbyDataRecord;

export interface ManagedLobbyDataRecord {
  readonly [key: string]: ManagedLobbyData;
}

export type ManagedLobbyExecuteAction =
  | { readonly action: 'setspawn'; readonly player: string }
  | { readonly action: 'spawn'; readonly player: string }
  | { readonly action: 'items'; readonly player: string }
  | { readonly action: 'menu'; readonly player: string; readonly id: string }
  | { readonly action: 'portal-wand'; readonly player: string }
  | { readonly action: 'portal-pos1'; readonly player: string }
  | { readonly action: 'portal-pos2'; readonly player: string }
  | {
      readonly action: 'portal-create';
      readonly player: string;
      readonly id: string;
      readonly destination?: string;
      readonly permission?: string;
      readonly priority?: number;
      readonly 'cooldown-ms'?: number;
      readonly enabled?: boolean;
      readonly visualize?: boolean;
    }
  | { readonly action: 'portal-remove'; readonly player: string; readonly id: string }
  | { readonly action: 'portal-list' }
  | { readonly action: 'portal-info'; readonly id: string }
  | { readonly action: 'portal-enable'; readonly player: string; readonly id: string }
  | { readonly action: 'portal-disable'; readonly player: string; readonly id: string }
  | ({
      readonly action: 'portal-destination';
      readonly player: string;
      readonly id: string;
    } & (
      | { readonly type: 'server' | 'menu'; readonly target: string }
      | { readonly type: 'spawn'; readonly target?: never }
    ))
  | { readonly action: 'portal-visualize'; readonly player: string; readonly enabled: boolean };

export type ManagedLobbyRequest =
  | { readonly operation: 'ensure' }
  | { readonly operation: 'reload' }
  | { readonly operation: 'status' }
  | ({ readonly operation: 'execute' } & ManagedLobbyExecuteAction);

export type ManagedLobbySuccess = ManagedLobbyDataRecord & {
  readonly ok: true;
  readonly state: string;
  readonly error?: never;
};

export type ManagedLobbyFailure = ManagedLobbyDataRecord & {
  readonly ok: false;
  readonly state: string;
  readonly error: string;
};

export type ManagedLobbyResult = ManagedLobbySuccess | ManagedLobbyFailure;
export type ManagedLobbyTransport = (request: ManagedLobbyRequest) => Promise<ManagedLobbyResult>;

type ManagedLobbyFile = (typeof MANAGED_LOBBY_FILES)[number];

export type ManagedLobbyPortalAction =
  | { readonly type: 'none' | 'spawn' }
  | {
      readonly type: 'connect' | 'menu' | 'particle' | 'sound' | 'title';
      readonly target: string;
    }
  | { readonly type: 'visibility'; readonly target: 'all' | 'cycle' | 'none' | 'staff' };

export interface ManagedLobbyCoordinate extends ManagedLobbyDataRecord {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ManagedLobbyPortal extends ManagedLobbyDataRecord {
  readonly id: string;
  readonly enabled: boolean;
  readonly world: string;
  readonly min: ManagedLobbyCoordinate;
  readonly max: ManagedLobbyCoordinate;
  readonly permission?: string;
  readonly priority: number;
  readonly 'cooldown-ms': number;
  readonly destination?: string;
  readonly action: ManagedLobbyPortalAction;
  readonly visualize: boolean;
}

export type ManagedLobbyEnsureSuccess = ManagedLobbySuccess & {
  readonly state: 'ensured';
  readonly files: readonly ManagedLobbyFile[];
  readonly directory: string;
};

export type ManagedLobbyReloadSuccess = ManagedLobbySuccess & {
  readonly state: 'reloaded';
  readonly files: readonly ManagedLobbyFile[];
  readonly messagesContent: string;
  readonly spawnConfigured: boolean;
  readonly items: number;
  readonly menus: number;
  readonly servers: number;
  readonly portals: number;
};

type ManagedLobbyStatusBase = ManagedLobbySuccess & {
  readonly generation: string;
  readonly active: boolean;
  readonly invocationAdmissionOpen: boolean;
  readonly pendingActions: number;
  readonly maximumPendingActions: number;
  readonly directory: string;
  readonly files: readonly ManagedLobbyFile[];
};

export type ManagedLobbyStatusSuccess = ManagedLobbyStatusBase &
  (
    | { readonly state: 'uninitialized'; readonly active: false }
    | {
        readonly state: 'ready' | 'standby';
        readonly spawnConfigured: boolean;
        readonly items: number;
        readonly menus: number;
        readonly servers: number;
        readonly portals: number;
      }
  );

export type ManagedLobbyPortalPositionSuccess = ManagedLobbySuccess & {
  readonly state: 'portal-pos1' | 'portal-pos2';
  readonly position: ManagedLobbyCoordinate & { readonly world: string };
  readonly message: string;
};

export type ManagedLobbyPortalListSuccess = ManagedLobbySuccess & {
  readonly state: 'portal-list';
  readonly portals: readonly ManagedLobbyPortal[];
  readonly count: number;
  readonly message: string;
};

export type ManagedLobbyPortalInfoSuccess = ManagedLobbySuccess & {
  readonly state: 'portal-info';
  readonly portal: ManagedLobbyPortal;
  readonly message: string;
};

interface CopyState {
  nodes: number;
  readonly ancestors: Set<object>;
}

type DataRecord = Readonly<Record<string, unknown>>;

const MAX_DATA_DEPTH = 32;
const MAX_DATA_NODES = 100_000;
const MAX_COLLECTION_SIZE = 10_000;
const MAX_TEXT_LENGTH = 1_048_576;
const ID = /^[a-z][a-z0-9_-]{0,63}$/u;
const PERMISSION = /^[A-Za-z0-9._-]{1,128}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export class ManagedLobbyUnavailableError extends Error {
  public readonly code = 'MANAGED_LOBBY_UNAVAILABLE';

  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ManagedLobbyUnavailableError';
  }
}

export class ManagedLobbyProtocolError extends Error {
  public readonly code = 'MANAGED_LOBBY_PROTOCOL_ERROR';

  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ManagedLobbyProtocolError';
  }
}

export class ManagedLobbyHostError extends Error {
  public readonly code = 'MANAGED_LOBBY_HOST_FAILURE';

  public constructor(
    public readonly state: string,
    message: string,
  ) {
    super(message);
    this.name = 'ManagedLobbyHostError';
  }
}

export class ManagedLobbyResponseError extends Error {
  public readonly code = 'MANAGED_LOBBY_RESPONSE_INVALID';

  public constructor(message: string) {
    super(message);
    this.name = 'ManagedLobbyResponseError';
  }
}

function protocol(message: string): never {
  throw new ManagedLobbyProtocolError(message);
}

function copyData(value: unknown, label: string, state: CopyState, depth = 0): ManagedLobbyData {
  state.nodes += 1;
  if (state.nodes > MAX_DATA_NODES) protocol(`${label} contains too many values.`);
  if (depth > MAX_DATA_DEPTH) protocol(`${label} nesting exceeds ${String(MAX_DATA_DEPTH)}.`);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.length > MAX_TEXT_LENGTH) protocol(`${label} contains oversized text.`);
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) protocol(`${label} numbers must be finite.`);
    return value;
  }
  if (typeof value !== 'object') protocol(`${label} must contain only JSON-compatible data.`);
  if (state.ancestors.has(value)) protocol(`${label} must not contain cycles.`);

  const isArray = Array.isArray(value);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (
    (isArray && prototype !== Array.prototype) ||
    (!isArray && prototype !== Object.prototype && prototype !== null)
  ) {
    protocol(`${label} must contain only arrays and plain objects.`);
  }

  const keys = Reflect.ownKeys(value);
  if (keys.length > MAX_COLLECTION_SIZE) protocol(`${label} contains an oversized collection.`);
  if (keys.some((key) => typeof key !== 'string')) protocol(`${label} requires string keys.`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    (keys as string[]).some((key) => {
      if (isArray && key === 'length') return false;
      const descriptor = descriptors[key];
      return (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !('value' in descriptor) ||
        descriptor.value === undefined
      );
    })
  ) {
    protocol(`${label} cannot contain accessors, non-enumerable properties, or undefined.`);
  }

  state.ancestors.add(value);
  try {
    if (isArray) {
      if (keys.some((key) => key !== 'length' && !/^(0|[1-9][0-9]*)$/u.test(key as string))) {
        protocol(`${label} arrays cannot have named properties.`);
      }
      if (Object.keys(value).length !== value.length) {
        protocol(`${label} arrays cannot contain empty slots.`);
      }
      return Object.freeze(
        Array.from({ length: value.length }, (_, index) =>
          copyData(descriptors[String(index)]?.value, label, state, depth + 1),
        ),
      );
    }

    const copied: Record<string, ManagedLobbyData> = {};
    for (const key of keys as string[]) {
      Object.defineProperty(copied, key, {
        value: copyData(descriptors[key]?.value, label, state, depth + 1),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return Object.freeze(copied);
  } finally {
    state.ancestors.delete(value);
  }
}

function copiedData(value: unknown, label: string): ManagedLobbyData {
  try {
    return copyData(value, label, { nodes: 0, ancestors: new Set() });
  } catch (cause: unknown) {
    if (cause instanceof ManagedLobbyProtocolError) throw cause;
    throw new ManagedLobbyProtocolError(`Unable to inspect ${label}.`, { cause });
  }
}

function record(value: unknown, path: string): DataRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    protocol(`${path} must be an object.`);
  }
  return value as DataRecord;
}

function exact(value: DataRecord, allowed: readonly string[], path: string): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown !== undefined) protocol(`${path} contains unknown key: ${unknown}.`);
}

function text(value: unknown, path: string, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximum) {
    protocol(`${path} must be bounded nonblank text.`);
  }
  return value;
}

function identifier(value: unknown, path: string): void {
  if (!ID.test(text(value, path, 64))) {
    protocol(`${path} must be a bounded lowercase identifier.`);
  }
}

function uuid(value: unknown, path: string): void {
  if (typeof value !== 'string' || !UUID.test(value)) {
    protocol(`${path} must be a canonical UUID.`);
  }
}

function bool(value: unknown, path: string): void {
  if (typeof value !== 'boolean') protocol(`${path} must be a boolean.`);
}

function optionalInteger(value: unknown, path: string, minimum: number, maximum: number): void {
  if (
    value !== undefined &&
    (typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < minimum ||
      value > maximum)
  ) {
    protocol(`${path} must be an integer from ${String(minimum)} through ${String(maximum)}.`);
  }
}

function optionalBoolean(value: unknown, path: string): void {
  if (value !== undefined) bool(value, path);
}

function playerAndId(value: DataRecord, path: string): void {
  exact(value, ['operation', 'action', 'player', 'id'], path);
  uuid(value['player'], `${path}.player`);
  identifier(value['id'], `${path}.id`);
}

function validateExecute(value: DataRecord, path: string): void {
  const action = text(value['action'], `${path}.action`, 32);
  if (action === 'setspawn' || action === 'spawn' || action === 'items') {
    exact(value, ['operation', 'action', 'player'], path);
    uuid(value['player'], `${path}.player`);
  } else if (action === 'menu') {
    playerAndId(value, path);
  } else if (action === 'portal-wand' || action === 'portal-pos1' || action === 'portal-pos2') {
    exact(value, ['operation', 'action', 'player'], path);
    uuid(value['player'], `${path}.player`);
  } else if (action === 'portal-create') {
    exact(
      value,
      [
        'operation',
        'action',
        'player',
        'id',
        'destination',
        'permission',
        'priority',
        'cooldown-ms',
        'enabled',
        'visualize',
      ],
      path,
    );
    uuid(value['player'], `${path}.player`);
    identifier(value['id'], `${path}.id`);
    if (value['destination'] !== undefined) {
      identifier(value['destination'], `${path}.destination`);
    }
    if (value['permission'] !== undefined) {
      const permission = text(value['permission'], `${path}.permission`, 128);
      if (!PERMISSION.test(permission)) protocol(`${path}.permission must be a permission node.`);
    }
    optionalInteger(value['priority'], `${path}.priority`, -10_000, 10_000);
    optionalInteger(value['cooldown-ms'], `${path}.cooldown-ms`, 0, 600_000);
    optionalBoolean(value['enabled'], `${path}.enabled`);
    optionalBoolean(value['visualize'], `${path}.visualize`);
  } else if (
    action === 'portal-remove' ||
    action === 'portal-enable' ||
    action === 'portal-disable'
  ) {
    playerAndId(value, path);
  } else if (action === 'portal-list') {
    exact(value, ['operation', 'action'], path);
  } else if (action === 'portal-info') {
    exact(value, ['operation', 'action', 'id'], path);
    identifier(value['id'], `${path}.id`);
  } else if (action === 'portal-destination') {
    exact(value, ['operation', 'action', 'player', 'id', 'type', 'target'], path);
    uuid(value['player'], `${path}.player`);
    identifier(value['id'], `${path}.id`);
    const type = value['type'];
    if (type !== 'server' && type !== 'spawn' && type !== 'menu') {
      protocol(`${path}.type must be server, spawn, or menu.`);
    }
    if (type === 'spawn') {
      if (Object.hasOwn(value, 'target')) protocol(`${path}.target is not accepted for spawn.`);
    } else {
      identifier(value['target'], `${path}.target`);
    }
  } else if (action === 'portal-visualize') {
    exact(value, ['operation', 'action', 'player', 'enabled'], path);
    uuid(value['player'], `${path}.player`);
    bool(value['enabled'], `${path}.enabled`);
  } else {
    protocol(`${path}.action is unknown: ${action}.`);
  }
}

function validateRequest(value: ManagedLobbyData): ManagedLobbyRequest {
  const request = record(value, 'Managed-lobby request');
  const operation = text(request['operation'], 'Managed-lobby request.operation', 32);
  if (operation === 'status' || operation === 'ensure' || operation === 'reload') {
    exact(request, ['operation'], 'Managed-lobby request');
  } else if (operation === 'execute') {
    validateExecute(request, 'Managed-lobby request');
  } else {
    protocol(`Managed-lobby request.operation is unknown: ${operation}.`);
  }
  return request as unknown as ManagedLobbyRequest;
}

function validateResult(value: ManagedLobbyData): ManagedLobbyResult {
  const result = record(value, 'Managed-lobby result');
  bool(result['ok'], 'Managed-lobby result.ok');
  text(result['state'], 'Managed-lobby result.state', 128);
  if (result['ok'] === false) {
    text(result['error'], 'Managed-lobby result.error', 512);
  } else if (Object.hasOwn(result, 'error')) {
    protocol('Successful managed-lobby results must not contain error.');
  }
  return result as unknown as ManagedLobbyResult;
}

function invalidResponse(message: string): never {
  throw new ManagedLobbyResponseError(message);
}

function responseRecord(value: unknown, path: string): DataRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalidResponse(`${path} must be an object.`);
  }
  return value as DataRecord;
}

function responseExact(value: DataRecord, allowed: readonly string[], path: string): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown !== undefined) invalidResponse(`${path} contains unknown key: ${unknown}.`);
}

function responseText(value: unknown, path: string, maximum: number, allowEmpty = false): string {
  if (
    typeof value !== 'string' ||
    (!allowEmpty && value.trim().length === 0) ||
    value.length > maximum
  ) {
    invalidResponse(`${path} must be bounded text.`);
  }
  return value;
}

function responseBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalidResponse(`${path} must be a boolean.`);
  return value;
}

function responseNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    invalidResponse(
      `${path} must be a finite number from ${String(minimum)} through ${String(maximum)}.`,
    );
  }
  return value;
}

function responseInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  const result = responseNumber(value, path, minimum, maximum);
  if (!Number.isSafeInteger(result)) invalidResponse(`${path} must be an integer.`);
  return result;
}

function responseIdentifier(value: unknown, path: string): string {
  const result = responseText(value, path, 64);
  if (!ID.test(result)) invalidResponse(`${path} must be a bounded lowercase identifier.`);
  return result;
}

function responseUuid(value: unknown, path: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    invalidResponse(`${path} must be a canonical UUID.`);
  }
  return value;
}

function responseState(result: ManagedLobbySuccess, expected: string): void {
  const state = responseText(result.state, 'Managed-lobby success.state', 128);
  if (state !== expected) invalidResponse(`Managed-lobby success.state must be ${expected}.`);
}

function responseFiles(value: unknown, path: string): readonly ManagedLobbyFile[] {
  if (!Array.isArray(value) || value.length !== MANAGED_LOBBY_FILES.length) {
    invalidResponse(`${path} must contain the eight managed lobby files.`);
  }
  for (const [index, file] of MANAGED_LOBBY_FILES.entries()) {
    if (value[index] !== file) invalidResponse(`${path} must use canonical file order.`);
  }
  return value as readonly ManagedLobbyFile[];
}

function responseMessageContent(value: unknown): string {
  const content = responseText(
    value,
    'Managed-lobby reload.messagesContent',
    MAX_TEXT_LENGTH,
    true,
  );
  if (new TextEncoder().encode(content).length > MAX_TEXT_LENGTH) {
    invalidResponse('Managed-lobby reload.messagesContent exceeds 1 MiB as UTF-8.');
  }
  return content;
}

function responseMessage(value: unknown, path: string): string {
  return responseText(value, path, 512);
}

function responseCoordinate(value: unknown, path: string): ManagedLobbyCoordinate {
  const coordinate = responseRecord(value, path);
  responseExact(coordinate, ['x', 'y', 'z'], path);
  responseNumber(coordinate['x'], `${path}.x`, -30_000_000, 30_000_000);
  responseNumber(coordinate['y'], `${path}.y`, -2_048, 2_048);
  responseNumber(coordinate['z'], `${path}.z`, -30_000_000, 30_000_000);
  return coordinate as unknown as ManagedLobbyCoordinate;
}

function responseAction(value: unknown, path: string): ManagedLobbyPortalAction {
  const action = responseRecord(value, path);
  const type = responseText(action['type'], `${path}.type`, 16);
  if (type === 'none' || type === 'spawn') {
    responseExact(action, ['type'], path);
  } else if (
    type === 'connect' ||
    type === 'menu' ||
    type === 'particle' ||
    type === 'sound' ||
    type === 'title'
  ) {
    responseExact(action, ['type', 'target'], path);
    responseIdentifier(action['target'], `${path}.target`);
  } else if (type === 'visibility') {
    responseExact(action, ['type', 'target'], path);
    if (
      action['target'] !== 'all' &&
      action['target'] !== 'cycle' &&
      action['target'] !== 'none' &&
      action['target'] !== 'staff'
    ) {
      invalidResponse(`${path}.target must be all, cycle, none, or staff.`);
    }
  } else {
    invalidResponse(`${path}.type is unsupported.`);
  }
  return action as unknown as ManagedLobbyPortalAction;
}

function responsePortal(value: unknown, path: string): ManagedLobbyPortal {
  const portal = responseRecord(value, path);
  responseExact(
    portal,
    [
      'id',
      'enabled',
      'world',
      'min',
      'max',
      'permission',
      'priority',
      'cooldown-ms',
      'destination',
      'action',
      'visualize',
    ],
    path,
  );
  responseIdentifier(portal['id'], `${path}.id`);
  responseBoolean(portal['enabled'], `${path}.enabled`);
  responseText(portal['world'], `${path}.world`, 64);
  const minimum = responseCoordinate(portal['min'], `${path}.min`);
  const maximum = responseCoordinate(portal['max'], `${path}.max`);
  if (minimum.x > maximum.x || minimum.y > maximum.y || minimum.z > maximum.z) {
    invalidResponse(`${path} minimum coordinates must not exceed maximum coordinates.`);
  }
  if (Object.hasOwn(portal, 'permission')) {
    const permission = responseText(portal['permission'], `${path}.permission`, 128);
    if (!PERMISSION.test(permission))
      invalidResponse(`${path}.permission must be a permission node.`);
  }
  responseInteger(portal['priority'], `${path}.priority`, -10_000, 10_000);
  responseInteger(portal['cooldown-ms'], `${path}.cooldown-ms`, 0, 600_000);
  if (Object.hasOwn(portal, 'destination')) {
    responseIdentifier(portal['destination'], `${path}.destination`);
  }
  const action = responseAction(portal['action'], `${path}.action`);
  if (
    Object.hasOwn(portal, 'destination') &&
    (action.type !== 'connect' || action.target !== portal['destination'])
  ) {
    invalidResponse(`${path}.destination must match its connect action.`);
  }
  responseBoolean(portal['visualize'], `${path}.visualize`);
  return portal as unknown as ManagedLobbyPortal;
}

function responseCounts(result: ManagedLobbySuccess, path: string): void {
  responseBoolean(result['spawnConfigured'], `${path}.spawnConfigured`);
  responseInteger(result['items'], `${path}.items`, 0, 36);
  responseInteger(result['menus'], `${path}.menus`, 0, 64);
  responseInteger(result['servers'], `${path}.servers`, 0, 64);
  responseInteger(result['portals'], `${path}.portals`, 0, 256);
}

function validateEnsureSuccess(
  result: ManagedLobbySuccess,
): asserts result is ManagedLobbyEnsureSuccess {
  responseExact(result, ['ok', 'state', 'files', 'directory'], 'Managed-lobby ensure success');
  responseState(result, 'ensured');
  responseFiles(result['files'], 'Managed-lobby ensure.files');
  responseText(result['directory'], 'Managed-lobby ensure.directory', 512);
}

function validateReloadSuccess(
  result: ManagedLobbySuccess,
): asserts result is ManagedLobbyReloadSuccess {
  responseExact(
    result,
    [
      'ok',
      'state',
      'files',
      'messagesContent',
      'spawnConfigured',
      'items',
      'menus',
      'servers',
      'portals',
    ],
    'Managed-lobby reload success',
  );
  responseState(result, 'reloaded');
  responseFiles(result['files'], 'Managed-lobby reload.files');
  responseMessageContent(result['messagesContent']);
  responseCounts(result, 'Managed-lobby reload');
}

function validateStatusSuccess(
  result: ManagedLobbySuccess,
): asserts result is ManagedLobbyStatusSuccess {
  const common = [
    'ok',
    'state',
    'generation',
    'active',
    'invocationAdmissionOpen',
    'pendingActions',
    'maximumPendingActions',
    'directory',
    'files',
  ] as const;
  if (result.state === 'uninitialized') {
    responseExact(result, common, 'Managed-lobby status success');
  } else if (result.state === 'ready' || result.state === 'standby') {
    responseExact(
      result,
      [...common, 'spawnConfigured', 'items', 'menus', 'servers', 'portals'],
      'Managed-lobby status success',
    );
  } else {
    invalidResponse('Managed-lobby status.state must be uninitialized, ready, or standby.');
  }
  responseUuid(result['generation'], 'Managed-lobby status.generation');
  const active = responseBoolean(result['active'], 'Managed-lobby status.active');
  if ((result.state === 'ready') !== active) {
    invalidResponse('Managed-lobby status.state must match active.');
  }
  responseBoolean(
    result['invocationAdmissionOpen'],
    'Managed-lobby status.invocationAdmissionOpen',
  );
  const pending = responseInteger(
    result['pendingActions'],
    'Managed-lobby status.pendingActions',
    0,
    4_096,
  );
  const maximum = responseInteger(
    result['maximumPendingActions'],
    'Managed-lobby status.maximumPendingActions',
    1,
    4_096,
  );
  if (pending > maximum)
    invalidResponse('Managed-lobby status.pendingActions exceeds its maximum.');
  responseText(result['directory'], 'Managed-lobby status.directory', 512);
  responseFiles(result['files'], 'Managed-lobby status.files');
  if (result.state !== 'uninitialized') responseCounts(result, 'Managed-lobby status');
}

function validatePortalPositionSuccess(
  result: ManagedLobbySuccess,
  expected: 'portal-pos1' | 'portal-pos2',
): asserts result is ManagedLobbyPortalPositionSuccess {
  const path = `Managed-lobby ${expected}`;
  responseExact(result, ['ok', 'state', 'position', 'message'], `${path} success`);
  responseState(result, expected);
  const position = responseRecord(result['position'], `${path}.position`);
  responseExact(position, ['world', 'x', 'y', 'z'], `${path}.position`);
  responseText(position['world'], `${path}.position.world`, 64);
  responseInteger(position['x'], `${path}.position.x`, -30_000_000, 30_000_000);
  responseInteger(position['y'], `${path}.position.y`, -2_048, 2_048);
  responseInteger(position['z'], `${path}.position.z`, -30_000_000, 30_000_000);
  responseMessage(result['message'], `${path}.message`);
}

function validatePortalListSuccess(
  result: ManagedLobbySuccess,
): asserts result is ManagedLobbyPortalListSuccess {
  responseExact(
    result,
    ['ok', 'state', 'portals', 'count', 'message'],
    'Managed-lobby portal-list success',
  );
  responseState(result, 'portal-list');
  if (!Array.isArray(result['portals']) || result['portals'].length > 256) {
    invalidResponse('Managed-lobby portal-list.portals must be a bounded array.');
  }
  result['portals'].forEach((portal, index) =>
    responsePortal(portal, `Managed-lobby portal-list.portals[${String(index)}]`),
  );
  const count = responseInteger(result['count'], 'Managed-lobby portal-list.count', 0, 256);
  if (count !== result['portals'].length) {
    invalidResponse('Managed-lobby portal-list.count must match portals length.');
  }
  responseMessage(result['message'], 'Managed-lobby portal-list.message');
}

function validatePortalInfoSuccess(
  result: ManagedLobbySuccess,
  requested: string,
): asserts result is ManagedLobbyPortalInfoSuccess {
  responseExact(result, ['ok', 'state', 'portal', 'message'], 'Managed-lobby portal-info success');
  responseState(result, 'portal-info');
  const portal = responsePortal(result['portal'], 'Managed-lobby portal-info.portal');
  if (portal.id !== requested)
    invalidResponse('Managed-lobby portal-info returned the wrong portal.');
  responseMessage(result['message'], 'Managed-lobby portal-info.message');
}

type PortalMutationAction = Extract<
  ManagedLobbyExecuteAction,
  {
    readonly action:
      | 'portal-create'
      | 'portal-destination'
      | 'portal-disable'
      | 'portal-enable'
      | 'portal-remove';
  }
>;

function validatePortalMutationSuccess(
  result: ManagedLobbySuccess,
  action: PortalMutationAction,
): void {
  const expected =
    action.action === 'portal-remove'
      ? 'portal-removed'
      : action.action === 'portal-create'
        ? 'portal-created'
        : action.action === 'portal-enable'
          ? 'portal-enabled'
          : action.action === 'portal-disable'
            ? 'portal-disabled'
            : 'portal-destination';
  responseExact(result, ['ok', 'state', 'portal', 'message'], `Managed-lobby ${expected} success`);
  responseState(result, expected);
  const portal = responsePortal(result['portal'], `Managed-lobby ${expected}.portal`);
  if (portal.id !== action.id)
    invalidResponse(`Managed-lobby ${expected} returned the wrong portal.`);
  if (action.action === 'portal-create') {
    if (action.destination === undefined) {
      if (portal.destination !== undefined || portal.action.type !== 'none') {
        invalidResponse('Managed-lobby portal-create destination does not match the request.');
      }
    } else if (
      portal.destination !== action.destination ||
      portal.action.type !== 'connect' ||
      portal.action.target !== action.destination
    ) {
      invalidResponse('Managed-lobby portal-create destination does not match the request.');
    }
    if (action.permission !== undefined && portal.permission !== action.permission) {
      invalidResponse('Managed-lobby portal-create permission does not match the request.');
    }
    if (action.priority !== undefined && portal.priority !== action.priority) {
      invalidResponse('Managed-lobby portal-create priority does not match the request.');
    }
    if (action['cooldown-ms'] !== undefined && portal['cooldown-ms'] !== action['cooldown-ms']) {
      invalidResponse('Managed-lobby portal-create cooldown does not match the request.');
    }
    if (action.enabled !== undefined && portal.enabled !== action.enabled) {
      invalidResponse('Managed-lobby portal-create enabled state does not match the request.');
    }
    if (action.visualize !== undefined && portal.visualize !== action.visualize) {
      invalidResponse('Managed-lobby portal-create visualization does not match the request.');
    }
  }
  if (action.action === 'portal-enable' && !portal.enabled) {
    invalidResponse('Managed-lobby portal-enable did not enable the portal.');
  }
  if (action.action === 'portal-disable' && portal.enabled) {
    invalidResponse('Managed-lobby portal-disable did not disable the portal.');
  }
  if (action.action === 'portal-destination') {
    if (action.type === 'spawn') {
      if (portal.action.type !== 'spawn' || portal.destination !== undefined) {
        invalidResponse('Managed-lobby spawn destination response does not match the request.');
      }
    } else if (
      portal.action.type !== (action.type === 'server' ? 'connect' : 'menu') ||
      portal.action.target !== action.target ||
      (action.type === 'server'
        ? portal.destination !== action.target
        : portal.destination !== undefined)
    ) {
      invalidResponse('Managed-lobby portal destination response does not match the request.');
    }
  }
  responseMessage(result['message'], `Managed-lobby ${expected}.message`);
}

function validateExecuteSuccess(
  result: ManagedLobbySuccess,
  action: ManagedLobbyExecuteAction,
): void {
  if (action.action === 'setspawn') {
    responseExact(
      result,
      ['ok', 'state', 'world', 'x', 'y', 'z'],
      'Managed-lobby spawn-set success',
    );
    responseState(result, 'spawn-set');
    responseText(result['world'], 'Managed-lobby spawn-set.world', 64);
    responseNumber(result['x'], 'Managed-lobby spawn-set.x', -30_000_000, 30_000_000);
    responseNumber(result['y'], 'Managed-lobby spawn-set.y', -2_048, 2_048);
    responseNumber(result['z'], 'Managed-lobby spawn-set.z', -30_000_000, 30_000_000);
  } else if (action.action === 'spawn' || action.action === 'items') {
    const expected = action.action === 'spawn' ? 'spawn-requested' : 'items-restored';
    responseExact(result, ['ok', 'state', 'player'], `Managed-lobby ${expected} success`);
    responseState(result, expected);
    if (responseUuid(result['player'], `Managed-lobby ${expected}.player`) !== action.player) {
      invalidResponse(`Managed-lobby ${expected} returned the wrong player.`);
    }
  } else if (action.action === 'menu') {
    responseExact(result, ['ok', 'state', 'id'], 'Managed-lobby menu-opened success');
    responseState(result, 'menu-opened');
    if (responseIdentifier(result['id'], 'Managed-lobby menu-opened.id') !== action.id) {
      invalidResponse('Managed-lobby menu-opened returned the wrong menu.');
    }
  } else if (action.action === 'portal-wand') {
    responseExact(result, ['ok', 'state', 'message'], 'Managed-lobby portal-wand success');
    responseState(result, 'portal-wand');
    responseMessage(result['message'], 'Managed-lobby portal-wand.message');
  } else if (action.action === 'portal-pos1' || action.action === 'portal-pos2') {
    validatePortalPositionSuccess(result, action.action);
  } else if (action.action === 'portal-list') {
    validatePortalListSuccess(result);
  } else if (action.action === 'portal-info') {
    validatePortalInfoSuccess(result, action.id);
  } else if (action.action === 'portal-visualize') {
    responseExact(
      result,
      ['ok', 'state', 'enabled', 'message'],
      'Managed-lobby portal-visualization success',
    );
    responseState(result, 'portal-visualization-updated');
    if (
      responseBoolean(result['enabled'], 'Managed-lobby portal-visualization.enabled') !==
      action.enabled
    ) {
      invalidResponse('Managed-lobby portal visualization response does not match the request.');
    }
    responseMessage(result['message'], 'Managed-lobby portal-visualization.message');
  } else {
    validatePortalMutationSuccess(result, action);
  }
}

function managedLobbyHost(): {
  readonly host: object;
  readonly operation: (...values: readonly unknown[]) => unknown;
} {
  let host: unknown;
  try {
    host = Reflect.get(globalThis, 'host');
  } catch (cause: unknown) {
    throw new ManagedLobbyUnavailableError('Unable to resolve the Shamoo Runtime host.', { cause });
  }
  if (host === null || (typeof host !== 'object' && typeof host !== 'function')) {
    throw new ManagedLobbyUnavailableError('Shamoo Runtime host is unavailable.');
  }

  let operation: unknown;
  try {
    operation = Reflect.get(host, 'paperManagedLobby');
  } catch (cause: unknown) {
    throw new ManagedLobbyUnavailableError('Managed-lobby host operation is unavailable.', {
      cause,
    });
  }
  if (typeof operation !== 'function') {
    throw new ManagedLobbyUnavailableError('Managed-lobby host operation is unavailable.');
  }
  return { host, operation: operation as (...values: readonly unknown[]) => unknown };
}

/**
 * Direct adapter for the coordinated Runtime bridge. It can switch back to @shamoo/paper after
 * matching managed-lobby declarations and Runtime support are published together.
 */
export function paperManagedLobby(request: ManagedLobbyRequest): Promise<ManagedLobbyResult> {
  const safeRequest = validateRequest(copiedData(request, 'Managed-lobby request'));
  const { host, operation } = managedLobbyHost();
  const pending = Reflect.apply(operation, host, [safeRequest]);
  if (!(pending instanceof Promise)) {
    throw new ManagedLobbyProtocolError('Managed-lobby host operation must return a Promise.');
  }
  return pending.then((value: unknown) =>
    validateResult(copiedData(value, 'Managed-lobby result')),
  );
}

export class ManagedLobbyClient {
  public constructor(private readonly transport: ManagedLobbyTransport = paperManagedLobby) {}

  private async request(request: ManagedLobbyRequest): Promise<ManagedLobbySuccess> {
    const result = validateResult(
      copiedData(await this.transport(request), 'Managed-lobby client result'),
    );
    if (!result.ok) throw new ManagedLobbyHostError(result.state, result.error);
    return result;
  }

  public async ensure(): Promise<ManagedLobbyEnsureSuccess> {
    const result = await this.request({ operation: 'ensure' });
    validateEnsureSuccess(result);
    return result;
  }

  public async reload(): Promise<ManagedLobbyReloadSuccess> {
    const result = await this.request({ operation: 'reload' });
    validateReloadSuccess(result);
    return result;
  }

  public async status(): Promise<ManagedLobbyStatusSuccess> {
    const result = await this.request({ operation: 'status' });
    validateStatusSuccess(result);
    return result;
  }

  public execute(
    action: Extract<ManagedLobbyExecuteAction, { readonly action: 'portal-list' }>,
  ): Promise<ManagedLobbyPortalListSuccess>;
  public execute(
    action: Extract<ManagedLobbyExecuteAction, { readonly action: 'portal-info' }>,
  ): Promise<ManagedLobbyPortalInfoSuccess>;
  public execute(
    action: Extract<ManagedLobbyExecuteAction, { readonly action: 'portal-pos1' | 'portal-pos2' }>,
  ): Promise<ManagedLobbyPortalPositionSuccess>;
  public execute(action: ManagedLobbyExecuteAction): Promise<ManagedLobbySuccess>;
  public async execute(action: ManagedLobbyExecuteAction): Promise<ManagedLobbySuccess> {
    const result = await this.request({ operation: 'execute', ...action });
    validateExecuteSuccess(result, action);
    return result;
  }
}
