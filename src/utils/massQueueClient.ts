import type { MediaPlayerEntityAttributes } from "@types";
import { getHass } from "./getHass";
import { getHassMessageWithCache } from "./getHassMessageWithCache";

export type MassPlayerInfo = {
  available?: boolean;
  entries?: {
    music_assistant?: string;
    mass_queue?: string;
  };
  queue_id?: string | null;
  player_id?: string;
  can_group_with?: string[];
  synced_to?: string | null;
};

export type MassQueueInfo = {
  autoplay_enabled: boolean;
  crossfade_enabled: boolean;
  display_name?: string;
  ended?: boolean;
  flow_mode?: boolean;
  playback_speed?: number;
  smart_fades_active?: boolean;
  smart_shuffle_active?: boolean;
};

export type MassTrackItem = {
  media_title: string;
  media_content_id: string;
  duration?: number;
  media_image?: string;
  local_image_encoded?: string;
  favorite?: boolean;
  media_album_name?: string;
  media_artist?: string;
  position?: number;
  release_date?: string;
};

export type MassSimilarArtist = {
  uri: string;
  name: string;
  image?: string | null;
  favorite?: boolean;
  item_id?: string;
  provider?: string;
};

export type MassRecommendationItem = {
  item_id?: string;
  name: string;
  uri: string;
  media_type: string;
  image?: string | null;
};

export type MassRecommendationFolder = {
  name: string;
  item_id?: string;
  uri?: string;
  items: MassRecommendationItem[];
};

export type MaEnqueueMode =
  | "play"
  | "replace"
  | "next"
  | "replace_next"
  | "add";

/**
 * Checks whether the mass_queue domain is registered in Home Assistant.
 */
export function hasMassQueueDomain(): boolean {
  const hass = getHass();
  return Boolean(hass?.services?.["mass_queue"]);
}

/**
 * Checks whether a specific mass_queue service action is registered in Home Assistant.
 */
export function hasMassQueueService(serviceName: string): boolean {
  const hass = getHass();
  return Boolean(hass?.services?.["mass_queue"]?.[serviceName]);
}

function readImageEntry(entry: unknown): string | null {
  if (typeof entry === "string" && entry.trim().length > 0) {
    return entry;
  }
  if (entry && typeof entry === "object" && "path" in entry) {
    const path = (entry as { path?: unknown }).path;
    if (typeof path === "string" && path.trim().length > 0) {
      return path;
    }
  }
  return null;
}

/**
 * Extracts the best available image URL or base64 data URI from an MA or mass_queue item.
 */
export function extractMaImage(item: Record<string, unknown>): string | null {
  const encoded = readImageEntry(item["local_image_encoded"]);
  if (encoded) return encoded;

  const mediaImage = readImageEntry(item["media_image"]);
  if (mediaImage) return mediaImage;

  const directImage = readImageEntry(item["image"]);
  if (directImage) return directImage;

  const metadata = item["metadata"] as
    | { images?: Array<Record<string, unknown>> }
    | undefined;
  const images = metadata?.images;
  if (Array.isArray(images) && images.length > 0) {
    const accessibleThumb = images.find(
      img =>
        img?.["type"] === "thumb" &&
        img?.["remotely_accessible"] === true &&
        readImageEntry(img)
    );
    if (accessibleThumb) return readImageEntry(accessibleThumb);

    const anyThumb = images.find(
      img => img?.["type"] === "thumb" && readImageEntry(img)
    );
    if (anyThumb) return readImageEntry(anyThumb);

    for (const img of images) {
      const candidate = readImageEntry(img);
      if (candidate) return candidate;
    }
  }

  return null;
}

/**
 * Downloads and base64-encodes an image URL via mass_queue/download_and_encode_image.
 * Useful when an HTTP local-network image is blocked on HTTPS dashboards.
 */
