import { IconButton, usePlayer } from "@components";
import { theme } from "@constants";
import { css } from "@emotion/react";
import { useSelectedPlayer } from "@components/SelectedPlayerContext";
import { useCallback, useMemo, useState } from "preact/hooks";
import { getHass, startRadioMix } from "@utils";
import {
  OverlayMenu,
  OverlayMenuItem,
} from "@components/OverlayMenu/OverlayMenu";

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
    transform: "scale(1.15)",
    transition: "transform 0.2s ease",
  }),
};

export const Title = () => {
  const { title, subtitle, attributes, entity_id: entityId } = usePlayer();
  const { selectedPlayer } = useSelectedPlayer();
  const [justFavorited, setJustFavorited] = useState(false);

  const maFavoriteButtonId = selectedPlayer?.ma_favorite_button_entity_id;
  const maEntityId = selectedPlayer?.ma_entity_id;
  const mediaTitle = attributes?.media_title;
  const mediaArtist = attributes?.media_artist;
  const mediaAlbum = attributes?.media_album_name;

  const handleFavorite = useCallback(() => {
    if (!maFavoriteButtonId) return;
    getHass().callService("button", "press", {
      entity_id: maFavoriteButtonId,
    });
    setJustFavorited(true);
    setTimeout(() => setJustFavorited(false), 2000);
  }, [maFavoriteButtonId]);

  const radioMixMenuItems: OverlayMenuItem[] = useMemo(() => {
    const items: OverlayMenuItem[] = [];
    if (mediaTitle) {
      items.push({
        label: `Song Radio (${mediaTitle})`,
        icon: "mdi:music-note",
        onClick: () =>
          startRadioMix(entityId, maEntityId ?? undefined, mediaTitle, "track"),
      });
    }
    if (mediaArtist) {
      items.push({
        label: `Artist Radio (${mediaArtist})`,
        icon: "mdi:account-music",
        onClick: () =>
          startRadioMix(
            entityId,
            maEntityId ?? undefined,
            mediaArtist,
            "artist"
          ),
      });
    }
    if (mediaAlbum) {
      items.push({
        label: `Album Radio (${mediaAlbum})`,
        icon: "mdi:album",
        onClick: () =>
          startRadioMix(entityId, maEntityId ?? undefined, mediaAlbum, "album"),
      });
    }
    return items;
  }, [mediaTitle, mediaArtist, mediaAlbum, entityId, maEntityId]);

  return (
    <div css={styles.root}>
      <div css={styles.actionSlot}>
        {maFavoriteButtonId ? (
          <IconButton
            size="small"
            icon={justFavorited ? "mdi:heart" : "mdi:heart-plus"}
            onClick={handleFavorite}
            css={[styles.actionBtn, justFavorited && styles.heartActive]}
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
        {radioMixMenuItems.length > 0 ? (
          <OverlayMenu
            menuItems={radioMixMenuItems}
            side="top"
            align="end"
            renderTrigger={triggerProps => (
              <IconButton
                size="small"
                icon="mdi:radio-tower"
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
