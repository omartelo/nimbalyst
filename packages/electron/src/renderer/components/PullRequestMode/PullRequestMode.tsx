/**
 * PullRequestMode — top-level container for the GitHub PR review panel
 * (issue #307).
 *
 * Phase E: plumbing only. This renders the onboarding banner and a
 * placeholder, manages the poll lifecycle (start/stop + foreground focus),
 * and dispatches `pr:focus` so the main-process scheduler switches cadence.
 * The list + detail views land in Phases F and G.
 */

import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { prRemoteAtom } from '../../store/atoms/pullRequests';
import { getPullRequestService } from '../../services/RendererPullRequestService';
import { GhOnboardingBanner } from './GhOnboardingBanner';

interface PullRequestModeProps {
  workspacePath: string;
  workspaceName: string;
  isActive: boolean;
  onSwitchToFilesMode?: () => void;
}

export function PullRequestMode({
  workspacePath,
  workspaceName,
  isActive,
}: PullRequestModeProps): JSX.Element {
  const remote = useAtomValue(prRemoteAtom);
  const remoteForWorkspace =
    remote && remote.workspacePath === workspacePath ? remote.remote : null;

  // Start/stop the background poller for this workspace's remote. The poll
  // scheduler is idempotent on start and tears the timer down on stop.
  useEffect(() => {
    if (!remoteForWorkspace) return;
    const service = getPullRequestService();
    void service.startPolling(workspacePath, workspacePath, remoteForWorkspace);
    return () => {
      void service.stopPolling(workspacePath);
    };
  }, [workspacePath, remoteForWorkspace]);

  // Drive the scheduler's foreground set + trigger an immediate poll on enter
  // so the user doesn't wait a full interval for the first list.
  useEffect(() => {
    if (!remoteForWorkspace) return;
    const service = getPullRequestService();
    service.setFocus(workspacePath, isActive);
    if (isActive) {
      void service.pollNow(workspacePath);
    }
    return () => {
      service.setFocus(workspacePath, false);
    };
  }, [workspacePath, isActive, remoteForWorkspace]);

  return (
    <div className="pr-review-mode flex flex-col h-full w-full overflow-hidden">
      <GhOnboardingBanner />
      <div className="pr-review-placeholder flex flex-1 items-center justify-center text-nim-muted text-sm">
        {remoteForWorkspace
          ? `Pull requests for ${remoteForWorkspace} — list view coming next.`
          : `No GitHub remote detected for ${workspaceName}.`}
      </div>
    </div>
  );
}
