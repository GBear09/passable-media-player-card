import type { MediaPlayerEntityAttributes } from "@types";

export type SkipControlsMode = "auto" | "always" | "never";

export type PlaybackPositionInput = {
  state?: string;
  mediaPosition?: number | null;
  mediaPositionUpdatedAt?: string | null;
  mediaDuration?: number | null;
  nowMs?: number;
};

export type PlaybackPositionResult = {
  currentPosition: number;
  mediaDuration: number;
  prettyNow: string;
  prettyEnd: string;
};

/**
 * Formats seconds as MM:SS, or H:MM:SS for durations >= 1 hour.
 * Avoids 60-second rounding overflow (e.g. 02:60) by flooring whole seconds.
 */
export function formatPlaybackTime(seconds: number): string {
  const totalSeconds = Math.floor(
    Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Computes clamped playback position without drifting while paused or idle.
 */
export function calculatePlaybackPosition({
  state,
  mediaPosition,
  mediaPositionUpdatedAt,
  mediaDuration,
  nowMs = Date.now(),
}: PlaybackPositionInput): PlaybackPositionResult | null {
  if (
    mediaPosition == null ||
    mediaPosition < 0 ||
    mediaDuration == null ||
    mediaDuration <= 0
  ) {
    return null;
  }

  let currentPosition = mediaPosition;

  if (state === "playing" && mediaPositionUpdatedAt) {
    const updatedMs = Date.parse(mediaPositionUpdatedAt);
    if (!Number.isNaN(updatedMs)) {
      const elapsedSeconds = Math.max(0, (nowMs - updatedMs) / 1000);
      currentPosition = mediaPosition + elapsedSeconds;
    }
  }

  const clampedPosition = Math.min(mediaDuration, Math.max(0, currentPosition));

  return {
    currentPosition: clampedPosition,
    mediaDuration,
    prettyNow: formatPlaybackTime(clampedPosition),
    prettyEnd: formatPlaybackTime(mediaDuration),
  };
}

/**
 * Determines whether forward/backward skip buttons should be shown.
 * In "auto" mode (default), shows only for podcasts, audiobooks, episodes, or long-form tracks (>= 15 min).
 */
export function shouldShowSkipControls(
  mode: SkipControlsMode | undefined,
  attrs?: MediaPlayerEntityAttributes
): boolean {
  if (mode === "never") return false;
  if (mode === "always") return true;
  if (!attrs) return false;

  const contentType = attrs.media_content_type?.toLowerCase();
  if (
    contentType === "podcast" ||
    contentType === "audiobook" ||
    contentType === "episode"
  ) {
    return true;
  }

  if (
    attrs.media_content_id &&
    /:\/\/(podcast|audiobook|episode)\b/i.test(attrs.media_content_id)
  ) {
    return true;
  }

  if (attrs.media_series_title) {
    return true;
  }

  if ((attrs.media_duration ?? 0) >= 900) {
    return true;
  }

  return false;
}
