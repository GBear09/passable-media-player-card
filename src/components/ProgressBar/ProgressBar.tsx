import { css } from "@emotion/react";
import { useRef, useState } from "preact/hooks";

export type ProgressBarProps = {
  min: number;
  max: number;
  value: number;
  onSeek?: (seconds: number) => void;
  onScrubChange?: (seconds: number | null) => void;
};

const styles = {
  hitArea: css({
    position: "relative",
    width: "100%",
    padding: "6px 0",
    margin: "-6px 0",
    cursor: "pointer",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    display: "flex",
    alignItems: "center",
    "&:hover [data-progress-track]": {
      height: "6px",
    },
  }),
  root: css({
    display: "flex",
    flexDirection: "row",
    position: "relative",
    height: "4px",
    width: "100%",
    backgroundColor: "var(--divider-color)",
    borderRadius: "3px",
    overflow: "hidden",
    transition: "height 0.12s ease",
  }),
  rootActive: css({
    height: "6px",
  }),
  progress: css({
    height: "100%",
    backgroundColor: "var(--secondary-text-color)",
    width: "0%",
    transition: "width 1s linear",
  }),
  progressScrubbing: css({
    backgroundColor: "var(--primary-color, var(--primary-text-color))",
    transition: "none",
  }),
  thumb: css({
    position: "absolute",
    top: "50%",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: "var(--primary-color, var(--primary-text-color))",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.35)",
  }),
};

export const ProgressBar = ({
  min,
  max,
  value,
  onSeek,
  onScrubChange,
}: ProgressBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [scrubValue, setScrubValue] = useState<number | null>(null);

  const effectiveValue = scrubValue ?? value;
  const rawPct = max <= min ? 0 : ((effectiveValue - min) / (max - min)) * 100;
  const percentage = Math.min(100, Math.max(0, rawPct));

  const getValueFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track || max <= min) return min;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return min;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return min + ratio * (max - min);
  };

  if (!onSeek) {
    return (
      <div css={styles.root}>
        <div css={styles.progress} style={{ width: `${percentage}%` }} />
      </div>
    );
  }

  const handlePointerDown = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    e.preventDefault();
    target.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    const nextVal = getValueFromClientX(e.clientX);
    setScrubValue(nextVal);
    onScrubChange?.(nextVal);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const nextVal = getValueFromClientX(e.clientX);
    setScrubValue(nextVal);
    onScrubChange?.(nextVal);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const finalVal = getValueFromClientX(e.clientX);
    setScrubValue(null);
    onScrubChange?.(null);
    onSeek(finalVal);
  };

  const isScrubbing = scrubValue !== null;

  return (
    <div
      css={styles.hitArea}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      aria-label="Seek position"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(effectiveValue)}
    >
      <div
        ref={trackRef}
        data-progress-track=""
        css={[styles.root, isScrubbing && styles.rootActive]}
      >
        <div
          css={[styles.progress, isScrubbing && styles.progressScrubbing]}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isScrubbing && (
        <div css={styles.thumb} style={{ left: `${percentage}%` }} />
      )}
    </div>
  );
};