export async function downloadAndEncodeMassImage(
  url: string
): Promise<string | null> {
  if (!url || !hasMassQueueDomain()) return null;
  try {
    const result = await getHassMessageWithCache<string | null>(
      {
        type: "mass_queue/download_and_encode_image",
        url,
      },
      { staleTime: 300000 }
    );
    return typeof result === "string" && result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Calls mass_queue/get_info WebSocket command for a Music Assistant player entity.
 */
export async function getMassPlayerInfo(
  maEntityId: string
): Promise<MassPlayerInfo | null> {
  if (!maEntityId || !hasMassQueueDomain()) return null;
  try {
    const result = await getHassMessageWithCache<MassPlayerInfo>(
      {
        type: "mass_queue/get_info",
        entity_id: maEntityId,
      },
      { staleTime: 300000 }
    );
    return result ?? null;
  } catch {
    return null;
  }
}

let cachedConfigEntries: {
  timestamp: number;
  entries: Array<Record<string, unknown>>;
} | null = null;
let inFlightConfigEntries: Promise<Array<Record<string, unknown>>> | null =
  null;

async function fetchConfigEntriesSafe(): Promise<
  Array<Record<string, unknown>>
> {
  const now = Date.now();
  if (cachedConfigEntries && now - cachedConfigEntries.timestamp < 300000) {
    return cachedConfigEntries.entries;
  }
  if (inFlightConfigEntries) {
    return inFlightConfigEntries;
  }
  const hass = getHass();
  if (!hass?.callApi) return [];

  inFlightConfigEntries = hass
    .callApi<Array<Record<string, unknown>>>(
      "GET",
      "config/config_entries/entry"
    )
    .then(entries => {
      const normalized = Array.isArray(entries) ? entries : [];
      cachedConfigEntries = { timestamp: Date.now(), entries: normalized };
      return normalized;
    })
    .catch(() => [])
    .finally(() => {
      inFlightConfigEntries = null;
    });

  return inFlightConfigEntries;
}

/**
 * Resolves the config_entry_id for `music_assistant` or `mass_queue`.
 * Prefers `mass_queue/get_info` (works for non-admin HA users) before falling back to REST config entries.
 */
export async function getConfigEntryId(
  domain: "music_assistant" | "mass_queue",
  maEntityId?: string | null
): Promise<string | null> {
  if (maEntityId && hasMassQueueDomain()) {
    const info = await getMassPlayerInfo(maEntityId);
    const entryId = info?.entries?.[domain];
    if (entryId) return entryId;
  }

  const entries = await fetchConfigEntriesSafe();
  const domainEntries = entries.filter(entry => entry?.["domain"] === domain);
  const loaded =
    domainEntries.find(entry => entry?.["state"] === "loaded") ??
    domainEntries[0];

  const entryId = loaded?.["entry_id"];
  return typeof entryId === "string" && entryId.length > 0 ? entryId : null;
}

/**
 * Clears cached config entry lookups (intended primarily for unit tests).
 */
export function clearMassConfigEntryCache(): void {
  cachedConfigEntries = null;
  inFlightConfigEntries = null;
}

/**
 * Fetches live queue settings and flags via `mass_queue/get_queue_info`.
 */
export async function getMassQueueInfo(
  maEntityId: string,
  forceRefresh = false
): Promise<MassQueueInfo | null> {
  if (!maEntityId || !hasMassQueueDomain()) return null;
  try {
    const result = await getHassMessageWithCache<MassQueueInfo>(
      {
        type: "mass_queue/get_queue_info",
        entity_id: maEntityId,
      },
      { staleTime: 10000, forceRefresh }
    );
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Skips forward or backward by `seconds` using `mass_queue.skip`,
 * falling back to `media_player.media_seek` when `skip` is unavailable.
 */
export async function skipMassQueue(
  maEntityId: string | undefined,
  seconds: number,
  fallbackEntityId?: string,
  currentPosition?: number,
  duration?: number
): Promise<void> {
  const hass = getHass();
  if (!hass) throw new Error("Home Assistant connection unavailable");

  if (maEntityId && hasMassQueueService("skip")) {
    await hass.callService("mass_queue", "skip", {
      entity: maEntityId,
      skip_seconds: Math.round(seconds),
    });
    return;
  }

  const seekEntityId = maEntityId || fallbackEntityId;
  if (seekEntityId && typeof currentPosition === "number") {
    const rawTarget = currentPosition + seconds;
    const clampedTarget =
      typeof duration === "number" && duration > 0
        ? Math.min(duration, Math.max(0, rawTarget))
        : Math.max(0, rawTarget);
    await hass.callService("media_player", "media_seek", {
      entity_id: seekEntityId,
      seek_position: clampedTarget,
    });
    return;
  }

  throw new Error("Skip action is unavailable for this player");
}

/**
 * Enables or disables Autoplay (Don't Stop the Music) via `mass_queue.set_autoplay`.
 * Includes an automatic fallback to `mass_queue.send_command` (`player_queues/autoplay`)
 * to work around an upstream kwarg bug in mass_queue v0.11.0 (`crossfade_enabled` typo).
 */
export async function setMassAutoplay(
  maEntityId: string,
  enabled: boolean
): Promise<void> {
  const hass = getHass();
  if (!hass) throw new Error("Home Assistant connection unavailable");

  if (hasMassQueueService("set_autoplay")) {
    try {
      await hass.callService("mass_queue", "set_autoplay", {
        entity: maEntityId,
        enabled,
      });
      return;
    } catch (primaryErr) {
      if (!hasMassQueueService("send_command")) {
        throw primaryErr;
      }
      // Fallback via send_command when upstream set_autoplay raises TypeError
      const massQueueEntryId = await getConfigEntryId("mass_queue", maEntityId);
      const info = await getMassPlayerInfo(maEntityId);
      const queueId =
        info?.queue_id ||
        (
          hass.states?.[maEntityId]?.attributes as
            | MediaPlayerEntityAttributes
            | undefined
        )?.active_queue;

      if (!massQueueEntryId || !queueId) {
        throw primaryErr;
      }

      await hass.callService("mass_queue", "send_command", {
        config_entry_id: massQueueEntryId,
        command: "player_queues/autoplay",
        data: {
          queue_id: queueId,
          autoplay_enabled: enabled,
        },
      });
      return;
    }
  }

  throw new Error("mass_queue.set_autoplay is not available");
}

/**
 * Enables or disables Crossfade via `mass_queue.set_crossfade`.
 */
export async function setMassCrossfade(
  maEntityId: string,
  enabled: boolean
): Promise<void> {
  const hass = getHass();
  if (!hass) throw new Error("Home Assistant connection unavailable");

  if (!hasMassQueueService("set_crossfade")) {
    throw new Error("mass_queue.set_crossfade is not available");
  }

  await hass.callService("mass_queue", "set_crossfade", {
    entity: maEntityId,
    enabled,
  });
}

function normalizeTrackItem(raw: Record<string, unknown>): MassTrackItem {
  const title =
    typeof raw["media_title"] === "string"
      ? raw["media_title"]
      : typeof raw["name"] === "string"
        ? raw["name"]
        : "Unknown Track";
  const uri =
    typeof raw["media_content_id"] === "string"
      ? raw["media_content_id"]
      : typeof raw["uri"] === "string"
        ? raw["uri"]
        : "";

  let artist =
    typeof raw["media_artist"] === "string" ? raw["media_artist"] : undefined;
  if (!artist && Array.isArray(raw["artists"])) {
    artist = (raw["artists"] as Array<Record<string, unknown>>)
      .map(a => (typeof a?.["name"] === "string" ? a["name"] : ""))
      .filter(Boolean)
      .join(", ");
  }

  let album =
    typeof raw["media_album_name"] === "string"
      ? raw["media_album_name"]
      : undefined;
  if (!album && raw["album"] && typeof raw["album"] === "object") {
    const albumName = (raw["album"] as Record<string, unknown>)["name"];
    if (typeof albumName === "string") album = albumName;
  }

  const image = extractMaImage(raw) ?? undefined;
  const localEncoded =
    typeof raw["local_image_encoded"] === "string"
      ? raw["local_image_encoded"]
      : undefined;

  return {
    media_title: title,
    media_content_id: uri,
    duration: typeof raw["duration"] === "number" ? raw["duration"] : undefined,
    media_image: image,
    local_image_encoded: localEncoded,
    favorite:
      typeof raw["favorite"] === "boolean" ? raw["favorite"] : undefined,
    media_album_name: album,
    media_artist: artist,
    position: typeof raw["position"] === "number" ? raw["position"] : undefined,
    release_date:
      typeof raw["release_date"] === "string" ? raw["release_date"] : undefined,
  };
}

/**
 * Fetches similar tracks for a given track URI via `mass_queue.get_similar_tracks`.
 */
export async function getSimilarTracks(
  maEntityId: string | undefined,
  trackUri: string
): Promise<MassTrackItem[]> {
  if (!trackUri || !hasMassQueueService("get_similar_tracks")) return [];
  const configEntryId = await getConfigEntryId("mass_queue", maEntityId);
  if (!configEntryId) {
    throw new Error("Could not resolve mass_queue config entry");
  }

  const res = await getHassMessageWithCache<{
    response?: { tracks?: Array<Record<string, unknown>> };
  }>(
    {
      type: "call_service",
      domain: "mass_queue",
      service: "get_similar_tracks",
      service_data: {
        config_entry_id: configEntryId,
        uri: trackUri,
      },
      return_response: true,
    },
    { staleTime: 60000 }
  );

  const tracks = res?.response?.tracks;
  return Array.isArray(tracks) ? tracks.map(normalizeTrackItem) : [];
}

/**
 * Fetches similar artists for a given artist URI via `mass_queue.get_similar_artists`.
 */
export async function getSimilarArtists(
  maEntityId: string | undefined,
  artistUri: string
): Promise<MassSimilarArtist[]> {
  if (!artistUri || !hasMassQueueService("get_similar_artists")) return [];
  const configEntryId = await getConfigEntryId("mass_queue", maEntityId);
  if (!configEntryId) {
    throw new Error("Could not resolve mass_queue config entry");
  }

  const res = await getHassMessageWithCache<{
    response?: { artists?: Array<Record<string, unknown>> };
  }>(
    {
      type: "call_service",
      domain: "mass_queue",
      service: "get_similar_artists",
      service_data: {
        config_entry_id: configEntryId,
        uri: artistUri,
      },
      return_response: true,
    },
    { staleTime: 60000 }
  );

  const artists = res?.response?.artists;
  if (!Array.isArray(artists)) return [];

  return artists
    .map(raw => ({
      uri: typeof raw?.["uri"] === "string" ? raw["uri"] : "",
      name: typeof raw?.["name"] === "string" ? raw["name"] : "Unknown Artist",
      image: extractMaImage(raw),
      favorite:
        typeof raw?.["favorite"] === "boolean" ? raw["favorite"] : undefined,
      item_id:
        typeof raw?.["item_id"] === "string" ? raw["item_id"] : undefined,
      provider:
        typeof raw?.["provider"] === "string" ? raw["provider"] : undefined,
    }))
    .filter(artist => Boolean(artist.uri));
}

/**
 * Fetches tracks or episodes inside an album, artist, playlist, or podcast via `mass_queue`.
 */
export async function getCollectionTracks(
  maEntityId: string | undefined,
  mediaType: "album" | "artist" | "playlist" | "podcast",
  uri: string
): Promise<MassTrackItem[]> {
  const serviceMap = {
    album: "get_album_tracks",
    artist: "get_artist_tracks",
    playlist: "get_playlist_tracks",
    podcast: "get_podcast_episodes",
  } as const;
  const service = serviceMap[mediaType];
  if (!uri || !hasMassQueueService(service)) return [];

  const configEntryId = await getConfigEntryId("mass_queue", maEntityId);
  if (!configEntryId) {
    throw new Error("Could not resolve mass_queue config entry");
  }

  const res = await getHassMessageWithCache<{
    response?: {
      tracks?: Array<Record<string, unknown>>;
      episodes?: Array<Record<string, unknown>>;
    };
  }>(
    {
      type: "call_service",
      domain: "mass_queue",
      service,
      service_data: {
        config_entry_id: configEntryId,
        uri,
      },
      return_response: true,
    },
    { staleTime: 60000 }
  );

  const items =
    mediaType === "podcast" ? res?.response?.episodes : res?.response?.tracks;
  return Array.isArray(items) ? items.map(normalizeTrackItem) : [];
}

/**
 * Fetches recommendation folders via `mass_queue.get_recommendations`.
 */
export async function getMassRecommendations(
  maEntityId: string
): Promise<MassRecommendationFolder[]> {
  if (!maEntityId || !hasMassQueueService("get_recommendations")) return [];

  const res = await getHassMessageWithCache<{
    response?:
      | MassRecommendationFolder[]
      | { response?: MassRecommendationFolder[] };
  }>(
    {
      type: "call_service",
      domain: "mass_queue",
      service: "get_recommendations",
      service_data: {
        entity: maEntityId,
      },
      return_response: true,
    },
    { staleTime: 120000 }
  );

  const payload = res?.response;
  const folders = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.response)
      ? payload.response
      : [];

  return folders
    .filter(folder => Array.isArray(folder?.items) && folder.items.length > 0)
    .map(folder => ({
      name: folder.name,
      item_id: folder.item_id,
      uri: folder.uri,
      items: folder.items.map(item => ({
        item_id: item.item_id,
        name: item.name,
        uri: item.uri,
        media_type: item.media_type,
        image:
          typeof item.image === "string" && item.image.length > 0
            ? item.image
            : extractMaImage(item as unknown as Record<string, unknown>),
      })),
    }));
}

export async function moveQueueItemNext(
  maEntityId: string,
  queueItemId: string
): Promise<void> {
  const hass = getHass();
  if (!hass) throw new Error("Home Assistant connection unavailable");
  await hass.callService("mass_queue", "move_queue_item_next", {
    entity: maEntityId,
    queue_item_id: queueItemId,
  });
}

export async function clearQueueFromHere(maEntityId: string): Promise<void> {
  const hass = getHass();
  if (!hass) throw new Error("Home Assistant connection unavailable");
  await hass.callService("mass_queue", "clear_queue_from_here", {
    entity: maEntityId,
  });
}

export async function unfavoriteCurrentMassItem(
  maEntityId: string
): Promise<void> {
  const hass = getHass();
  if (!hass) throw new Error("Home Assistant connection unavailable");
  await hass.callService("mass_queue", "unfavorite_current_item", {
    entity: maEntityId,
  });
}

const VALID_PLAY_MEDIA_TYPES = new Set([
  "artist",
  "album",
  "audiobook",
  "folder",
  "playlist",
  "podcast",
  "track",
  "radio",
]);

export async function playMassMedia(
  maEntityId: string,
  mediaId: string | string[],
  mediaType?: string,
  enqueue: MaEnqueueMode = "play",
  radioMode?: boolean
): Promise<void> {
  const hass = getHass();
  if (!hass) throw new Error("Home Assistant connection unavailable");
  const validMediaType =
    mediaType && VALID_PLAY_MEDIA_TYPES.has(mediaType) ? mediaType : undefined;
  await hass.callService(
    "music_assistant",
    "play_media",
    {
      media_id: mediaId,
      ...(validMediaType ? { media_type: validMediaType } : {}),
      enqueue,
      ...(radioMode !== undefined ? { radio_mode: radioMode } : {}),
    },
    { entity_id: maEntityId }
  );
}

/**
 * Resolves the active Music Assistant track URI, handling hybrid Sonos + MA players
 * where the MA entity may hold an older track when Sonos plays natively.
 */
export async function resolveCurrentTrackUri(
  maEntityId: string | undefined,
  playerAttrs?: MediaPlayerEntityAttributes,
  maAttrs?: MediaPlayerEntityAttributes
): Promise<string | null> {
  const maMediaId = maAttrs?.media_content_id;
  if (
    maMediaId &&
    (!playerAttrs?.media_title ||
      maAttrs?.media_title === playerAttrs.media_title)
  ) {
    return maMediaId;
  }

  const title = playerAttrs?.media_title;
  if (!title) return null;

  const maConfigEntryId = await getConfigEntryId("music_assistant", maEntityId);
  if (!maConfigEntryId) return null;

  try {
    const res = await getHassMessageWithCache<{
      response?: {
        tracks?: Array<{
          uri?: string;
          name?: string;
          artists?: Array<{ name?: string }>;
        }>;
      };
    }>(
      {
        type: "call_service",
        domain: "music_assistant",
        service: "search",
        service_data: {
          name: title,
          config_entry_id: maConfigEntryId,
          media_type: "track",
          limit: 5,
        },
        return_response: true,
      },
      { staleTime: 60000 }
    );

    const tracks = res?.response?.tracks ?? [];
    if (tracks.length === 0) return null;

    const artistLower = playerAttrs?.media_artist?.toLowerCase() ?? "";
    const artistMatch = artistLower
      ? tracks.find(t =>
          t.artists?.some(a =>
            a.name ? artistLower.includes(a.name.toLowerCase()) : false
          )
        )
      : undefined;

    return artistMatch?.uri ?? tracks[0]?.uri ?? null;
  } catch {
    return null;
  }
}

function parseMediaUri(
  uri: string
): { provider: string; itemId: string } | null {
  const schemeIdx = uri.indexOf("://");
  if (schemeIdx === -1) return null;
  const provider = uri.slice(0, schemeIdx);
  const parts = uri
    .slice(schemeIdx + 3)
    .split("/")
    .filter(Boolean);
  const itemId = parts[parts.length - 1];
  if (!provider || !itemId) return null;
  return { provider, itemId };
}

/**
 * Resolves a Music Assistant artist URI, preferring an exact lookup from `trackUri`
 * via `mass_queue.send_command` before falling back to `music_assistant.search`.
 */
export async function resolveArtistUri(
  maEntityId: string | undefined,
  artistName?: string,
  trackUri?: string | null
): Promise<string | null> {
  if (trackUri && hasMassQueueService("send_command")) {
    const parsed = parseMediaUri(trackUri);
    const massQueueEntryId = await getConfigEntryId("mass_queue", maEntityId);
    if (parsed && massQueueEntryId) {
      try {
        const res = await getHassMessageWithCache<{
          response?: {
            response?: { artists?: Array<{ uri?: string; name?: string }> };
          };
        }>(
          {
            type: "call_service",
            domain: "mass_queue",
            service: "send_command",
            service_data: {
              config_entry_id: massQueueEntryId,
              command: "music/tracks/get_track",
              data: {
                item_id: parsed.itemId,
                provider_instance_id_or_domain: parsed.provider,
              },
            },
            return_response: true,
          },
          { staleTime: 120000 }
        );
        const artistUri = res?.response?.response?.artists?.[0]?.uri;
        if (artistUri) return artistUri;
      } catch {
        // Fall through to search
      }
    }
  }

  if (!artistName) return null;
  const primaryArtist = artistName.split(",")[0]?.trim() || artistName.trim();
  if (!primaryArtist) return null;

  const maConfigEntryId = await getConfigEntryId("music_assistant", maEntityId);
  if (!maConfigEntryId) return null;

  try {
    const res = await getHassMessageWithCache<{
      response?: {
        artists?: Array<{ uri?: string; name?: string }>;
      };
    }>(
      {
        type: "call_service",
        domain: "music_assistant",
        service: "search",
        service_data: {
          name: primaryArtist,
          config_entry_id: maConfigEntryId,
          media_type: "artist",
          limit: 5,
        },
        return_response: true,
      },
      { staleTime: 60000 }
    );

    const artists = res?.response?.artists ?? [];
    if (artists.length === 0) return null;

    const exact = artists.find(
      a => a.name?.toLowerCase() === primaryArtist.toLowerCase()
    );
    return exact?.uri ?? artists[0]?.uri ?? null;
  } catch {
    return null;
  }
}
