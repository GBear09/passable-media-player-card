import { useCallback, useContext, useMemo } from "preact/hooks";
import type { MediocreMultiMediaPlayerCardConfig } from "@types";
import { CardContext, CardContextType } from "@components/CardContext";
import { InteractionConfig } from "@types";
import { Chip, Icon, LyrionTrackInfo, useHass, usePlayer } from "@components";
import { useActionProps, useEffectiveMassPlayer } from "@hooks";
import { css } from "@emotion/react";
import { ViewHeader } from "./ViewHeader";

import { Fragment } from "preact/jsx-runtime";
import {
  OverlayMenu,
  OverlayMenuItem,
} from "@components/OverlayMenu/OverlayMenu";
import { memo } from "preact/compat";
import { useIntl } from "@components/i18n";
import {
  getHasMassFeatures,
  getHass,
  getIsLmsPlayer,
  getSourceIcon,
  hasMassQueueService,
  transferLmsQueue,
  transferMaQueue,
  startRadioMix,
} from "@utils";
import { useSelectedPlayer } from "@components/SelectedPlayerContext";
import { LyrionRelatedAlbums } from "@components/LyrionRelatedAlbums";
import { useMassDiscover } from "@components/MassDiscoverSheet";
import { useToast } from "@components/Toast";

const styles = {
  root: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    overflowY: "auto",
    height: "100%",
    padding: 16,
    gap: 12,
  }),
  buttons: css({
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    gap: "6px 2px",
  }),
};

