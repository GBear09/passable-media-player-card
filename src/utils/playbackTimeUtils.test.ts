import {
  calculatePlaybackPosition,
  formatPlaybackTime,
  shouldShowSkipControls,
} from "./playbackTimeUtils";

describe("playbackTimeUtils", () => {
  describe("formatPlaybackTime", () => {
    it("formats MM:SS without overflowing to 60 seconds", () => {
      expect(formatPlaybackTime(0)).toBe("00:00");
      expect(formatPlaybackTime(179.9)).toBe("02:59");
      expect(formatPlaybackTime(180)).toBe("03:00");
      expect(formatPlaybackTime(-5)).toBe("00:00");
    });

    it("formats durations >= 1 hour as H:MM:SS", () => {
      expect(formatPlaybackTime(3600)).toBe("1:00:00");
      expect(formatPlaybackTime(4523)).toBe("1:15:23");
    });
  });

  describe("calculatePlaybackPosition", () => {
    it("returns null when required values are missing or invalid", () => {
      expect(
        calculatePlaybackPosition({
          state: "playing",
          mediaPosition: null,
          mediaDuration: 200,
        })
      ).toBeNull();
      expect(
        calculatePlaybackPosition({
          state: "playing",
          mediaPosition: 10,
          mediaDuration: 0,
        })
      ).toBeNull();
    });

    it("does not advance elapsed time while paused", () => {
      const result = calculatePlaybackPosition({
        state: "paused",
        mediaPosition: 90,
        mediaPositionUpdatedAt: "2026-11-19T10:00:00.000Z",
        mediaDuration: 180,
        nowMs: Date.parse("2026-11-19T10:05:00.000Z"),
      });
      expect(result).toEqual({
        currentPosition: 90,
        mediaDuration: 180,
        prettyNow: "01:30",
        prettyEnd: "03:00",
      });
    });

    it("interpolates and clamps elapsed time while playing", () => {
      const playing = calculatePlaybackPosition({
        state: "playing",
        mediaPosition: 30,
        mediaPositionUpdatedAt: "2026-11-19T10:00:00.000Z",
        mediaDuration: 180,
        nowMs: Date.parse("2026-11-19T10:00:45.000Z"),
      });
      expect(playing?.currentPosition).toBe(75);
      expect(playing?.prettyNow).toBe("01:15");

      const clamped = calculatePlaybackPosition({
        state: "playing",
        mediaPosition: 170,
        mediaPositionUpdatedAt: "2026-11-19T10:00:00.000Z",
        mediaDuration: 180,
        nowMs: Date.parse("2026-11-19T10:05:00.000Z"),
      });
      expect(clamped?.currentPosition).toBe(180);
      expect(clamped?.prettyNow).toBe("03:00");
    });
  });

  describe("shouldShowSkipControls", () => {
    it("respects always and never modes", () => {
      expect(shouldShowSkipControls("always", {})).toBe(true);
      expect(
        shouldShowSkipControls("never", { media_content_type: "podcast" })
      ).toBe(false);
    });

    it("auto mode shows for podcasts, audiobooks, episodes, series, and long tracks >= 15 min", () => {
      expect(
        shouldShowSkipControls("auto", {
          media_content_type: "music",
          media_duration: 210,
        })
      ).toBe(false);
      expect(
        shouldShowSkipControls("auto", { media_content_type: "podcast" })
      ).toBe(true);
      expect(
        shouldShowSkipControls("auto", { media_content_type: "audiobook" })
      ).toBe(true);
      expect(
        shouldShowSkipControls("auto", {
          media_content_id: "library://podcast/12",
        })
      ).toBe(true);
      expect(
        shouldShowSkipControls("auto", { media_series_title: "Daily News" })
      ).toBe(true);
      expect(shouldShowSkipControls("auto", { media_duration: 900 })).toBe(
        true
      );
    });
  });
});
