import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { getConfigEntryId, getHass } from "@utils";
import {
  MaEnqueueMode,
  MaFilterType,
  MaMediaItem,
  MaSearchResponse,
} from "./types";
import { useHassMessagePromise } from "@hooks/useHassMessagePromise";

export const useSearchQuery = (
  debounceQuery: string,
  filter: MaFilterType,
  maEntityId?: string
) => {
  const [configEntry, setConfigEntry] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getConfigEntryId("music_assistant", maEntityId).then(entryId => {
      if (active) setConfigEntry(entryId);
    });
    return () => {
      active = false;
    };
  }, [maEntityId]);

  const { data, loading } = useHassMessagePromise<MaSearchResponse>(
    {
      type: "call_service",
      domain: "music_assistant",
      service: "search",
      service_data: {
        name: debounceQuery,
        config_entry_id: configEntry,
        media_type: filter === "all" ? undefined : filter,
        limit: filter === "all" ? 8 : 100,
      },
      return_response: true,
    },
    {
      enabled: debounceQuery !== "" && !!configEntry,
      staleTime: 120000, // 2 minutes
    }
  );

  const playItem = useCallback(
    async (item: MaMediaItem, targetEntity: string, enqueue: MaEnqueueMode) => {
      const hass = getHass();
      return hass.callService("music_assistant", "play_media", {
        entity_id: targetEntity,
        media_type: item.media_type,
        media_id: item.uri,
        enqueue,
      });
    },
    []
  );

  return useMemo(
    () => ({ results: data, loading, playItem }),
    [data, loading, playItem]
  );
};