export const AdditionalActionsView = memo(() => {
  const { selectedPlayer, setSelectedPlayer } = useSelectedPlayer();
  const { maState, isMaTrackSynced } = useEffectiveMassPlayer();
  const { openSimilar, isSupported: isDiscoverSupported } = useMassDiscover();
  const { showToast } = useToast();

  const {
    custom_buttons,
    ma_favorite_button_entity_id,
    ma_entity_id,
    entity_id,
    lms_entity_id,
  } = selectedPlayer!;

  const {
    rootElement,
    config: { media_players },
  } =
    useContext<CardContextType<MediocreMultiMediaPlayerCardConfig>>(
      CardContext
    );

  const hass = useHass();

  const player = usePlayer();
  const isMainEntityMassPlayer = useMemo(
    () => getHasMassFeatures(player.entity_id, ma_entity_id),
    [player, ma_entity_id]
  );

  const isMainEntityLmsPlayer = useMemo(
    () => lms_entity_id && getIsLmsPlayer(player, lms_entity_id),
    [player, lms_entity_id]
  );

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

  const maTransferMenuItems: OverlayMenuItem[] = useMemo(() => {
    if (!ma_entity_id || !isMainEntityMassPlayer) return [];
    const items: (OverlayMenuItem | null)[] = media_players.map(mp => {
      if (!mp.ma_entity_id) return null;
      const state = hass.states[mp.entity_id];
      if (!state || state.state === "unavailable" || mp.entity_id === entity_id)
        return null;
      const label = mp.name || state.attributes.friendly_name || mp.entity_id;
      return {
        label,
        onClick: () => {
          if (!mp.ma_entity_id) return;
          transferQueue(mp.ma_entity_id, label);
          setSelectedPlayer(mp);
        },
      };
    });

    return items.filter(item => item !== null) as OverlayMenuItem[];
  }, [
    isMainEntityMassPlayer,
    ma_entity_id,
    entity_id,
    hass.states,
    transferQueue,
    media_players,
    setSelectedPlayer,
  ]);

  const lmsTransferMenuItems: OverlayMenuItem[] = useMemo(() => {
    if (!lms_entity_id || !isMainEntityLmsPlayer) return [];
    const items: (OverlayMenuItem | null)[] = media_players.map(mp => {
      if (!mp.lms_entity_id) return null;
      const state = hass.states[mp.entity_id];
      if (!state || state.state === "unavailable" || mp.entity_id === entity_id)
        return null;
      return {
        label: mp.name || state.attributes.friendly_name || mp.entity_id,
        onClick: () => {
          if (!mp.lms_entity_id) return;
          transferLmsQueue(lms_entity_id, mp.lms_entity_id);
          setSelectedPlayer(mp);
        },
      };
    });

    return items.filter(item => item !== null) as OverlayMenuItem[];
  }, [
    isMainEntityLmsPlayer,
    lms_entity_id,
    entity_id,
    hass.states,
    media_players,
    setSelectedPlayer,
  ]);

  const markSongAsFavorite = useCallback(() => {
    if (!ma_favorite_button_entity_id) return;
    getHass().callService("button", "press", {
      entity_id: ma_favorite_button_entity_id,
    });
    showToast("Added to favorites", "success");
  }, [ma_favorite_button_entity_id, showToast]);

  const sourceSelectMenuItems: OverlayMenuItem[] = useMemo(() => {
    return (player.attributes.source_list ?? []).map(source => ({
      label: source,
      onClick: () => {
        getHass().callService("media_player", "select_source", {
          entity_id: player.entity_id,
          source,
        });
      },
    }));
  }, [player.attributes.source_list, player.entity_id]);

  const mediaTitle = player.attributes.media_title;
  const mediaArtist = player.attributes.media_artist;
  const mediaAlbum = player.attributes.media_album_name;
  const maMediaContentId = maState?.attributes?.media_content_id;

  const radioMixMenuItems: OverlayMenuItem[] = useMemo(() => {
    const items: OverlayMenuItem[] = [];

    if (mediaTitle) {
      const songSeed =
        isMaTrackSynced && maMediaContentId ? maMediaContentId : mediaTitle;
      items.push({
        label: `Song Radio (${mediaTitle})`,
        icon: "mdi:music-note",
        onClick: async () => {
          try {
            await startRadioMix(
              entity_id,
              ma_entity_id ?? undefined,
              songSeed,
              "track"
            );
            showToast(`Started Song Radio: ${mediaTitle}`, "success");
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "Failed to start Song Radio",
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
              entity_id,
              ma_entity_id ?? undefined,
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
              entity_id,
              ma_entity_id ?? undefined,
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

    return items;
  }, [
    mediaTitle,
    mediaArtist,
    mediaAlbum,
    isMaTrackSynced,
    maMediaContentId,
    entity_id,
    ma_entity_id,
    showToast,
  ]);

  const moreInfoButtonProps = useActionProps({
    rootElement,
    actionConfig: {
      tap_action: { action: "more-info" },
      entity: entity_id,
    },
  });

  const { t } = useIntl();

  const canSimilarTracks = Boolean(
    isDiscoverSupported &&
    ma_entity_id &&
    isMainEntityMassPlayer &&
    hasMassQueueService("get_similar_tracks") &&
    mediaTitle
  );
  const canSimilarArtists = Boolean(
    isDiscoverSupported &&
    ma_entity_id &&
    isMainEntityMassPlayer &&
    hasMassQueueService("get_similar_artists") &&
    mediaArtist
  );

  return (
    <div css={styles.root}>
      {custom_buttons && custom_buttons.length > 0 && (
        <Fragment>
          <ViewHeader
            title={t({
              id: "MediocreMultiMediaPlayerCard.AdditionalActionsView.shortcuts_title",
            })}
            subtitle={t({
              id: "MediocreMultiMediaPlayerCard.AdditionalActionsView.shortcuts_subtitle",
            })}
          />
          <div css={styles.buttons}>
            {custom_buttons?.map((button, index) => (
              <CustomButton key={index} button={button} entityId={entity_id} />
            ))}
          </div>
        </Fragment>
      )}
      <Fragment>
        <ViewHeader
          title={t({
            id: "MediocreMultiMediaPlayerCard.AdditionalActionsView.media_player_actions_title",
          })}
          subtitle={t({
            id: "MediocreMultiMediaPlayerCard.AdditionalActionsView.media_player_actions_subtitle",
          })}
        />
        <div css={styles.buttons}>
          {radioMixMenuItems.length > 0 && (
            <OverlayMenu
              menuItems={radioMixMenuItems}
              side="bottom"
              renderTrigger={triggerProps => (
                <Chip icon="mdi:radio-tower" {...triggerProps}>
                  {t({
                    id: "AdditionalActionsMenu.start_radio_mix",
                    defaultMessage: "Start Radio Mix",
                  })}
                  <Icon size="x-small" icon="mdi:chevron-down" />
                </Chip>
              )}
            />
          )}
          {canSimilarTracks && ma_entity_id && (
            <Chip
              icon="mdi:playlist-music-outline"
              onClick={() =>
                openSimilar({
                  initialTab: "tracks",
                  maEntityId: ma_entity_id,
                  targetEntityId: entity_id,
                  trackUri: isMaTrackSynced ? maMediaContentId : undefined,
                  title: mediaTitle,
                  artist: mediaArtist,
                })
              }
            >
              {t({
                id: "Discover.similar_tracks",
                defaultMessage: "Similar Tracks",
              })}
            </Chip>
          )}
          {canSimilarArtists && ma_entity_id && (
            <Chip
              icon="mdi:account-group-outline"
              onClick={() =>
                openSimilar({
                  initialTab: "artists",
                  maEntityId: ma_entity_id,
                  targetEntityId: entity_id,
                  trackUri: isMaTrackSynced ? maMediaContentId : undefined,
                  title: mediaTitle,
                  artist: mediaArtist,
                })
              }
            >
              {t({
                id: "Discover.similar_artists",
                defaultMessage: "Similar Artists",
              })}
            </Chip>
          )}
          {!!ma_entity_id && isMainEntityMassPlayer && (
            <Fragment>
              {ma_favorite_button_entity_id && (
                <Chip icon="mdi:heart-plus" onClick={markSongAsFavorite}>
                  {t({
                    id: "MediocreMultiMediaPlayerCard.AdditionalActionsView.mark_as_favorite",
                  })}
                </Chip>
              )}
              {maTransferMenuItems.length > 0 && (
                <OverlayMenu
                  menuItems={maTransferMenuItems}
                  side="bottom"
                  renderTrigger={triggerProps => (
                    <Chip icon="mdi:transfer" {...triggerProps}>
                      {t({
                        id: "MediocreMultiMediaPlayerCard.AdditionalActionsView.transfer_queue",
                      })}
                      <Icon size="x-small" icon="mdi:chevron-down" />
                    </Chip>
                  )}
                />
              )}
            </Fragment>
          )}
          {lmsTransferMenuItems.length > 0 && (
            <OverlayMenu
              menuItems={lmsTransferMenuItems}
              side="bottom"
              renderTrigger={triggerProps => (
                <Chip icon="mdi:transfer" {...triggerProps}>
                  {t({
                    id: "MediocreMultiMediaPlayerCard.AdditionalActionsView.transfer_queue",
                  })}
                  <Icon size="x-small" icon="mdi:chevron-down" />
                </Chip>
              )}
            />
          )}
          {sourceSelectMenuItems.length > 0 && player.attributes.source && (
            <OverlayMenu
              side="bottom"
              menuItems={sourceSelectMenuItems}
              renderTrigger={triggerProps => (
                <Chip
                  {...triggerProps}
                  icon={getSourceIcon({
                    source: player.attributes.source ?? "",
                    fallbackIcon: "mdi:import",
                  })}
                >
                  {player.attributes.source}
                  <Icon size="x-small" icon="mdi:chevron-down" />
                </Chip>
              )}
            />
          )}
          <Chip icon="mdi:information-outline" {...moreInfoButtonProps}>
            {t({
              id: "MediocreMultiMediaPlayerCard.AdditionalActionsView.more_info",
            })}
          </Chip>
        </div>
      </Fragment>
      {isMainEntityLmsPlayer && (
        <Fragment>
          <ViewHeader
            title={t({
              id: "MediocreMultiMediaPlayerCard.AdditionalActionsView.lyrion_info_title",
            })}
          />
          <LyrionTrackInfo lms_entity_id={lms_entity_id ?? undefined} />
        </Fragment>
      )}
      {lms_entity_id && (
        <LyrionRelatedAlbums
          renderHeader={() => (
            <ViewHeader
              subtitle={t({
                id: "MediocreMultiMediaPlayerCard.AdditionalActionsView.related_albums_title",
              })}
            />
          )}
          entity_id={lms_entity_id}
        />
      )}
    </div>
  );
});

const CustomButton = ({
  button,
  entityId,
}: {
  button: InteractionConfig & {
    icon?: string;
    name?: string;
  };
  entityId: string;
}) => {
  const { rootElement } =
    useContext<CardContextType<MediocreMultiMediaPlayerCardConfig>>(
      CardContext
    );
  const { icon, name, ...actionConfig } = button;
  const actionProps = useActionProps({
    rootElement,
    actionConfig: {
      ...actionConfig,
      entity: entityId,
    },
  });

  return (
    <Chip icon={icon} {...actionProps}>
      {!!name && <span>{name}</span>}
      {actionProps.renderLongPressIndicator()}
    </Chip>
  );
};
