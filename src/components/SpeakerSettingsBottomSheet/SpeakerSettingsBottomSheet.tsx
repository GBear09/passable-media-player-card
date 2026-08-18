import { css, keyframes } from "@emotion/react";
import { memo } from "preact/compat";
import { useCallback, useMemo } from "preact/hooks";
import { Icon, IconButton, Select, Slider, useHass } from "@components";
import { theme } from "@constants";
import { useSelectedPlayer } from "@components/SelectedPlayerContext";
import { getHass } from "@utils";
import { HassEntity } from "home-assistant-js-websocket";

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

function formatFriendlyName(name: string, prefix: string): string {
  let cleaned = name;
  const regex = new RegExp(`^${prefix}\\s*`, "i");
  cleaned = cleaned.replace(regex, "");
  return cleaned.trim() || name;
}

export type SpeakerSettingsBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const SpeakerSettingsBottomSheet = memo<SpeakerSettingsBottomSheetProps>(
  ({ isOpen, onClose }) => {
    const hass = useHass();
    const { selectedPlayer } = useSelectedPlayer();

    const speakerName = selectedPlayer?.name || "Speaker";
    const entityId = selectedPlayer?.entity_id || "";
    const baseName = entityId.replace("media_player.", "").replace(/_ma$/, "");

    // Discover settings entities matching speaker
    const { numbers, switches, selects } = useMemo(() => {
      if (!hass?.states || !baseName) {
        return { numbers: [], switches: [], selects: [] };
      }

      const allStates = Object.values(hass.states) as HassEntity[];
      const speakerPattern = new RegExp(
        `^(number|switch|select)\\.${baseName}_`,
        "i"
      );

      const foundNumbers: HassEntity[] = [];
      const foundSwitches: HassEntity[] = [];
      const foundSelects: HassEntity[] = [];

      for (const entity of allStates) {
        if (entity.state === "unavailable" || entity.state === "unknown")
          continue;
        if (speakerPattern.test(entity.entity_id)) {
          if (entity.entity_id.startsWith("number.")) {
            foundNumbers.push(entity);
          } else if (entity.entity_id.startsWith("switch.")) {
            foundSwitches.push(entity);
          } else if (entity.entity_id.startsWith("select.")) {
            foundSelects.push(entity);
          }
        }
      }

      // Sort numbers logically (bass, treble, balance, etc.)
      foundNumbers.sort((a, b) =>
        (a.attributes.friendly_name || "").localeCompare(
          b.attributes.friendly_name || ""
        )
      );

      foundSwitches.sort((a, b) =>
        (a.attributes.friendly_name || "").localeCompare(
          b.attributes.friendly_name || ""
        )
      );

      return {
        numbers: foundNumbers,
        switches: foundSwitches,
        selects: foundSelects,
      };
    }, [hass?.states, baseName]);

    const handleNumberChange = useCallback(
      (numberEntityId: string, value: number) => {
        getHass().callService("number", "set_value", {
          entity_id: numberEntityId,
          value,
        });
      },
      []
    );

    const handleSwitchToggle = useCallback((switchEntityId: string) => {
      getHass().callService("switch", "toggle", {
        entity_id: switchEntityId,
      });
    }, []);

    const handleSelectChange = useCallback(
      (selectEntityId: string, option: string) => {
        getHass().callService("select", "select_option", {
          entity_id: selectEntityId,
          option,
        });
      },
      []
    );

    if (!isOpen) return null;

    const hasAnyControls =
      numbers.length > 0 || switches.length > 0 || selects.length > 0;

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

            {numbers.length > 0 && (
              <div css={styles.section}>
                <h4 css={styles.sectionTitle}>Equalizer & Levels</h4>
                {numbers.map(num => {
                  const val = parseFloat(num.state) || 0;
                  const min = num.attributes.min ?? -10;
                  const max = num.attributes.max ?? 10;
                  const step = num.attributes.step ?? 1;
                  const unit = num.attributes.unit_of_measurement || "";
                  const label = formatFriendlyName(
                    num.attributes.friendly_name || num.entity_id,
                    speakerName
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
                    const isOn = sw.state === "on";
                    const label = formatFriendlyName(
                      sw.attributes.friendly_name || sw.entity_id,
                      speakerName
                    );
                    const icon = getSwitchIcon(sw.entity_id);

                    return (
                      <div
                        key={sw.entity_id}
                        css={styles.switchRow}
                        onClick={() => handleSwitchToggle(sw.entity_id)}
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
                  const label = formatFriendlyName(
                    sel.attributes.friendly_name || sel.entity_id,
                    speakerName
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
                        value={sel.state}
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
