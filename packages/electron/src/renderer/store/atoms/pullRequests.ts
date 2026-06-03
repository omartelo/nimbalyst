/**
 * Pull request review panel atoms (issue #307).
 *
 * Populated by store/listeners/pullRequestListeners.ts. Components read from
 * these atoms and never subscribe to IPC directly (see IPC_LISTENERS.md).
 *
 * Phase E declares the plumbing atoms. The list/detail views (Phases F/G)
 * read `prListAtom` / `prRemoteAtom` / `ghCliStatusAtom` and own their own
 * loading of detail rows.
 */

import { atom } from 'jotai';
import type {
  PullRequestRow,
} from '../../services/RendererPullRequestService';
import type { GhCliStatus } from '../../services/RendererGhCliService';

/**
 * Latest `gh` CLI install/auth status, fed by `pr:gh-status-changed` and the
 * initial probe. `null` means "not yet known".
 */
export const ghCliStatusAtom = atom<GhCliStatus | null>(null);

/**
 * The GitHub remote for the active workspace, or null if the workspace has no
 * GitHub origin (in which case the PR review gutter button stays hidden).
 *
 * Carries `workspacePath` so consumers can verify the remote belongs to the
 * currently-active workspace before acting on it (multi-project rail switches
 * the active workspace without unmounting).
 */
export interface PrRemoteInfo {
  workspacePath: string;
  remote: string;
  host: string;
}

export const prRemoteAtom = atom<PrRemoteInfo | null>(null);

/**
 * Cached PR list for the active workspace. Replaced wholesale by the mode
 * component after each `pr:list` fetch / `pr:list-updated` broadcast.
 */
export const prListAtom = atom<PullRequestRow[]>([]);

export const prListLoadingAtom = atom<boolean>(false);
export const prListErrorAtom = atom<string | null>(null);

/**
 * Request-atom for `pr:list-updated` broadcasts. The listener bumps `version`
 * and stores the payload; the mode component reacts (skip-initial-mount idiom)
 * to re-read the cache via `pr:list`.
 */
export interface PrListUpdated {
  version: number;
  payload: { workspacePath: string; remote: string };
}

export const prListUpdatedAtom = atom<PrListUpdated | null>(null);
