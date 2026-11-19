import { useMemo, useCallback } from "preact/hooks";
import {
  getAllMassPlayers,
  getAllSqueezeboxPlayers,
  getHass,
  getIsLmsPlayer,
  getHasMassFeatures,
  hasMassQueueService,
  transferLmsQueue,
  transferMaQueue,
  getIsMassPlayer,
  startRadioMix,
} from "@utils";
import {
  OverlayMenu,
  OverlayMenuItem,
  OverlayMenuProps,
} from "@components/OverlayMenu/OverlayMenu";
import { usePlayer } from "@components/PlayerContext";
import { useIntl } from "@components/i18n";
import { useEffectiveMassPlayer } from "@hooks";
import { useMassDiscover } from "@components/MassDiscoverSheet";
import { useToast } from "@components/Toast";

export type AdditionalActionsMenuProps = {
  ma_entity_id?: string;
  ma_favorite_button_entity_id?: string;
  lms_entity_id?: string;
  noSourceSelection?: boolean;
} & Omit<OverlayMenuProps, "menuItems" | "children">;

export const AdditionalActionsMenu = ({
  ma_entity_id,
  ma_favorite_button_entity_id,
  lms_entity_id,
  noSourceSelection,
  ...overlayMenuProps
}: AdditionalActionsMenuProps) => {
  const { t } = useIntl();
  const player = usePlayer();
  const { maState, isMaTrackSynced } = useEffectiveMassPlayer();
  const { openSimilar, isSupported: isDiscoverSupported } = useMassDiscover();
  const { showToast } = useToast();

  const isMainEntityMassPlayer = useMemo(
    () => getHasMassFeatures(player?.entity_id, ma_entity_id),
    [player, ma_entity_id]
  );

  const isMainEntityLmsPlayer = useMemo(
    () => lms_entity_id && getIsLmsPlayer(player, lms_entity_id),
    [player, lms_entity_id]
  );

  const markSongAsFavorite = useCallback(() => {
    if (!ma_favorite_button_entity_id) return;
    getHass().callService("button", "press", {
      entity_id: ma_favorite_button_entity_id,
    });
    showToast("Added to favorites", "success");
  }, [ma_favorite_button_entity_id, showToast]);

  const transferQueue = useCallback(
    async (targetEntity: string, targetName: string) => {
      if (!ma_entity_id) return;
      try {
        await transferMaQueue(ma_entity_id, targetEntity);
        showToast(`Transferred queue to ${targetName}`, "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to transfer queue",
          "error"
        );
      }
    },
    [ma_entity_id, showToast]
  );

  const mediaTitle = player.attributes.media_title;
  const mediaArtist = player.attributes.media_artist;
  const mediaAlbum = player.attributes.media_album_name;
  const maMediaContentId = maState?.attributes?.media_content_id;

  const menuItems: OverlayMenuItem[] = useMemo(() => {
    const items: OverlayMenuItem[] = [];
    if (ma_entity_id && isMainEntityMassPlayer) {
      const massPlayers = getAllMassPlayers().filter(
        p =>
          p.entity_id !== ma_entity_id &&
          getIsMassPlayer(p) &&
          p.state !== "unavailable"
      );

      if (ma_favorite_button_entity_id) {
        items.push({
          label: t({
            id: "AdditionalActionsMenu.mark_as_favorite",
          }),
          icon: "mdi:heart-plus",
          onClick: markSongAsFavorite,
        });
      }
      if (massPlayers.length > 0) {
        items.push({
          label: t({
            id: "AdditionalActionsMenu.transfer_queue",
          }),
          icon: "mdi:transfer",
          children: massPlayers.map(p => {
            const label = p.attributes.friendly_name || p.entity_id;
            return {
              label,
              onClick: () => transferQueue(p.entity_id, label),
            };
          }),
        });
      }

      if (isDiscoverSupported) {
        if (hasMassQueueService("get_similar_tracks") && mediaTitle) {
          items.push({
            label: t({
              id: "Discover.similar_tracks",
              defaultMessage: "Similar Tracks",
            }),
            icon: "mdi:playlist-music-outline",
            onClick: () =>
              openSimilar({
                initialTab: "tracks",
                maEntityId: ma_entity_id,
                targetEntityId: player.entity_id,
                trackUri: isMaTrackSynced ? maMediaContentId : undefined,
                title: mediaTitle,
                artist: mediaArtist,
              }),
          });
        }
        if (hasMassQueueService("get_similar_artists") && mediaArtist) {
          items.push({
            label: t({
              id: "Discover.similar_artists",
              defaultMessage: "Similar Artists",
            }),
            icon: "mdi:account-group-outline",
            onClick: () =>
              openSimilar({
                initialTab: "artists",
                maEntityId: ma_entity_id,
                targetEntityId: player.entity_id,
                trackUri: isMaTrackSynced ? maMediaContentId : undefined,
                title: mediaTitle,
                artist: mediaArtist,
              }),
          });
        }
      }

      // Radio Mix menu options
      const radioChildren: OverlayMenuItem[] = [];

      if (mediaTitle) {
        const songSeed =
          isMaTrackSynced && maMediaContentId ? maMediaContentId : mediaTitle;
        radioChildren.push({
          label: `${t({ id: "AdditionalActionsMenu.song_radio" })}: ${mediaTitle}`,
          icon: "mdi:music-note",
          onClick: async () => {
            try {
              await startRadioMix(
                player.entity_id,
                ma_entity_id,
                songSeed,
                "track"
              );
              showToast(`Started Song Radio: ${mediaTitle}`, "success");
            } catch (err) {
              showToast(
                err instanceof Error
                  ? err.message
                  : "Failed to start Song Radio",
                "error"
              );
            }
          },
        });
      }
      if (mediaArtist) {
        radioChildren.push({
          label: `${t({ id: "AdditionalActionsMenu.artist_radio" })}: ${mediaArtist}`,
          icon: "mdi:account-music",
          onClick: async () => {
            try {
              await startRadioMix(
                player.entity_id,
                ma_entity_id,
                mediaArtist,
                "artist"
              );
              showToast(`Started Artist Radio: ${mediaArtist}`, "success");
            } catch (err) {
              showToast(
                err instanceof Error
                  ? err.message
                  : "Failed to start Artist Radio",
                "error"
              );
            }
          },
        });
      }
      if (mediaAlbum) {
        radioChildren.push({
          label: `${t({ id: "AdditionalActionsMenu.album_radio" })}: ${mediaAlbum}`,
          icon: "mdi:album",
          onClick: async () => {
            try {
              await startRadioMix(
                player.entity_id,
                ma_entity_id,
                mediaAlbum,
                "album"
              );
              showToast(`Started Album Radio: ${mediaAlbum}`, "success");
            } catch (err) {
              showToast(
                err instanceof Error
                  ? err.message
                  : "Failed to start Album Radio",
                "error"
              );
            }
          },
        });
      }

      if (radioChildren.length > 0) {
        items.push({
          label: t({
            id: "AdditionalActionsMenu.start_radio_mix",
          }),
          icon: "mdi:radio-tower",
          children: radioChildren,
        });
      }
    }
    if (lms_entity_id && isMainEntityLmsPlayer) {
      const allLmsPlayers = getAllSqueezeboxPlayers().filter(
        p => p.entity_id !== lms_entity_id && p.state !== "unavailable"
      );
      if (allLmsPlayers.length > 0) {
        items.push({
          label: t({
            id: "AdditionalActionsMenu.transfer_queue",
          }),
          icon: "mdi:transfer",
          children: allLmsPlayers.map(p => ({
            label: p.attributes.friendly_name || p.entity_id,
            onClick: () => {
              transferLmsQueue(lms_entity_id, p.entity_id);
            },
          })),
        });
      }
    }

    if (
      !noSourceSelection &&
      player.attributes.source_list?.length &&
      player.attributes.source_list?.length > 0
    ) {
      items.push({
        label: t({
          id: "AdditionalActionsMenu.select_source",
        }),
        icon: "mdi:import",
        children: (player.attributes.source_list ?? []).map(source => ({
          label: source,
          onClick: () => {
            getHass().callService("media_player", "select_source", {
              entity_id: player.entity_id,
              source,
            });
          },
        })),
      });
    }
    return items;
  }, [
    ma_favorite_button_entity_id,
    isMainEntityMassPlayer,
    isMainEntityLmsPlayer,
    ma_entity_id,
    lms_entity_id,
    markSongAsFavorite,
    transferQueue,
    noSourceSelection,
    player.attributes.source_list,
    player.entity_id,
    mediaTitle,
    mediaArtist,
    mediaAlbum,
    isMaTrackSynced,
    maMediaContentId,
    isDiscoverSupported,
    openSimilar,
    showToast,
    t,
  ]);

  if (menuItems.length === 0) return null;

  return <OverlayMenu menuItems={menuItems} {...overlayMenuProps} />;
};
