import { IconButton, usePlayer } from "@components";
import { useIntl } from "@components/i18n";
import { useMassDiscover } from "@components/MassDiscoverSheet";
import {
  OverlayMenu,
  OverlayMenuItem,
} from "@components/OverlayMenu/OverlayMenu";
import { useSelectedPlayer } from "@components/SelectedPlayerContext";
import { useToast } from "@components/Toast";
import { theme } from "@constants";
import { css } from "@emotion/react";
import { useEffectiveMassPlayer } from "@hooks";
import {
  getHass,
  getHassMessageWithCache,
  hasMassQueueService,
  startRadioMix,
  unfavoriteCurrentMassItem,
} from "@utils";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

const styles = {
  root: css({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: "480px",
    gap: "12px",
    paddingLeft: "var(--mmpc-extra-horizontal-padding, 8px)",
    paddingRight: "var(--mmpc-extra-horizontal-padding, 8px)",
  }),
  textContainer: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    gap: "4px",
    textAlign: "center",
    color: theme.colors.onDialog,
    "> h2, > h3": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      width: "100%",
    },
  }),
  titleH2: css({
    margin: 0,
    fontSize: "18px",
    fontWeight: 600,
  }),
  titleH3: css({
    margin: 0,
    fontSize: "14px",
    fontWeight: "normal",
    color: theme.colors.onDialogMuted,
  }),
  actionSlot: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    flexShrink: 0,
  }),
  spacer: css({
    width: "36px",
    height: "36px",
  }),
  actionBtn: css({
    opacity: 0.85,
    "&:hover": {
      opacity: 1,
    },
  }),
  heartActive: css({
    color: "var(--accent-color, #ff4081)",
    transform: "scale(1.12)",
    transition: "transform 0.2s ease",
  }),
};

type QueueFavoriteItem = {
  media_title?: string;
  media_content_id?: string;
  favorite?: boolean;
};

