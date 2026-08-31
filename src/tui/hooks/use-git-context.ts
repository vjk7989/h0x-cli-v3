import { useEffect, useState } from "react";
import { readGitContext, type GitContext } from "../read-git-context.js";

export function useGitContext(workingDir: string, refreshKey: unknown): GitContext | null {
  const [snapshot, setSnapshot] = useState<{ cwd: string; git: GitContext | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void readGitContext(workingDir, controller.signal).then((git) => {
      if (!controller.signal.aborted) setSnapshot({ cwd: workingDir, git });
    });
    return () => controller.abort();
  }, [workingDir, refreshKey]);
  return snapshot?.cwd === workingDir ? snapshot.git : null;
}
