import { useCallback, useEffect, useMemo } from "preact/hooks";
import { useHassMessagePromise } from "./useHassMessagePromise";
import { useHass, usePlayer } from "@components";
import { useToast } from "@components/Toast";
import {
  clearQueueFromHere,
  getHass,
  hasMassQueueService,
  moveQueueItemNext,
} from "@utils";
import { MediaPlayerEntity, QueueItem } from "@types";

type MassQueueResponse = {
  [key: string]: MassQueueItem[];
};

type MassQueueItem = {
  queue_item_id: string;
  media_title: string;
  media_album_name?: string;
  media_artist?: string;
  media_content_id?: string;
  media_image?: string;
  local_image_encoded?: string;
  favorite?: boolean;
};

export const useMassQueue = (entity_id: string, enabled: boolean) => {
  const player = usePlayer();
  const hass = useHass();
  const { showToast } = useToast();

  const maState = entity_id
    ? (hass?.states?.[entity_id] as MediaPlayerEntity | undefined)
    : undefined;
  const maMediaContentId = maState?.attributes?.media_content_id;

  const { data, loading, error, refetch } =
    useHassMessagePromise<MassQueueResponse>(
      {
        type: "call_service",
        domain: "mass_queue",
        service: "get_queue_items",
        service_data: {
          entity: entity_id,
        },
        return_response: true,
      },
      {
        enabled: enabled,
        staleTime: 30000, // 30 seconds
      }
    );

  const skipToItem = useCallback(
    async (queue_item_id: string) => {
      await getHass().callService("mass_queue", "play_queue_item", {
        entity: entity_id,
        queue_item_id,
      });
    },
    [entity_id]
  );

  const deleteItem = useCallback(
    async (queue_item_id: string) => {
      await getHass().callService("mass_queue", "remove_queue_item", {
        entity: entity_id,
        queue_item_id,
      });
      refetch();
    },
    [entity_id, refetch]
  );

  const moveItemUp = useCallback(
    async (queue_item_id: string) => {
      await getHass().callService("mass_queue", "move_queue_item_up", {
        entity: entity_id,
        queue_item_id,
      });
      // Small delay to allow backend to process the move (else it will return the old order)
      await new Promise(resolve => setTimeout(resolve, 100));
      refetch();
    },
    [entity_id, refetch]
  );

  const moveItemDown = useCallback(
    async (queue_item_id: string) => {
      await getHass().callService("mass_queue", "move_queue_item_down", {
        entity: entity_id,
        queue_item_id,
      });
      // Small delay to allow backend to process the move (else it will return the old order)
      await new Promise(resolve => setTimeout(resolve, 100));
      refetch();
    },
    [entity_id, refetch]
  );

  const canMoveNext = hasMassQueueService("move_queue_item_next");
  const moveItemNext = useCallback(
    async (queue_item_id: string) => {
      if (!canMoveNext) return;
      await moveQueueItemNext(entity_id, queue_item_id);
      showToast("Moved to Play Next", "success");
      await new Promise(resolve => setTimeout(resolve, 100));
      refetch();
    },
    [entity_id, canMoveNext, refetch, showToast]
  );

  const canClearUpcoming = hasMassQueueService("clear_queue_from_here");
  const clearUpcoming = useCallback(async () => {
    if (!canClearUpcoming) return;
    await clearQueueFromHere(entity_id);
    showToast("Cleared upcoming queue", "success");
    await new Promise(resolve => setTimeout(resolve, 100));
    refetch();
  }, [entity_id, canClearUpcoming, refetch, showToast]);

  const clearQueue = useCallback(async () => {
    await getHass().callService("media_player", "clear_playlist", {
      entity_id,
    });
    showToast("Cleared queue", "success");
    refetch();
  }, [entity_id, refetch, showToast]);

  const queue = useMemo<QueueItem[]>(() => {
    const rawItems = data?.[entity_id] ?? [];
    if (rawItems.length === 0) return [];

    // Match playing item accurately: prefer exact URI match, then title+artist, then title
    let playingIndex = -1;
    if (maMediaContentId) {
      playingIndex = rawItems.findIndex(
        item => item.media_content_id === maMediaContentId
      );
    }
    if (playingIndex < 0 && player.title) {
      const playerArtist = player.attributes?.media_artist;
      if (playerArtist) {
        playingIndex = rawItems.findIndex(
          item =>
            item.media_title === player.title &&
            item.media_artist === playerArtist
        );
      }
      if (playingIndex < 0) {
        playingIndex = rawItems.findIndex(
          item => item.media_title === player.title
        );
      }
    }

    // Slice history items BEFORE computing isFirst / playlistIndex / canMoveUp
    const visibleItems =
      playingIndex >= 0 ? rawItems.slice(playingIndex) : rawItems;
    const hasPlayingItem = playingIndex >= 0;

    return visibleItems.map((item, index, array) => {
      const isPlaying = hasPlayingItem && index === 0;
      const canMoveUp = hasPlayingItem ? index > 1 : index > 0;
      return {
        id: item.queue_item_id,
        title: item.media_title,
        artist: item.media_artist,
        album: item.media_album_name,
        artworkUrl: item.local_image_encoded || item.media_image,
        uri: item.media_content_id,
        favorite: item.favorite,
        isFirst: index === 0,
        isLast: index === array.length - 1,
        canMoveUp,
        playlistIndex: index,
        isPlaying,
        skipToItem: () => skipToItem(item.queue_item_id),
        deleteItem: () => deleteItem(item.queue_item_id),
        moveItemUp: () => moveItemUp(item.queue_item_id),
        moveItemDown: () => moveItemDown(item.queue_item_id),
        moveItemNext: canMoveNext
          ? () => moveItemNext(item.queue_item_id)
          : undefined,
      };
    });
  }, [
    data,
    entity_id,
    maMediaContentId,
    player.title,
    player.attributes?.media_artist,
    skipToItem,
    deleteItem,
    moveItemUp,
    moveItemDown,
    canMoveNext,
    moveItemNext,
  ]);

  const currentQueueItem = useMemo(
    () => queue.find(item => item.isPlaying),
    [queue]
  );

  useEffect(() => {
    if (!enabled || !data) return;
    refetch();
  }, [player.title, maMediaContentId]); // eslint-disable-line react-hooks/exhaustive-deps -- `data` intentionally omitted: including it would trigger an infinite refetch loop

  return useMemo(
    () => ({
      queue,
      currentQueueItem,
      loading,
      error,
      refetch,
      clearQueue,
      clearUpcoming,
      canClearUpcoming,
    }),
    [
      queue,
      currentQueueItem,
      loading,
      error,
      refetch,
      clearQueue,
      clearUpcoming,
      canClearUpcoming,
    ]
  );
};