export const Title = () => {
  const { title, subtitle, attributes, entity_id: entityId } = usePlayer();
  const { selectedPlayer } = useSelectedPlayer();
  const { maEntityId, maState, isMass, isMaTrackSynced } =
    useEffectiveMassPlayer();
  const { t } = useIntl();
  const { showToast } = useToast();
  const { openSimilar, isSupported: isDiscoverSupported } = useMassDiscover();

  const [justFavorited, setJustFavorited] = useState(false);
  const [fetchedFavorite, setFetchedFavorite] = useState<boolean | null>(null);
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(
    null
  );

  const maFavoriteButtonId = selectedPlayer?.ma_favorite_button_entity_id;
  const mediaTitle = attributes?.media_title;
  const mediaArtist = attributes?.media_artist;
  const mediaAlbum = attributes?.media_album_name;
  const maMediaContentId = maState?.attributes?.media_content_id;

  // Reset local favorite override when track changes
  useEffect(() => {
    setFavoriteOverride(null);
    setJustFavorited(false);
  }, [mediaTitle, maMediaContentId]);

  // Read live favorite status from cached queue items when MA track is active
  useEffect(() => {
    if (
      !isMass ||
      !maEntityId ||
      !isMaTrackSynced ||
      !hasMassQueueService("get_queue_items")
    ) {
      setFetchedFavorite(null);
      return;
    }

    let cancelled = false;
    getHassMessageWithCache<{
      response?: Record<string, QueueFavoriteItem[]>;
    }>(
      {
        type: "call_service",
        domain: "mass_queue",
        service: "get_queue_items",
        service_data: {
          entity: maEntityId,
        },
        return_response: true,
      },
      { staleTime: 30000 }
    )
      .then(res => {
        if (cancelled) return;
        const items = res?.response?.[maEntityId] ?? [];
        const match =
          items.find(
            i => maMediaContentId && i.media_content_id === maMediaContentId
          ) ?? items.find(i => mediaTitle && i.media_title === mediaTitle);
        setFetchedFavorite(
          typeof match?.favorite === "boolean" ? match.favorite : null
        );
      })
      .catch(() => {
        if (!cancelled) setFetchedFavorite(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isMass, maEntityId, isMaTrackSynced, maMediaContentId, mediaTitle]);

  const isFavorited = favoriteOverride ?? fetchedFavorite ?? false;
  const canUnfavorite = Boolean(
    isMass &&
    maEntityId &&
    isMaTrackSynced &&
    hasMassQueueService("unfavorite_current_item") &&
    maMediaContentId?.startsWith("library://")
  );
  const showFavoriteButton = Boolean(
    maFavoriteButtonId || (isFavorited && canUnfavorite)
  );

  const handleFavorite = useCallback(async () => {
    if (isFavorited && canUnfavorite && maEntityId) {
      setFavoriteOverride(false);
      try {
        await unfavoriteCurrentMassItem(maEntityId);
        showToast("Removed from favorites", "success");
      } catch (err) {
        setFavoriteOverride(true);
        showToast(
          err instanceof Error ? err.message : "Failed to unfavorite track",
          "error"
        );
      }
      return;
    }

    if (!maFavoriteButtonId) return;
    setFavoriteOverride(true);
    setJustFavorited(true);
    setTimeout(() => setJustFavorited(false), 1800);
    try {
      await getHass().callService("button", "press", {
        entity_id: maFavoriteButtonId,
      });
      showToast("Added to favorites", "success");
    } catch (err) {
      setFavoriteOverride(null);
      showToast(
        err instanceof Error ? err.message : "Failed to favorite track",
        "error"
      );
    }
  }, [isFavorited, canUnfavorite, maEntityId, maFavoriteButtonId, showToast]);

  const radioAndDiscoverItems: OverlayMenuItem[] = useMemo(() => {
    const items: OverlayMenuItem[] = [];

    const canDiscoverTracks = Boolean(
      isDiscoverSupported &&
      isMass &&
      maEntityId &&
      hasMassQueueService("get_similar_tracks") &&
      mediaTitle
    );
    const canDiscoverArtists = Boolean(
      isDiscoverSupported &&
      isMass &&
      maEntityId &&
      hasMassQueueService("get_similar_artists") &&
      mediaArtist
    );

    if (canDiscoverTracks || canDiscoverArtists) {
      items.push({
        type: "title",
        label: t({ id: "Discover.title", defaultMessage: "Discover" }),
      });
      if (canDiscoverTracks && maEntityId) {
        items.push({
          label: t({
            id: "Discover.similar_tracks",
            defaultMessage: "Similar Tracks",
          }),
          icon: "mdi:playlist-music-outline",
          onClick: () =>
            openSimilar({
              initialTab: "tracks",
              maEntityId,
              targetEntityId: entityId,
              trackUri: isMaTrackSynced ? maMediaContentId : undefined,
              title: mediaTitle,
              artist: mediaArtist,
            }),
        });
      }
      if (canDiscoverArtists && maEntityId) {
        items.push({
          label: t({
            id: "Discover.similar_artists",
            defaultMessage: "Similar Artists",
          }),
          icon: "mdi:account-group-outline",
          onClick: () =>
            openSimilar({
              initialTab: "artists",
              maEntityId,
              targetEntityId: entityId,
              trackUri: isMaTrackSynced ? maMediaContentId : undefined,
              title: mediaTitle,
              artist: mediaArtist,
            }),
        });
      }
    }

    const hasRadio = Boolean(mediaTitle || mediaArtist || mediaAlbum);
    if (hasRadio) {
      if (items.length > 0) {
        items.push({
          type: "title",
          label: t({
            id: "AdditionalActionsMenu.start_radio_mix",
            defaultMessage: "Start Radio Mix",
          }),
        });
      }
      if (mediaTitle) {
        const songSeed =
          isMaTrackSynced && maMediaContentId ? maMediaContentId : mediaTitle;
        items.push({
          label: `Song Radio (${mediaTitle})`,
          icon: "mdi:music-note",
          onClick: async () => {
            try {
              await startRadioMix(
                entityId,
                maEntityId ?? undefined,
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
        items.push({
          label: `Artist Radio (${mediaArtist})`,
          icon: "mdi:account-music",
          onClick: async () => {
            try {
              await startRadioMix(
                entityId,
                maEntityId ?? undefined,
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
        items.push({
          label: `Album Radio (${mediaAlbum})`,
          icon: "mdi:album",
          onClick: async () => {
            try {
              await startRadioMix(
                entityId,
                maEntityId ?? undefined,
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
    }

    return items;
  }, [
    isDiscoverSupported,
    isMass,
    maEntityId,
    entityId,
    mediaTitle,
    mediaArtist,
    mediaAlbum,
    isMaTrackSynced,
    maMediaContentId,
    openSimilar,
    showToast,
    t,
  ]);

  const heartActive = isFavorited || justFavorited;

  return (
    <div css={styles.root}>
      <div css={styles.actionSlot}>
        {showFavoriteButton ? (
          <IconButton
            size="small"
            icon={
              heartActive
                ? "mdi:heart"
                : canUnfavorite
                  ? "mdi:heart-outline"
                  : "mdi:heart-plus"
            }
            title={
              isFavorited && canUnfavorite
                ? "Remove from favorites"
                : "Favorite current song"
            }
            aria-label={
              isFavorited && canUnfavorite
                ? "Remove from favorites"
                : "Favorite current song"
            }
            onClick={handleFavorite}
            css={[styles.actionBtn, heartActive && styles.heartActive]}
          />
        ) : (
          <div css={styles.spacer} />
        )}
      </div>

      <div css={styles.textContainer}>
        {!!title && <h2 css={styles.titleH2}>{title}</h2>}
        {!!subtitle && <h3 css={styles.titleH3}>{subtitle}</h3>}
      </div>

      <div css={styles.actionSlot}>
        {radioAndDiscoverItems.length > 0 ? (
          <OverlayMenu
            menuItems={radioAndDiscoverItems}
            side="top"
            align="end"
            renderTrigger={triggerProps => (
              <IconButton
                size="small"
                icon="mdi:radio-tower"
                title="Radio & Similar Music"
                aria-label="Radio & Similar Music"
                css={styles.actionBtn}
                {...triggerProps}
              />
            )}
          />
        ) : (
          <div css={styles.spacer} />
        )}
      </div>
    </div>
  );
};
