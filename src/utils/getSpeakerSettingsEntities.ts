import { HassEntity } from "home-assistant-js-websocket";
import type {
  HassDeviceRegistryEntry,
  HassEntityRegistryDisplayEntry,
} from "@types";

export type SpeakerSettingsTarget = {
  entityId: string;
  maEntityId?: string | null;
  speakerGroupEntityId?: string | null;
};

export type SpeakerSettingsHass = {
  states?: Record<string, HassEntity | undefined>;
  entities?: Record<
    string,
    Partial<HassEntityRegistryDisplayEntry> | undefined
  >;
  devices?: Record<string, HassDeviceRegistryEntry | undefined>;
};

export type SpeakerSettingsEntitiesResult = {
  numbers: HassEntity[];
  switches: HassEntity[];
  selects: HassEntity[];
  deviceNames: string[];
};

const KNOWN_SPEAKER_SETTING_SUFFIXES = new Set([
  // Numbers
  "audio_delay",
  "balance",
  "bass",
  "treble",
  "sub_gain",
  "subwoofer_gain",
  "subwoofer_level",
  "surround_level",
  "music_surround_level",
  "dialog_level",
  "center_level",
  "height_level",
  // Switches
  "crossfade",
  "loudness",
  "night_sound",
  "night_mode",
  "speech_enhancement",
  "dialog_enhancer",
  "subwoofer_enabled",
  "surround_enabled",
  "surround_music_full_volume",
  "tv_autoplay",
  "ungroup_on_autoplay",
  "touch_controls",
  "status_light",
  "bass_boost",
  "dynamic_volume",
  "dynamic_eq",
  "pure_direct",
  // Selects
  "sound_mode",
  "equalizer",
  "eq_preset",
  "audio_mode",
  "listening_mode",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortEntitiesByName(a: HassEntity, b: HassEntity): number {
  return (a.attributes.friendly_name || a.entity_id).localeCompare(
    b.attributes.friendly_name || b.entity_id
  );
}

function isMediaPlayerMaEntity(
  entityId: string,
  entry?: Partial<HassEntityRegistryDisplayEntry>
): boolean {
  return (
    entry?.platform === "music_assistant" ||
    /^media_player\..+_ma$/i.test(entityId)
  );
}

function isExcludedRegistryEntry(
  entry?: Partial<HassEntityRegistryDisplayEntry>
): boolean {
  return entry?.hidden === true || entry?.entity_category === "diagnostic";
}

/**
 * Strips any matching speaker/device prefix from an entity's friendly name so
 * the settings sheet renders concise setting labels (e.g. "Bass", "Loudness").
 */
export function formatSpeakerSettingLabel(
  name: string,
  prefixes: Array<string | null | undefined>
): string {
  const uniquePrefixes = Array.from(
    new Set(
      prefixes
        .map(p => p?.trim())
        .filter((p): p is string => Boolean(p && p.length > 0))
    )
  ).sort((a, b) => b.length - a.length);

  for (const prefix of uniquePrefixes) {
    const regex = new RegExp(
      `^${escapeRegExp(prefix)}(?:\\s*[-:_]\\s*|\\s+)`,
      "i"
    );
    const cleaned = name.replace(regex, "").trim();
    if (cleaned !== name.trim() && cleaned.length > 0) {
      return cleaned;
    }
  }

  return name.trim() || name;
}

/**
 * Discovers `number`, `switch`, and `select` setting entities that belong to
 * the selected speaker device.
 *
 * Uses Home Assistant's entity/device registry (`device_id`) as the primary
 * source of truth so unrelated entities that happen to share a room-named
 * `entity_id` prefix (e.g. `living_room_*`, `kitchen_*`) are never included.
 * Falls back to a strict allowlist of known audio setting suffixes only when no
 * `device_id` can be resolved (such as legacy YAML players).
 */
export function getSpeakerSettingsEntities(
  hass: SpeakerSettingsHass | null | undefined,
  target: SpeakerSettingsTarget
): SpeakerSettingsEntitiesResult {
  const empty: SpeakerSettingsEntitiesResult = {
    numbers: [],
    switches: [],
    selects: [],
    deviceNames: [],
  };

  if (!hass?.states || !target.entityId) {
    return empty;
  }

  const states = hass.states;
  const entities = hass.entities;
  const devices = hass.devices;

  const deviceIds = new Set<string>();
  let hasNonMaDevice = false;

  if (entities) {
    const candidateEntityIds = [
      target.entityId,
      target.speakerGroupEntityId,
      target.maEntityId,
    ].filter((id): id is string => Boolean(id));

    for (const id of candidateEntityIds) {
      const regEntry = entities[id];
      if (regEntry?.device_id) {
        deviceIds.add(regEntry.device_id);
        if (!isMediaPlayerMaEntity(id, regEntry)) {
          hasNonMaDevice = true;
        }
      }
    }

    // If only a Music Assistant device was resolved, pair it with the native
    // speaker device that exposes hardware settings (EQ, loudness, etc.).
    if (
      !hasNonMaDevice &&
      isMediaPlayerMaEntity(target.entityId, entities[target.entityId])
    ) {
      const baseName = target.entityId
        .replace(/^media_player\./i, "")
        .replace(/_ma$/i, "");
      if (baseName) {
        const pairedId = `media_player.${baseName}`;
        const pairedEntry = entities[pairedId];
        if (
          pairedId !== target.entityId &&
          pairedEntry?.device_id &&
          pairedEntry.platform !== "music_assistant"
        ) {
          deviceIds.add(pairedEntry.device_id);
          hasNonMaDevice = true;
        }
      }

      if (!hasNonMaDevice && devices) {
        const targetIdentifiers = new Set<string>();
        for (const devId of deviceIds) {
          const dev = devices[devId];
          if (dev?.identifiers) {
            for (const pair of dev.identifiers) {
              if (
                Array.isArray(pair) &&
                typeof pair[1] === "string" &&
                pair[1].length >= 6
              ) {
                targetIdentifiers.add(pair[1]);
              }
            }
          }
        }

        const activeQueue = states[target.entityId]?.attributes?.active_queue;
        if (typeof activeQueue === "string" && activeQueue.length >= 6) {
          targetIdentifiers.add(activeQueue);
        }

        if (targetIdentifiers.size > 0) {
          for (const [eid, entry] of Object.entries(entities)) {
            if (
              eid.startsWith("media_player.") &&
              entry &&
              entry.platform !== "music_assistant" &&
              entry.device_id
            ) {
              const candidateDev = devices[entry.device_id];
              const matchesIdentifier = candidateDev?.identifiers?.some(
                pair =>
                  Array.isArray(pair) &&
                  typeof pair[1] === "string" &&
                  targetIdentifiers.has(pair[1])
              );
              if (matchesIdentifier) {
                deviceIds.add(entry.device_id);
              }
            }
          }
        }
      }
    }
  }

  const deviceNames: string[] = [];
  if (devices && deviceIds.size > 0) {
    for (const devId of deviceIds) {
      const dev = devices[devId];
      if (dev?.name_by_user) deviceNames.push(dev.name_by_user);
      if (dev?.name) deviceNames.push(dev.name);
    }
  }

  const foundNumbers: HassEntity[] = [];
  const foundSwitches: HassEntity[] = [];
  const foundSelects: HassEntity[] = [];

  // Strategy A: Device Registry Matching (primary)
  if (deviceIds.size > 0 && entities) {
    for (const entity of Object.values(states)) {
      if (!entity?.entity_id) continue;
      if (entity.state === "unavailable" || entity.state === "unknown") {
        continue;
      }

      const eid = entity.entity_id;
      const isNumber = eid.startsWith("number.");
      const isSwitch = eid.startsWith("switch.");
      const isSelect = eid.startsWith("select.");
      if (!isNumber && !isSwitch && !isSelect) continue;

      const regEntry = entities[eid];
      if (!regEntry?.device_id || !deviceIds.has(regEntry.device_id)) continue;
      if (isExcludedRegistryEntry(regEntry)) continue;

      if (isNumber) foundNumbers.push(entity);
      else if (isSwitch) foundSwitches.push(entity);
      else foundSelects.push(entity);
    }

    foundNumbers.sort(sortEntitiesByName);
    foundSwitches.sort(sortEntitiesByName);
    foundSelects.sort(sortEntitiesByName);

    return {
      numbers: foundNumbers,
      switches: foundSwitches,
      selects: foundSelects,
      deviceNames,
    };
  }

  // Strategy B: Safe Fallback when no device_id could be resolved
  const baseName = target.entityId
    .replace(/^media_player\./i, "")
    .replace(/_ma$/i, "");

  if (!baseName) {
    return {
      numbers: [],
      switches: [],
      selects: [],
      deviceNames,
    };
  }

  const mediaPlayerDeviceIds = new Set<string>();
  if (entities) {
    for (const [eid, entry] of Object.entries(entities)) {
      if (eid.startsWith("media_player.") && entry?.device_id) {
        mediaPlayerDeviceIds.add(entry.device_id);
      }
    }
  }

  const speakerPattern = new RegExp(
    `^(number|switch|select)\\.${escapeRegExp(baseName)}_(.+)$`,
    "i"
  );

  for (const entity of Object.values(states)) {
    if (!entity?.entity_id) continue;
    if (entity.state === "unavailable" || entity.state === "unknown") {
      continue;
    }

    const match = speakerPattern.exec(entity.entity_id);
    if (!match) continue;

    const domain = match[1].toLowerCase();
    const suffix = match[2].toLowerCase();
    if (!KNOWN_SPEAKER_SETTING_SUFFIXES.has(suffix)) continue;

    if (entities) {
      const regEntry = entities[entity.entity_id];
      if (regEntry) {
        if (isExcludedRegistryEntry(regEntry)) continue;
        if (
          regEntry.device_id &&
          !mediaPlayerDeviceIds.has(regEntry.device_id)
        ) {
          continue;
        }
      }
    }

    if (domain === "number") foundNumbers.push(entity);
    else if (domain === "switch") foundSwitches.push(entity);
    else if (domain === "select") foundSelects.push(entity);
  }

  foundNumbers.sort(sortEntitiesByName);
  foundSwitches.sort(sortEntitiesByName);
  foundSelects.sort(sortEntitiesByName);

  return {
    numbers: foundNumbers,
    switches: foundSwitches,
    selects: foundSelects,
    deviceNames,
  };
}
