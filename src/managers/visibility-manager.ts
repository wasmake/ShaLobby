import type { Visibility } from '../configuration/settings.js';

export class VisibilityManager {
  readonly #modes = new Map<string, Visibility>();

  public constructor(private readonly defaultMode: () => Visibility) {}

  public activate(playerId: string): Visibility {
    const mode = this.defaultMode();
    this.#modes.set(playerId, mode);
    return mode;
  }

  public has(playerId: string): boolean {
    return this.#modes.has(playerId);
  }

  public mode(playerId: string): Visibility {
    return this.#modes.get(playerId) ?? this.defaultMode();
  }

  public set(playerId: string, requested: Visibility | 'cycle'): Visibility {
    const previous = this.mode(playerId);
    const mode =
      requested === 'cycle'
        ? previous === 'all'
          ? 'staff'
          : previous === 'staff'
            ? 'none'
            : 'all'
        : requested;
    this.#modes.set(playerId, mode);
    return mode;
  }

  public canSee(playerId: string, targetIsStaff: boolean): boolean {
    const mode = this.mode(playerId);
    return mode === 'all' || (mode === 'staff' && targetIsStaff);
  }

  public remove(playerId: string): void {
    this.#modes.delete(playerId);
  }

  public snapshot(): ReadonlyMap<string, Visibility> {
    return new Map(this.#modes);
  }

  public restore(snapshot: ReadonlyMap<string, Visibility>): void {
    this.#modes.clear();
    for (const [id, mode] of snapshot) this.#modes.set(id, mode);
  }

  public clear(): void {
    this.#modes.clear();
  }
}
