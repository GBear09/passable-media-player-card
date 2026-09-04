import { getHass } from "@utils/getHass";

/**
 * Starts a Music Assistant Radio Mix based on a seed (track, artist, or album).
 * @param targetEntityId The media player entity ID to play on.
 * @param maEntityId Optional specific Music Assistant entity ID.
 * @param mediaId The title, artist name, album name, or URI to seed the radio mix.
 * @param mediaType The type of seed: "track", "artist", or "album".
 * @param enqueue Queue behavior ("replace_next", "add", "next", "replace", "play"). Defaults to "replace_next".
 */
export async function startRadioMix(
  targetEntityId: string,
  maEntityId: string | undefined,
  mediaId: string,
  mediaType: "track" | "artist" | "album",
  enqueue: "replace_next" | "add" | "next" | "replace" | "play" = "replace_next"
): Promise<void> {
  const hass = getHass();
  if (!hass) throw new Error("hass object not available");

  const entityId = maEntityId || targetEntityId;

  await hass.callService(
    "music_assistant",
    "play_media",
    {
      media_id: mediaId,
      media_type: mediaType,
      radio_mode: true,
      enqueue,
    },
    { entity_id: entityId }
  );
}
