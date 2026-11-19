import { useEffect, useMemo, useState } from "preact/hooks";
import {
  getMassRecommendations,
  hasMassQueueService,
  MassRecommendationFolder,
} from "@utils";

export function useRecommendations(maEntityId: string, enabled: boolean) {
  const [folders, setFolders] = useState<MassRecommendationFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !maEntityId ||
      !hasMassQueueService("get_recommendations")
    ) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMassRecommendations(maEntityId)
      .then(res => {
        if (!cancelled) setFolders(res);
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load recommendations"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [maEntityId, enabled]);

  return useMemo(
    () => ({ folders, loading, error }),
    [folders, loading, error]
  );
}
