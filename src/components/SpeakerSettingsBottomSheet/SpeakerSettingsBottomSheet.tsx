import { css, keyframes } from "@emotion/react";
import { memo } from "preact/compat";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { Icon, IconButton, Select, Slider, useHass } from "@components";
import { theme } from "@constants";
import { useSelectedPlayer } from "@components/SelectedPlayerContext";
import {
  formatSpeakerSettingLabel,
  getHass,
  getSpeakerSettingsEntities,
} from "@utils";
import { useMassQueueInfo } from "@hooks";
import { useIntl } from "@components/i18n";

const slideUp = keyframes`
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0%);
    opacity: 1;
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const styles = {
  overlay: css({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    backdropFilter: "blur(4px)",
    animation: `${fadeIn} 0.2s ease-out`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    overflow: "hidden",
  }),
  clickableBackdrop: css({
    position: "absolute",
    inset: 0,
    zIndex: 0,
  }),
  bottomSheet: css({
    position: "relative",
    zIndex: 1,
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: "16px",
    borderTopRightRadius: "16px",
    border: "1px solid var(--ha-card-border-color, rgba(255, 255, 255, 0.12))",
    borderBottom: "none",
    maxHeight: "85%",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.45)",
    animation: `${slideUp} 0.28s cubic-bezier(0.2, 0.9, 0.3, 1) forwards`,
    overflow: "hidden",
  }),
  handleBar: css({
    width: "36px",
    height: "4px",
    borderRadius: "2px",
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    margin: "8px auto 0 auto",
    flexShrink: 0,
  }),
  header: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px 12px 16px",
    borderBottom: "1px solid var(--divider-color, rgba(255, 255, 255, 0.1))",
    flexShrink: 0,
    gap: "8px",
  }),
  headerLeft: css({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    overflow: "hidden",
  }),
  title: css({
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: theme.colors.onCard,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  content: css({
    padding: "16px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  }),
  section: css({
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  }),
  sectionTitle: css({
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: theme.colors.onCardMuted,
    margin: "0 0 2px 0",
  }),
  sliderItem: css({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  }),
  sliderHeader: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
    color: theme.colors.onCard,
  }),
  sliderName: css({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 500,
  }),
  sliderValue: css({
    fontSize: "13px",
    fontWeight: 600,
    color: theme.colors.onCardMuted,
  }),
  switchGrid: css({
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
  }),
  switchRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: "8px",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    cursor: "pointer",
    userSelect: "none",
    transition: "background-color 0.15s ease",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.07)",
    },
  }),
  switchLeft: css({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 500,
    color: theme.colors.onCard,
  }),
  togglePill: css({
    width: "36px",
    height: "20px",
    borderRadius: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    position: "relative",
    transition: "background-color 0.2s ease",
  }),
  togglePillActive: css({
    backgroundColor: "var(--primary-color, #03a9f4)",
  }),
  toggleThumb: css({
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    position: "absolute",
    top: "2px",
    left: "2px",
    transition: "transform 0.2s ease",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
  }),
  toggleThumbActive: css({
    transform: "translateX(16px)",
  }),
  selectItem: css({
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  }),
  selectLabel: css({
    fontSize: "13px",
    fontWeight: 500,
    color: theme.colors.onCard,
  }),
  emptyState: css({
    textAlign: "center",
    padding: "24px 16px",
    color: theme.colors.onCardMuted,
    fontSize: "14px",
  }),
  badgeRow: css({
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "2px",
  }),
  statusBadge: css({
    fontSize: "11px",
    fontWeight: 500,
    padding: "3px 8px",
    borderRadius: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    color: theme.colors.onCardMuted,
  }),
};

function getNumberIcon(entityId: string): string {
  if (entityId.includes("bass") || entityId.includes("treble"))
    return "mdi:equalizer";
  if (entityId.includes("sub_gain") || entityId.includes("subwoofer"))
    return "mdi:speaker";
  if (entityId.includes("balance")) return "mdi:scale-balance";
  if (entityId.includes("delay")) return "mdi:timer-sand";
  if (entityId.includes("surround")) return "mdi:surround-sound";
  return "mdi:tune";
}

function getSwitchIcon(entityId: string): string {
  if (entityId.includes("loudness")) return "mdi:volume-high";
  if (entityId.includes("night_sound")) return "mdi:weather-night";
  if (entityId.includes("speech")) return "mdi:account-voice";
  if (entityId.includes("crossfade")) return "mdi:waveform";
  if (entityId.includes("subwoofer")) return "mdi:speaker";
  if (entityId.includes("surround")) return "mdi:surround-sound";
  return "mdi:toggle-switch";
}

export type SpeakerSettingsBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const SpeakerSettingsBottomSheet = memo<SpeakerSettingsBottomSheetProps>(
  ({ isOpen, onClose }) => {
    const { t } = useIntl();
    const hass = useHass();
    const { selectedPlayer } = useSelectedPlayer();
    const [refreshTick, setRefreshTick] = useState(0);
    const [optimisticStates, setOptimisticStates] = useState<
      Record<string, string>
    >({});

    useEffect(() => {
      if (!isOpen) {
        setOptimisticStates({});
        return;
      }
      const interval = window.setInterval(() => {
        setRefreshTick(prev => prev + 1);
      }, 1500);
      return () => window.clearInterval(interval);
    }, [isOpen]);

    const speakerName = selectedPlayer?.name || "Speaker";
    const entityId = selectedPlayer?.entity_id || "";
    const maEntityId = selectedPlayer?.ma_entity_id;
    const speakerGroupEntityId = selectedPlayer?.speaker_group_entity_id;

    const {
      queueInfo,
      updating: queueInfoUpdating,
      canSetAutoplay,
      canSetCrossfade,
      toggleAutoplay,
      toggleCrossfade,
    } = useMassQueueInfo(maEntityId, isOpen && Boolean(maEntityId));

    // Read fresh hass when open so switch/number/select changes and registry metadata reflect immediately
    const liveHass = useMemo(() => {
      const currentHass = getHass();
      return currentHass?.states ? currentHass : hass;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshTick polls live entity state changes while open
    }, [hass, refreshTick]);

    const liveStates = liveHass?.states;

    // Discover settings entities matching the speaker device
    const { numbers, switches, selects, deviceNames } = useMemo(
      () =>
        getSpeakerSettingsEntities(liveHass, {
          entityId,
          maEntityId,
          speakerGroupEntityId,
        }),
      [liveHass, entityId, maEntityId, speakerGroupEntityId]
    );

    const labelPrefixes = useMemo(
      () => [
        speakerName,
        liveStates?.[entityId]?.attributes?.friendly_name,
        ...deviceNames,
      ],
      [speakerName, liveStates, entityId, deviceNames]
    );

    const handleNumberChange = useCallback(
      (numberEntityId: string, value: number) => {
        setOptimisticStates(prev => ({
          ...prev,
          [numberEntityId]: String(value),
        }));
        getHass().callService("number", "set_value", {
          entity_id: numberEntityId,
          value,
        });
      },
      []
    );

    const handleSwitchToggle = useCallback(
      (switchEntityId: string, currentlyOn: boolean) => {
        setOptimisticStates(prev => ({
          ...prev,
          [switchEntityId]: currentlyOn ? "off" : "on",
        }));
        getHass().callService("switch", "toggle", {
          entity_id: switchEntityId,
        });
      },
      []
    );

    const handleSelectChange = useCallback(
      (selectEntityId: string, option: string) => {
        setOptimisticStates(prev => ({
          ...prev,
          [selectEntityId]: option,
        }));
        getHass().callService("select", "select_option", {
          entity_id: selectEntityId,
          option,
        });
      },
      []
    );

    // Clear optimistic overrides once live state catches up
    useEffect(() => {
      if (!liveStates || Object.keys(optimisticStates).length === 0) return;
      setOptimisticStates(prev => {
        let changed = false;
        const next = { ...prev };
        for (const [id, val] of Object.entries(prev)) {
          if (liveStates[id]?.state === val) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, [liveStates, optimisticStates]);

    if (!isOpen) return null;

    const showMaSection = Boolean(
      maEntityId && (canSetAutoplay || canSetCrossfade || queueInfo)
    );
    const hasAnyControls =
      showMaSection ||
      numbers.length > 0 ||
      switches.length > 0 ||
      selects.length > 0;

    return (
      <div css={styles.overlay}>
        <div css={styles.clickableBackdrop} onClick={onClose} />
        <div css={styles.bottomSheet}>
          <div css={styles.handleBar} />
          <div css={styles.header}>
            <div css={styles.headerLeft}>
              <Icon size="small" icon="mdi:tune" />
              <h3 css={styles.title}>{speakerName} Settings</h3>
            </div>
            <IconButton icon="mdi:close" size="small" onClick={onClose} />
          </div>

          <div css={styles.content}>
            {!hasAnyControls ? (
              <div css={styles.emptyState}>
                No adjustable settings found for {speakerName}.
              </div>
            ) : null}

            {showMaSection && (
              <div css={styles.section}>
                <h4 css={styles.sectionTitle}>
                  {t({
                    id: "Settings.ma_queue_section",
                    defaultMessage: "Music Assistant Queue",
                  })}
                </h4>
                {queueInfo ? (
                  <div css={styles.switchGrid}>
                    {canSetAutoplay && (
                      <div
                        css={styles.switchRow}
                        onClick={() => {
                          if (!queueInfoUpdating) toggleAutoplay();
                        }}
                      >
                        <span css={styles.switchLeft}>
                          <Icon size="x-small" icon="mdi:infinity" />
                          {t({
                            id: "Settings.ma_autoplay",
                            defaultMessage: "Autoplay (Don't Stop the Music)",
                          })}
                        </span>
                        <div
                          css={[
                            styles.togglePill,
                            queueInfo.autoplay_enabled &&
                              styles.togglePillActive,
                          ]}
                        >
                          <div
                            css={[
                              styles.toggleThumb,
                              queueInfo.autoplay_enabled &&
                                styles.toggleThumbActive,
                            ]}
                          />
                        </div>
                      </div>
                    )}
                    {canSetCrossfade && (
                      <div
                        css={styles.switchRow}
                        onClick={() => {
                          if (!queueInfoUpdating) toggleCrossfade();
                        }}
                      >
                        <span css={styles.switchLeft}>
                          <Icon size="x-small" icon="mdi:waveform" />
                          {t({
                            id: "Settings.ma_crossfade",
                            defaultMessage: "MA Queue Crossfade",
                          })}
                        </span>
                        <div
                          css={[
                            styles.togglePill,
                            queueInfo.crossfade_enabled &&
                              styles.togglePillActive,
                          ]}
                        >
                          <div
                            css={[
                              styles.toggleThumb,
                              queueInfo.crossfade_enabled &&
                                styles.toggleThumbActive,
                            ]}
                          />
                        </div>
                      </div>
                    )}
                    {(queueInfo.flow_mode ||
                      queueInfo.smart_fades_active ||
                      queueInfo.smart_shuffle_active ||
                      (queueInfo.playback_speed &&
                        queueInfo.playback_speed !== 1)) && (
                      <div css={styles.badgeRow}>
                        {queueInfo.flow_mode && (
                          <span css={styles.statusBadge}>Flow Mode</span>
                        )}
                        {queueInfo.smart_fades_active && (
                          <span css={styles.statusBadge}>Smart Fades</span>
                        )}
                        {queueInfo.smart_shuffle_active && (
                          <span css={styles.statusBadge}>Smart Shuffle</span>
                        )}
                        {queueInfo.playback_speed &&
                          queueInfo.playback_speed !== 1 && (
                            <span css={styles.statusBadge}>
                              Speed {queueInfo.playback_speed}x
                            </span>
                          )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div css={styles.statusBadge}>
                    {t({
                      id: "Settings.ma_no_active_queue",
                      defaultMessage:
                        "Start playback to configure Music Assistant queue options.",
                    })}
                  </div>
                )}
              </div>
            )}

            {numbers.length > 0 && (
              <div css={styles.section}>
                <h4 css={styles.sectionTitle}>Equalizer & Levels</h4>
                {numbers.map(num => {
                  const effectiveState =
                    optimisticStates[num.entity_id] ?? num.state;
                  const val = parseFloat(effectiveState) || 0;
                  const min = num.attributes.min ?? -10;
                  const max = num.attributes.max ?? 10;
                  const step = num.attributes.step ?? 1;
                  const unit = num.attributes.unit_of_measurement || "";
                  const label = formatSpeakerSettingLabel(
                    num.attributes.friendly_name || num.entity_id,
                    labelPrefixes
                  );
                  const icon = getNumberIcon(num.entity_id);

                  return (
                    <div key={num.entity_id} css={styles.sliderItem}>
                      <div css={styles.sliderHeader}>
                        <span css={styles.sliderName}>
                          <Icon size="x-small" icon={icon} />
                          {label}
                        </span>
                        <span css={styles.sliderValue}>
                          {val > 0 && unit === "" ? `+${val}` : val}
                          {unit}
                        </span>
                      </div>
                      <Slider
                        min={min}
                        max={max}
                        step={step}
                        value={val}
                        unit={unit}
                        sliderSize="small"
                        showStepButtons={true}
                        onChange={newVal =>
                          handleNumberChange(num.entity_id, newVal)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {switches.length > 0 && (
              <div css={styles.section}>
                <h4 css={styles.sectionTitle}>Audio Features</h4>
                <div css={styles.switchGrid}>
                  {switches.map(sw => {
                    const effectiveState =
                      optimisticStates[sw.entity_id] ?? sw.state;
                    const isOn = effectiveState === "on";
                    const label = formatSpeakerSettingLabel(
                      sw.attributes.friendly_name || sw.entity_id,
                      labelPrefixes
                    );
                    const icon = getSwitchIcon(sw.entity_id);

                    return (
                      <div
                        key={sw.entity_id}
                        css={styles.switchRow}
                        onClick={() => handleSwitchToggle(sw.entity_id, isOn)}
                      >
                        <span css={styles.switchLeft}>
                          <Icon size="x-small" icon={icon} />
                          {label}
                        </span>
                        <div
                          css={[
                            styles.togglePill,
                            isOn && styles.togglePillActive,
                          ]}
                        >
                          <div
                            css={[
                              styles.toggleThumb,
                              isOn && styles.toggleThumbActive,
                            ]}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selects.length > 0 && (
              <div css={styles.section}>
                <h4 css={styles.sectionTitle}>Audio Modes</h4>
                {selects.map(sel => {
                  const effectiveState =
                    optimisticStates[sel.entity_id] ?? sel.state;
                  const label = formatSpeakerSettingLabel(
                    sel.attributes.friendly_name || sel.entity_id,
                    labelPrefixes
                  );
                  const options = (sel.attributes.options || []).map(
                    (opt: string) => ({
                      label: opt,
                      value: opt,
                    })
                  );

                  return (
                    <div key={sel.entity_id} css={styles.selectItem}>
                      <span css={styles.selectLabel}>{label}</span>
                      <Select
                        value={effectiveState}
                        options={options}
                        onChange={item =>
                          handleSelectChange(sel.entity_id, item.value)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);
