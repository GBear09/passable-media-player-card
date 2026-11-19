import { useEffect, useMemo, useState } from "preact/hooks";
import { getConfigEntryId } from "@utils";
import { getHassMessageWithCache } from "@utils/getHassMessageWithCache";
import {
  MaFilterType,
  MaMediaItem,
  MaMediaType,
  MaSearchResponse,
} from "./types";
import { responseKeyMediaTypeMap } from "./constants";

export const useFavorites = (
  filter: MaFilterType,
  enabled: boolean,
  maEntityId?: string
) => {
  const [configEntry, setConfigEntry] = useState<string | null>(null);
  const [results, setResults] = useState<MaSearchResponse | null>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getConfigEntryId("music_assistant", maEntityId).then(entryId => {
      if (active) setConfigEntry(entryId);
    });
    return () => {
      active = false;
    };
  }, [maEntityId]);

  useEffect(() => {
    if (!configEntry || !enabled) {
      setResults(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const newResults: MaSearchResponse = {
      artists: [],
      albums: [],
      tracks: [],
      playlists: [],
      radio: [],
      podcasts: [],
      audiobooks: [],
    };

    const getResult = async (mediaType: MaMediaType) => {
      const message = {
        type: "call_service",
        domain: "music_assistant",
        service: "get_library",
        service_data: {
          config_entry_id: configEntry,
          media_type: mediaType,
          favorite: true,
          limit: filter === "all" ? 8 : 20,
        },
        return_response: true,
      };
      try {
        const res = await getHassMessageWithCache<{
          response: { items: MaMediaItem[] };
        }>(
          message,
          { staleTime: 120000 } // 2 minutes
        );
        if (!res.response) {
          return;
        }
        // @ts-expect-error we must trust the response here
        newResults[mediaTypeResponseKeyMap[mediaType]] =
          res.response.items ?? [];
      } catch (e) {
        console.error("Error fetching favorites:", mediaType, e);
      }
    };

    const tasks =
      filter === "all"
        ? Object.values(responseKeyMediaTypeMap).map(mediaType =>
            getResult(mediaType)
          )
        : [getResult(filter)];

    Promise.allSettled(tasks).finally(() => {
      if (!cancelled) {
        setLoading(false);
        setResults(newResults);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [configEntry, filter, enabled]);

  return useMemo(() => ({ favorites: results, loading }), [results, loading]);
};

const mediaTypeResponseKeyMap: {
  [K in MaMediaType]: keyof MaSearchResponse;
} = {
  artist: "artists",
  album: "albums",
  track: "tracks",
  playlist: "playlists",
  radio: "radio",
  audiobook: "audiobooks",
  podcast: "podcasts",
};
