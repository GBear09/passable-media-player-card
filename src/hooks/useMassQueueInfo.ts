import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { useHass } from "@components";
import { useToast } from "@components/Toast";
import { MediaPlayerEntity } from "@types";
import {
  getMassQueueInfo,
  hasMassQueueDomain,
  hasMassQueueService,
  MassQueueInfo,
  setMassAutoplay,
  setMassCrossfade,
} from "@utils";

export function useMassQueueInfo(maEntityId?: string | null, enabled = true) {
  const hass = useHass();
  const { showToast } = useToast();
  const [queueInfo, setQueueInfo] = useState<MassQueueInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const mountedRef = useRef(true);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const maState = maEntityId
    ? (hass?.states?.[maEntityId] as MediaPlayerEntity | undefined)
    : undefined;
  const activeQueueId = maState?.attributes?.active_queue;
  const mediaContentId = maState?.attributes?.media_content_id;
  const mediaTitle = maState?.attributes?.media_title;

  const canSetAutoplay = Boolean(
    maEntityId && hasMassQueueService("set_autoplay")
  );
  const canSetCrossfade = Boolean(
    maEntityId && hasMassQueueService("set_crossfade")
  );

  const fetchInfo = useCallback(
    async (forceRefresh = false) => {
      if (!enabled || !maEntityId || !hasMassQueueDomain()) {
        setQueueInfo(null);
        return;
      }
      setLoading(true);
      try {
        const info = await getMassQueueInfo(maEntityId, forceRefresh);
        if (mountedRef.current) {
          setQueueInfo(info);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [enabled, maEntityId]
  );

  useEffect(() => {
    fetchInfo(false);
  }, [fetchInfo, activeQueueId, mediaContentId, mediaTitle]);

  const scheduleVerifyRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) {
        fetchInfo(true);
      }
    }, 300);
  }, [fetchInfo]);

  const toggleAutoplay = useCallback(async () => {
    if (!maEntityId || !canSetAutoplay || updating) return;
    const nextEnabled = !(queueInfo?.autoplay_enabled ?? false);
    const prevInfo = queueInfo;
    setUpdating(true);
    setQueueInfo(prev =>
      prev ? { ...prev, autoplay_enabled: nextEnabled } : prev
    );
    try {
      await setMassAutoplay(maEntityId, nextEnabled);
      showToast(
        nextEnabled ? "Autoplay enabled" : "Autoplay disabled",
        "success"
      );
      scheduleVerifyRefresh();
    } catch (err) {
      if (mountedRef.current) {
        setQueueInfo(prevInfo);
      }
      const msg =
        err instanceof Error ? err.message : "Failed to update Autoplay";
      showToast(msg, "error");
    } finally {
      if (mountedRef.current) {
        setUpdating(false);
      }
    }
  }, [
    maEntityId,
    canSetAutoplay,
    updating,
    queueInfo,
    showToast,
    scheduleVerifyRefresh,
  ]);

  const toggleCrossfade = useCallback(async () => {
    if (!maEntityId || !canSetCrossfade || updating) return;
    const nextEnabled = !(queueInfo?.crossfade_enabled ?? false);
    const prevInfo = queueInfo;
    setUpdating(true);
    setQueueInfo(prev =>
      prev ? { ...prev, crossfade_enabled: nextEnabled } : prev
    );
    try {
      await setMassCrossfade(maEntityId, nextEnabled);
      showToast(
        nextEnabled ? "Crossfade enabled" : "Crossfade disabled",
        "success"
      );
      scheduleVerifyRefresh();
    } catch (err) {
      if (mountedRef.current) {
        setQueueInfo(prevInfo);
      }
      const msg =
        err instanceof Error ? err.message : "Failed to update Crossfade";
      showToast(msg, "error");
    } finally {
      if (mountedRef.current) {
        setUpdating(false);
      }
    }
  }, [
    maEntityId,
    canSetCrossfade,
    updating,
    queueInfo,
    showToast,
    scheduleVerifyRefresh,
  ]);

  const refetch = useCallback(() => fetchInfo(true), [fetchInfo]);

  return useMemo(
    () => ({
      queueInfo,
      loading,
      updating,
      canSetAutoplay,
      canSetCrossfade,
      toggleAutoplay,
      toggleCrossfade,
      refetch,
    }),
    [
      queueInfo,
      loading,
      updating,
      canSetAutoplay,
      canSetCrossfade,
      toggleAutoplay,
      toggleCrossfade,
      refetch,
    ]
  );
}
