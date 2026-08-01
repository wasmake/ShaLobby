import type { PortalDestinationProvider, PortalProvider } from '../api/portal-provider.js';
import type { LobbyPortal } from '../configuration/portals.js';
import { selectPortal, type LobbyPosition } from './portal-rules.js';
import type { PortalSessionManager } from './portal-session-manager.js';

export interface PortalCreateInput {
  readonly id: string;
  readonly destination?: string;
  readonly permission?: string;
  readonly priority?: number;
  readonly 'cooldown-ms'?: number;
  readonly enabled?: boolean;
  readonly visualize?: boolean;
}

export type PortalDestinationInput =
  | { readonly type: 'spawn' }
  | { readonly type: 'server' | 'menu'; readonly target: string };

export class PortalManager {
  public constructor(
    private readonly provider: PortalProvider,
    private readonly destinations: PortalDestinationProvider,
    private readonly sessions: PortalSessionManager,
    private readonly defaultCooldown: () => number,
  ) {}

  public all(): readonly LobbyPortal[] {
    return this.provider.all();
  }

  public get(id: string): LobbyPortal {
    const portal = this.provider.all().find((candidate) => candidate.id === id);
    if (portal === undefined) throw new RangeError(`No existe el portal ${id}.`);
    return portal;
  }

  public at(position: LobbyPosition): LobbyPortal | undefined {
    return selectPortal(this.provider.all(), position);
  }

  public async create(playerId: string, input: PortalCreateInput): Promise<LobbyPortal> {
    const selection = this.sessions.selection(playerId);
    if (!selection.ok && selection.reason === 'incomplete')
      throw new Error('Selecciona las dos posiciones antes de crear el portal.');
    if (!selection.ok) throw new Error('Las posiciones del portal deben estar en el mismo mundo.');
    if (this.provider.all().some((portal) => portal.id === input.id))
      throw new Error(`El portal ${input.id} ya existe.`);
    if (input.destination !== undefined && !this.destinations.hasEnabledServer(input.destination))
      throw new Error(`El servidor ${input.destination} no está disponible.`);
    const portal: LobbyPortal = {
      id: input.id,
      enabled: input.enabled ?? true,
      world: selection.world,
      min: selection.min,
      max: selection.max,
      ...(input.permission === undefined ? {} : { permission: input.permission }),
      priority: input.priority ?? 0,
      'cooldown-ms': input['cooldown-ms'] ?? this.defaultCooldown(),
      ...(input.destination === undefined ? {} : { destination: input.destination }),
      action:
        input.destination === undefined
          ? { type: 'none' }
          : { type: 'connect', target: input.destination },
      visualize: input.visualize ?? false,
    };
    await this.provider.replace([...this.provider.all(), portal]);
    return portal;
  }

  public async remove(id: string): Promise<LobbyPortal> {
    const portal = this.get(id);
    await this.provider.replace(this.provider.all().filter((candidate) => candidate.id !== id));
    return portal;
  }

  public async setEnabled(id: string, enabled: boolean): Promise<LobbyPortal> {
    return this.update(id, (portal) => ({ ...portal, enabled }));
  }

  public async setDestination(
    id: string,
    destination: PortalDestinationInput,
  ): Promise<LobbyPortal> {
    if (destination.type === 'server' && !this.destinations.hasEnabledServer(destination.target))
      throw new Error(`El servidor ${destination.target} no está disponible.`);
    if (destination.type === 'menu' && !this.destinations.hasMenu(destination.target))
      throw new Error(`El menú ${destination.target} no existe.`);
    return this.update(id, (portal) => {
      if (destination.type === 'spawn') {
        const updated: LobbyPortal = { ...portal, action: { type: 'spawn' } };
        delete updated.destination;
        return updated;
      }
      const updated: LobbyPortal = {
        ...portal,
        action: {
          type: destination.type === 'server' ? 'connect' : 'menu',
          target: destination.target,
        },
      };
      if (destination.type === 'server') updated.destination = destination.target;
      else delete updated.destination;
      return updated;
    });
  }

  private async update(
    id: string,
    update: (portal: LobbyPortal) => LobbyPortal,
  ): Promise<LobbyPortal> {
    const current = this.get(id);
    const updated = update({
      ...current,
      min: { ...current.min },
      max: { ...current.max },
      action: { ...current.action },
    });
    await this.provider.replace(
      this.provider.all().map((candidate) => (candidate.id === id ? updated : candidate)),
    );
    return updated;
  }
}
