import type { AppUpdaterPhase } from "@/lib/appUpdater";

type Props = {
  phase: AppUpdaterPhase;
  onDownload: () => void;
  onRestart: () => void;
  onRetry: () => void;
};

export function UpdateNudge({ phase, onDownload, onRestart, onRetry }: Props) {
  if (phase === "idle" || phase === "checking") {
    return null;
  }

  if (phase === "available") {
    return (
      <div className="app-update-nudge" role="status">
        <span className="app-update-nudge-text">Update available</span>
        <button type="button" className="app-update-nudge-action" onClick={onDownload}>
          Download
        </button>
      </div>
    );
  }

  if (phase === "downloading") {
    return (
      <div className="app-update-nudge" role="status">
        <span className="app-update-nudge-text">Downloading…</span>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="app-update-nudge" role="status">
        <span className="app-update-nudge-text">Update ready</span>
        <button type="button" className="app-update-nudge-action" onClick={onRestart}>
          Restart
        </button>
      </div>
    );
  }

  return (
    <div className="app-update-nudge" role="status">
      <span className="app-update-nudge-text">Update unavailable</span>
      <button type="button" className="app-update-nudge-action" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
