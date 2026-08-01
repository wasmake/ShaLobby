import type { LobbyPortal } from '../configuration/portals.js';
import {
  normalizePortalSelection,
  type LobbyPosition,
  type PortalSelectionResult,
} from './portal-rules.js';

export class PortalSessionManager {
  readonly #cooldowns = new Map<string, number>();
  readonly #occupied = new Map<string, string>();
  readonly #selections = new Map<string, { first?: LobbyPosition; second?: LobbyPosition }>();
  readonly #visualizers = new Set<string>();

  public setPosition(playerId: string, position: LobbyPosition, positionNumber: 1 | 2): void {
    const selection = this.#selections.get(playerId) ?? {};
    if (positionNumber === 1) selection.first = position;
    else selection.second = position;
    this.#selections.set(playerId, selection);
  }

  public selection(playerId: string): PortalSelectionResult {
    return normalizePortalSelection(this.#selections.get(playerId) ?? {});
  }

  public setVisualization(playerId: string, enabled: boolean): void {
    if (enabled) this.#visualizers.add(playerId);
    else this.#visualizers.delete(playerId);
  }

  public shouldVisualize(playerId: string, portal: LobbyPortal): boolean {
    return portal.visualize || this.#visualizers.has(playerId);
  }

  public leave(playerId: string): void {
    this.#occupied.delete(playerId);
  }

  public canEnter(playerId: string, portal: LobbyPortal, now: number): boolean {
    const key = `${playerId}:${portal.id}`;
    const cooldown = this.#cooldowns.get(key) ?? 0;
    if (cooldown <= now) this.#cooldowns.delete(key);
    return this.#occupied.get(playerId) !== portal.id && cooldown <= now;
  }

  public occupy(playerId: string, portalId: string): void {
    this.#occupied.set(playerId, portalId);
  }

  public startCooldown(playerId: string, portal: LobbyPortal, now: number): void {
    this.#cooldowns.set(`${playerId}:${portal.id}`, now + portal['cooldown-ms']);
  }

  public clearPlayer(playerId: string): void {
    this.#occupied.delete(playerId);
    this.#selections.delete(playerId);
    this.#visualizers.delete(playerId);
    for (const key of this.#cooldowns.keys())
      if (key.startsWith(`${playerId}:`)) this.#cooldowns.delete(key);
  }

  public clear(): void {
    this.#cooldowns.clear();
    this.#occupied.clear();
    this.#selections.clear();
    this.#visualizers.clear();
  }
}
