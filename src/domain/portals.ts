import type { LobbyPortal } from '../configuration.js';

export interface LobbyPosition {
  readonly world: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type PortalSelectionResult =
  | { readonly ok: false; readonly reason: 'incomplete' | 'world-mismatch' }
  | {
      readonly ok: true;
      readonly world: string;
      readonly min: Readonly<{ x: number; y: number; z: number }>;
      readonly max: Readonly<{ x: number; y: number; z: number }>;
    };

export function normalizePortalSelection(selection: {
  readonly first?: LobbyPosition;
  readonly second?: LobbyPosition;
}): PortalSelectionResult {
  const { first, second } = selection;
  if (first === undefined || second === undefined) return { ok: false, reason: 'incomplete' };
  if (first.world !== second.world) return { ok: false, reason: 'world-mismatch' };
  return {
    ok: true,
    world: first.world,
    min: {
      x: Math.min(first.x, second.x),
      y: Math.min(first.y, second.y),
      z: Math.min(first.z, second.z),
    },
    max: {
      x: Math.max(first.x, second.x),
      y: Math.max(first.y, second.y),
      z: Math.max(first.z, second.z),
    },
  };
}

export function selectPortal(
  portals: readonly LobbyPortal[],
  position: LobbyPosition,
): LobbyPortal | undefined {
  if (![position.x, position.y, position.z].every(Number.isFinite)) return undefined;
  let selected: LobbyPortal | undefined;
  for (const portal of portals) {
    if (
      !portal.enabled ||
      portal.world !== position.world ||
      position.x < portal.min.x ||
      position.x > portal.max.x ||
      position.y < portal.min.y ||
      position.y > portal.max.y ||
      position.z < portal.min.z ||
      position.z > portal.max.z
    )
      continue;
    if (
      selected === undefined ||
      portal.priority > selected.priority ||
      (portal.priority === selected.priority && portal.id.localeCompare(selected.id) < 0)
    )
      selected = portal;
  }
  return selected;
}
