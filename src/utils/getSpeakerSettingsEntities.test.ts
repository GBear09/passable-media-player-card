import { HassEntity } from "home-assistant-js-websocket";
import {
  formatSpeakerSettingLabel,
  getSpeakerSettingsEntities,
  type SpeakerSettingsHass,
} from "./getSpeakerSettingsEntities";

function makeEntity(
  entityId: string,
  state: string,
  friendlyName?: string,
  extraAttributes: Record<string, unknown> = {}
): HassEntity {
  return {
    entity_id: entityId,
    state,
    attributes: {
      ...(friendlyName !== undefined ? { friendly_name: friendlyName } : {}),
      ...extraAttributes,
    },
    last_changed: "2026-11-20T00:00:00Z",
    last_updated: "2026-11-20T00:00:00Z",
    context: { id: "ctx", parent_id: null, user_id: null },
  };
}

describe("getSpeakerSettingsEntities", () => {
  it("returns only entities on the speaker device for room-named speakers and excludes unrelated room entities", () => {
    const livingRoomDeviceId = "dev-living-room-sonos";
    const kitchenDeviceId = "dev-kitchen-sonos";
    const roborockDeviceId = "dev-roborock";
    const sensorDeviceId = "dev-hue-sensor";
    const lightingDeviceId = "dev-smart-lighting";
    const screenTimeDeviceId = "dev-screen-time";
    const fridgeDeviceId = "dev-cafe-fridge";

    const hass: SpeakerSettingsHass = {
      devices: {
        [livingRoomDeviceId]: {
          id: livingRoomDeviceId,
          name: "Living Room",
        },
        [kitchenDeviceId]: {
          id: kitchenDeviceId,
          name: "Kitchen",
        },
      },
      entities: {
        "media_player.living_room": {
          entity_id: "media_player.living_room",
          platform: "sonos",
          device_id: livingRoomDeviceId,
        },
        "media_player.kitchen": {
          entity_id: "media_player.kitchen",
          platform: "sonos",
          device_id: kitchenDeviceId,
        },
        "number.living_room_bass": {
          entity_id: "number.living_room_bass",
          platform: "sonos",
          device_id: livingRoomDeviceId,
        },
        "switch.living_room_loudness": {
          entity_id: "switch.living_room_loudness",
          platform: "sonos",
          device_id: livingRoomDeviceId,
        },
        "switch.living_room_sensor_motion_sensor_enabled": {
          entity_id: "switch.living_room_sensor_motion_sensor_enabled",
          platform: "hue",
          device_id: sensorDeviceId,
        },
        "switch.living_room_passable_smart_screen_time_engine_tv_lockout": {
          entity_id:
            "switch.living_room_passable_smart_screen_time_engine_tv_lockout",
          platform: "passable_screen_time",
          device_id: screenTimeDeviceId,
        },
        "switch.living_room_roborock_q_revo_dock_dust_emptying": {
          entity_id: "switch.living_room_roborock_q_revo_dock_dust_emptying",
          platform: "roborock",
          device_id: roborockDeviceId,
        },
        "switch.living_room_roborock_q_revo_dock_mop_drying": {
          entity_id: "switch.living_room_roborock_q_revo_dock_mop_drying",
          platform: "roborock",
          device_id: roborockDeviceId,
        },
        "select.living_room_roborock_q_revo_cleaning_mode": {
          entity_id: "select.living_room_roborock_q_revo_cleaning_mode",
          platform: "roborock",
          device_id: roborockDeviceId,
        },
        "select.living_room_smart_lighting_living_room_reset_dataset_target": {
          entity_id:
            "select.living_room_smart_lighting_living_room_reset_dataset_target",
          platform: "passable_smart_light_engine",
          device_id: lightingDeviceId,
        },
        "number.kitchen_treble": {
          entity_id: "number.kitchen_treble",
          platform: "sonos",
          device_id: kitchenDeviceId,
        },
        "switch.kitchen_crossfade": {
          entity_id: "switch.kitchen_crossfade",
          platform: "sonos",
          device_id: kitchenDeviceId,
        },
        "switch.kitchen_cafe_fridge_dt507030_turbo_cool_status": {
          entity_id: "switch.kitchen_cafe_fridge_dt507030_turbo_cool_status",
          platform: "ge_home",
          device_id: fridgeDeviceId,
        },
        "select.kitchen_smart_lighting_kitchen_reset_dataset_target": {
          entity_id:
            "select.kitchen_smart_lighting_kitchen_reset_dataset_target",
          platform: "passable_smart_light_engine",
          device_id: lightingDeviceId,
        },
      },
      states: {
        "media_player.living_room": makeEntity(
          "media_player.living_room",
          "paused",
          "Living Room"
        ),
        "media_player.kitchen": makeEntity(
          "media_player.kitchen",
          "paused",
          "Kitchen"
        ),
        "number.living_room_bass": makeEntity(
          "number.living_room_bass",
          "5",
          "Living Room Bass"
        ),
        "switch.living_room_loudness": makeEntity(
          "switch.living_room_loudness",
          "on",
          "Living Room Loudness"
        ),
        "switch.living_room_sensor_motion_sensor_enabled": makeEntity(
          "switch.living_room_sensor_motion_sensor_enabled",
          "on",
          "Multi Sensor (Living Room) Motion sensor enabled"
        ),
        "switch.living_room_passable_smart_screen_time_engine_tv_lockout":
          makeEntity(
            "switch.living_room_passable_smart_screen_time_engine_tv_lockout",
            "off",
            "Passable Smart Screen Time Engine Living Room TV Lockout"
          ),
        "switch.living_room_roborock_q_revo_dock_dust_emptying": makeEntity(
          "switch.living_room_roborock_q_revo_dock_dust_emptying",
          "off",
          "Roborock Q Revo Dock Dust emptying"
        ),
        "switch.living_room_roborock_q_revo_dock_mop_drying": makeEntity(
          "switch.living_room_roborock_q_revo_dock_mop_drying",
          "on",
          "Roborock Q Revo Dock Mop drying"
        ),
        "select.living_room_roborock_q_revo_cleaning_mode": makeEntity(
          "select.living_room_roborock_q_revo_cleaning_mode",
          "vac_and_mop",
          "Roborock Q Revo Cleaning mode"
        ),
        "select.living_room_smart_lighting_living_room_reset_dataset_target":
          makeEntity(
            "select.living_room_smart_lighting_living_room_reset_dataset_target",
            "all",
            "Smart Lighting - Living Room Reset Dataset Target"
          ),
        "number.kitchen_treble": makeEntity(
          "number.kitchen_treble",
          "2",
          "Kitchen Treble"
        ),
        "switch.kitchen_crossfade": makeEntity(
          "switch.kitchen_crossfade",
          "off",
          "Kitchen Crossfade"
        ),
        "switch.kitchen_cafe_fridge_dt507030_turbo_cool_status": makeEntity(
          "switch.kitchen_cafe_fridge_dt507030_turbo_cool_status",
          "off",
          "Café Fridge DT507030 Turbo Cool Status"
        ),
        "select.kitchen_smart_lighting_kitchen_reset_dataset_target":
          makeEntity(
            "select.kitchen_smart_lighting_kitchen_reset_dataset_target",
            "all",
            "Smart Lighting - Kitchen Reset Dataset Target"
          ),
      },
    };

    const livingRoom = getSpeakerSettingsEntities(hass, {
      entityId: "media_player.living_room",
    });
    expect(livingRoom.numbers.map(e => e.entity_id)).toEqual([
      "number.living_room_bass",
    ]);
    expect(livingRoom.switches.map(e => e.entity_id)).toEqual([
      "switch.living_room_loudness",
    ]);
    expect(livingRoom.selects).toEqual([]);
    expect(livingRoom.deviceNames).toEqual(["Living Room"]);

    const kitchen = getSpeakerSettingsEntities(hass, {
      entityId: "media_player.kitchen",
    });
    expect(kitchen.numbers.map(e => e.entity_id)).toEqual([
      "number.kitchen_treble",
    ]);
    expect(kitchen.switches.map(e => e.entity_id)).toEqual([
      "switch.kitchen_crossfade",
    ]);
    expect(kitchen.selects).toEqual([]);
  });

  it("matches entities by device_id even when entity_id prefixes were renamed or belong to another speaker", () => {
    const kitchenDeviceId = "dev-kitchen";
    const diningDeviceId = "dev-dining";

    const hass: SpeakerSettingsHass = {
      entities: {
        "media_player.kitchen": {
          entity_id: "media_player.kitchen",
          platform: "sonos",
          device_id: kitchenDeviceId,
        },
        "media_player.dining_room": {
          entity_id: "media_player.dining_room",
          platform: "sonos",
          device_id: diningDeviceId,
        },
        "switch.unnamed_room_touch_controls": {
          entity_id: "switch.unnamed_room_touch_controls",
          platform: "sonos",
          device_id: kitchenDeviceId,
        },
        "switch.kitchen_touch_controls": {
          entity_id: "switch.kitchen_touch_controls",
          platform: "sonos",
          device_id: diningDeviceId,
        },
      },
      states: {
        "media_player.kitchen": makeEntity("media_player.kitchen", "idle"),
        "switch.unnamed_room_touch_controls": makeEntity(
          "switch.unnamed_room_touch_controls",
          "on",
          "Kitchen Touch controls"
        ),
        "switch.kitchen_touch_controls": makeEntity(
          "switch.kitchen_touch_controls",
          "on",
          "Dining Room Touch controls"
        ),
      },
    };

    const kitchen = getSpeakerSettingsEntities(hass, {
      entityId: "media_player.kitchen",
    });
    expect(kitchen.switches.map(e => e.entity_id)).toEqual([
      "switch.unnamed_room_touch_controls",
    ]);
  });

  it("excludes hidden, diagnostic, unavailable, and unknown entities", () => {
    const deviceId = "dev-sonos";

    const hass: SpeakerSettingsHass = {
      entities: {
        "media_player.living_room": {
          entity_id: "media_player.living_room",
          platform: "sonos",
          device_id: deviceId,
        },
        "switch.living_room_loudness": {
          entity_id: "switch.living_room_loudness",
          platform: "sonos",
          device_id: deviceId,
        },
        "switch.living_room_hidden_setting": {
          entity_id: "switch.living_room_hidden_setting",
          platform: "sonos",
          device_id: deviceId,
          hidden: true,
        },
        "switch.living_room_diagnostic_flag": {
          entity_id: "switch.living_room_diagnostic_flag",
          platform: "sonos",
          device_id: deviceId,
          entity_category: "diagnostic",
        },
        "switch.living_room_status_light": {
          entity_id: "switch.living_room_status_light",
          platform: "sonos",
          device_id: deviceId,
        },
        "number.living_room_bass": {
          entity_id: "number.living_room_bass",
          platform: "sonos",
          device_id: deviceId,
        },
      },
      states: {
        "media_player.living_room": makeEntity(
          "media_player.living_room",
          "idle"
        ),
        "switch.living_room_loudness": makeEntity(
          "switch.living_room_loudness",
          "on",
          "Living Room Loudness"
        ),
        "switch.living_room_hidden_setting": makeEntity(
          "switch.living_room_hidden_setting",
          "on",
          "Hidden setting"
        ),
        "switch.living_room_diagnostic_flag": makeEntity(
          "switch.living_room_diagnostic_flag",
          "on",
          "Diagnostic flag"
        ),
        "switch.living_room_status_light": makeEntity(
          "switch.living_room_status_light",
          "unknown",
          "Status light"
        ),
        "number.living_room_bass": makeEntity(
          "number.living_room_bass",
          "unavailable",
          "Bass"
        ),
      },
    };

    const result = getSpeakerSettingsEntities(hass, {
      entityId: "media_player.living_room",
    });
    expect(result.numbers).toEqual([]);
    expect(result.switches.map(e => e.entity_id)).toEqual([
      "switch.living_room_loudness",
    ]);
  });

  it("does not fall back to prefix matching when a speaker has a device_id with no setting entities", () => {
    const castDeviceId = "dev-google-cast";
    const sensorDeviceId = "dev-room-sensor";

    const hass: SpeakerSettingsHass = {
      entities: {
        "media_player.max_s_speaker": {
          entity_id: "media_player.max_s_speaker",
          platform: "cast",
          device_id: castDeviceId,
        },
        "switch.max_s_speaker_loudness": {
          entity_id: "switch.max_s_speaker_loudness",
          platform: "other",
          device_id: sensorDeviceId,
        },
      },
      states: {
        "media_player.max_s_speaker": makeEntity(
          "media_player.max_s_speaker",
          "idle"
        ),
        "switch.max_s_speaker_loudness": makeEntity(
          "switch.max_s_speaker_loudness",
          "on",
          "Unrelated switch"
        ),
      },
    };

    const result = getSpeakerSettingsEntities(hass, {
      entityId: "media_player.max_s_speaker",
    });
    expect(result.numbers).toEqual([]);
    expect(result.switches).toEqual([]);
    expect(result.selects).toEqual([]);
  });

  it("pairs Music Assistant-only entities with the native speaker device via _ma, speaker_group_entity_id, and device identifiers", () => {
    const nativeDeviceId = "dev-native-sonos";
    const maDeviceId = "dev-ma-sonos";

    // 1. Pairing via _ma suffix
    const hassBySuffix: SpeakerSettingsHass = {
      entities: {
        "media_player.living_room_ma": {
          entity_id: "media_player.living_room_ma",
          platform: "music_assistant",
          device_id: maDeviceId,
        },
        "media_player.living_room": {
          entity_id: "media_player.living_room",
          platform: "sonos",
          device_id: nativeDeviceId,
        },
        "number.living_room_bass": {
          entity_id: "number.living_room_bass",
          platform: "sonos",
          device_id: nativeDeviceId,
        },
      },
      states: {
        "media_player.living_room_ma": makeEntity(
          "media_player.living_room_ma",
          "idle"
        ),
        "number.living_room_bass": makeEntity(
          "number.living_room_bass",
          "3",
          "Living Room Bass"
        ),
      },
    };

    expect(
      getSpeakerSettingsEntities(hassBySuffix, {
        entityId: "media_player.living_room_ma",
      }).numbers.map(e => e.entity_id)
    ).toEqual(["number.living_room_bass"]);

    // 2. Pairing via speaker_group_entity_id when entity names differ
    const hassByGroup: SpeakerSettingsHass = {
      entities: {
        "media_player.custom_ma_player": {
          entity_id: "media_player.custom_ma_player",
          platform: "music_assistant",
          device_id: maDeviceId,
        },
        "media_player.sonos_beam": {
          entity_id: "media_player.sonos_beam",
          platform: "sonos",
          device_id: nativeDeviceId,
        },
        "switch.sonos_beam_night_sound": {
          entity_id: "switch.sonos_beam_night_sound",
          platform: "sonos",
          device_id: nativeDeviceId,
        },
      },
      states: {
        "media_player.custom_ma_player": makeEntity(
          "media_player.custom_ma_player",
          "idle"
        ),
        "switch.sonos_beam_night_sound": makeEntity(
          "switch.sonos_beam_night_sound",
          "on",
          "Night sound"
        ),
      },
    };

    expect(
      getSpeakerSettingsEntities(hassByGroup, {
        entityId: "media_player.custom_ma_player",
        speakerGroupEntityId: "media_player.sonos_beam",
      }).switches.map(e => e.entity_id)
    ).toEqual(["switch.sonos_beam_night_sound"]);

    // 3. Pairing via shared device identifiers when entity names differ and no speakerGroupEntityId is provided
    const hassByIdentifier: SpeakerSettingsHass = {
      devices: {
        [maDeviceId]: {
          id: maDeviceId,
          name: "Living Room (MA)",
          identifiers: [["music_assistant", "RINCON_949F3EC5F26501400"]],
        },
        [nativeDeviceId]: {
          id: nativeDeviceId,
          name: "Living Room",
          identifiers: [["sonos", "RINCON_949F3EC5F26501400"]],
        },
      },
      entities: {
        "media_player.ma_only_name": {
          entity_id: "media_player.ma_only_name",
          platform: "music_assistant",
          device_id: maDeviceId,
        },
        "media_player.hardware_beam": {
          entity_id: "media_player.hardware_beam",
          platform: "sonos",
          device_id: nativeDeviceId,
        },
        "switch.hardware_beam_loudness": {
          entity_id: "switch.hardware_beam_loudness",
          platform: "sonos",
          device_id: nativeDeviceId,
        },
      },
      states: {
        "media_player.ma_only_name": makeEntity(
          "media_player.ma_only_name",
          "idle"
        ),
        "switch.hardware_beam_loudness": makeEntity(
          "switch.hardware_beam_loudness",
          "on",
          "Loudness"
        ),
      },
    };

    expect(
      getSpeakerSettingsEntities(hassByIdentifier, {
        entityId: "media_player.ma_only_name",
      }).switches.map(e => e.entity_id)
    ).toEqual(["switch.hardware_beam_loudness"]);
  });

  it("uses strict audio-suffix fallback only when no device_id can be resolved", () => {
    const hassWithoutRegistry: SpeakerSettingsHass = {
      states: {
        "media_player.living_room": makeEntity(
          "media_player.living_room",
          "idle"
        ),
        "number.living_room_bass": makeEntity(
          "number.living_room_bass",
          "2",
          "Living Room Bass"
        ),
        "switch.living_room_loudness": makeEntity(
          "switch.living_room_loudness",
          "on",
          "Living Room Loudness"
        ),
        "select.living_room_sound_mode": makeEntity(
          "select.living_room_sound_mode",
          "music",
          "Living Room Sound mode"
        ),
        "switch.living_room_roborock_q_revo_dock_mop_drying": makeEntity(
          "switch.living_room_roborock_q_revo_dock_mop_drying",
          "on",
          "Roborock Mop drying"
        ),
        "select.living_room_smart_lighting_living_room_reset_dataset_target":
          makeEntity(
            "select.living_room_smart_lighting_living_room_reset_dataset_target",
            "all",
            "Smart Lighting Reset"
          ),
      },
    };

    const noRegResult = getSpeakerSettingsEntities(hassWithoutRegistry, {
      entityId: "media_player.living_room",
    });
    expect(noRegResult.numbers.map(e => e.entity_id)).toEqual([
      "number.living_room_bass",
    ]);
    expect(noRegResult.switches.map(e => e.entity_id)).toEqual([
      "switch.living_room_loudness",
    ]);
    expect(noRegResult.selects.map(e => e.entity_id)).toEqual([
      "select.living_room_sound_mode",
    ]);

    // When entities registry exists and a legacy media_player has device_id: null,
    // reject entities belonging to non-media-player devices even if suffix matches.
    const hassWithNonSpeakerDevice: SpeakerSettingsHass = {
      entities: {
        "media_player.living_room": {
          entity_id: "media_player.living_room",
          platform: "universal",
          device_id: null,
        },
        "switch.living_room_status_light": {
          entity_id: "switch.living_room_status_light",
          platform: "shelly",
          device_id: "dev-wall-switch",
        },
        "switch.living_room_loudness": {
          entity_id: "switch.living_room_loudness",
          platform: "template",
          device_id: null,
        },
      },
      states: {
        "media_player.living_room": makeEntity(
          "media_player.living_room",
          "idle"
        ),
        "switch.living_room_status_light": makeEntity(
          "switch.living_room_status_light",
          "on",
          "Wall switch status light"
        ),
        "switch.living_room_loudness": makeEntity(
          "switch.living_room_loudness",
          "on",
          "Living Room Loudness"
        ),
      },
    };

    const nonSpeakerResult = getSpeakerSettingsEntities(
      hassWithNonSpeakerDevice,
      { entityId: "media_player.living_room" }
    );
    expect(nonSpeakerResult.switches.map(e => e.entity_id)).toEqual([
      "switch.living_room_loudness",
    ]);
  });
});

describe("formatSpeakerSettingLabel", () => {
  it("strips custom card names and device/entity friendly names", () => {
    expect(
      formatSpeakerSettingLabel("Portable Bass", [
        "Madeleine's Room",
        "Portable",
      ])
    ).toBe("Bass");
    expect(
      formatSpeakerSettingLabel("Living Room - Night sound", ["Living Room"])
    ).toBe("Night sound");
  });

  it("handles regex metacharacters and matches longest prefix first", () => {
    expect(
      formatSpeakerSettingLabel("Living Room (Beam) Treble", [
        "Living Room",
        "Living Room (Beam)",
      ])
    ).toBe("Treble");
  });

  it("does not mangle setting names that begin with the same letters as a short prefix", () => {
    expect(formatSpeakerSettingLabel("Subwoofer enabled", ["Sub"])).toBe(
      "Subwoofer enabled"
    );
  });
});
