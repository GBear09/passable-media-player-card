import { clearHassMessageCache } from "./getHassMessageWithCache";
import {
  clearMassConfigEntryCache,
  extractMaImage,
  getConfigEntryId,
  getMassPlayerInfo,
  getSimilarArtists,
  hasMassQueueService,
  resolveCurrentTrackUri,
  setMassAutoplay,
} from "./massQueueClient";

const mockCallService = jest.fn();
const mockSendMessagePromise = jest.fn();
const mockCallApi = jest.fn();

const mockHass = {
  services: {
    mass_queue: {
      set_autoplay: {},
      set_crossfade: {},
      send_command: {},
      get_similar_artists: {},
      get_similar_tracks: {},
    },
  },
  states: {
    "media_player.living_room_ma": {
      entity_id: "media_player.living_room_ma",
      state: "playing",
      attributes: {
        active_queue: "RINCON_123",
        media_title: "MA Song",
        media_content_id: "ytmusic://track/abc",
      },
    },
  },
  callService: mockCallService,
  callApi: mockCallApi,
  connection: {
    sendMessagePromise: mockSendMessagePromise,
  },
};

jest.mock("./getHass", () => ({
  getHass: () => mockHass,
}));

describe("massQueueClient", () => {
  beforeEach(() => {
    clearHassMessageCache();
    clearMassConfigEntryCache();
    jest.clearAllMocks();
    mockHass.services.mass_queue = {
      set_autoplay: {},
      set_crossfade: {},
      send_command: {},
      get_similar_artists: {},
      get_similar_tracks: {},
    };
  });

  it("detects registered mass_queue services", () => {
    expect(hasMassQueueService("set_autoplay")).toBe(true);
    expect(hasMassQueueService("nonexistent_action")).toBe(false);
  });

  it("extracts images in priority order from MA items", () => {
    expect(
      extractMaImage({
        local_image_encoded: "data:image/png;base64,abc",
        media_image: "http://local/img.jpg",
      })
    ).toBe("data:image/png;base64,abc");

    expect(
      extractMaImage({
        metadata: {
          images: [
            {
              type: "fanart",
              path: "http://fanart.jpg",
              remotely_accessible: true,
            },
            {
              type: "thumb",
              path: "http://thumb.jpg",
              remotely_accessible: true,
            },
          ],
        },
      })
    ).toBe("http://thumb.jpg");
  });

  it("resolves config entry ID via mass_queue/get_info before REST API (non-admin friendly)", async () => {
    mockSendMessagePromise.mockResolvedValueOnce({
      entries: {
        music_assistant: "ma-entry-1",
        mass_queue: "mq-entry-1",
      },
      queue_id: "RINCON_123",
    });

    const maId = await getConfigEntryId(
      "music_assistant",
      "media_player.living_room_ma"
    );
    const mqId = await getConfigEntryId(
      "mass_queue",
      "media_player.living_room_ma"
    );

    expect(maId).toBe("ma-entry-1");
    expect(mqId).toBe("mq-entry-1");
    expect(mockCallApi).not.toHaveBeenCalled();
  });

  it("falls back safely when REST config entries returns 403", async () => {
    mockSendMessagePromise.mockRejectedValueOnce(new Error("ws unavailable"));
    mockCallApi.mockRejectedValueOnce(new Error("403 Forbidden"));

    const entryId = await getConfigEntryId(
      "music_assistant",
      "media_player.living_room_ma"
    );
    expect(entryId).toBeNull();
  });

  it("falls back to mass_queue.send_command when mass_queue.set_autoplay throws upstream kwarg TypeError", async () => {
    mockCallService
      .mockRejectedValueOnce(
        new Error(
          "autoplay() got an unexpected keyword argument 'crossfade_enabled'"
        )
      )
      .mockResolvedValueOnce(undefined);
    mockSendMessagePromise.mockResolvedValueOnce({
      entries: {
        music_assistant: "ma-entry-1",
        mass_queue: "mq-entry-1",
      },
      queue_id: "RINCON_123",
    });

    await setMassAutoplay("media_player.living_room_ma", true);

    expect(mockCallService).toHaveBeenNthCalledWith(
      1,
      "mass_queue",
      "set_autoplay",
      {
        entity: "media_player.living_room_ma",
        enabled: true,
      }
    );
    expect(mockCallService).toHaveBeenNthCalledWith(
      2,
      "mass_queue",
      "send_command",
      {
        config_entry_id: "mq-entry-1",
        command: "player_queues/autoplay",
        data: {
          queue_id: "RINCON_123",
          autoplay_enabled: true,
        },
      }
    );
  });

  it("normalizes get_similar_artists raw Artist dicts and extracts metadata image", async () => {
    mockSendMessagePromise
      .mockResolvedValueOnce({
        entries: { mass_queue: "mq-entry-1" },
      })
      .mockResolvedValueOnce({
        response: {
          artists: [
            {
              uri: "library://artist/7",
              name: "Similar Band",
              favorite: true,
              metadata: {
                images: [
                  {
                    type: "thumb",
                    path: "https://cdn.example/band.jpg",
                    remotely_accessible: true,
                  },
                ],
              },
            },
          ],
        },
      });

    const artists = await getSimilarArtists(
      "media_player.living_room_ma",
      "library://artist/1"
    );

    expect(artists).toEqual([
      {
        uri: "library://artist/7",
        name: "Similar Band",
        image: "https://cdn.example/band.jpg",
        favorite: true,
        item_id: undefined,
        provider: undefined,
      },
    ]);
  });

  it("resolves current track URI directly when synced, and searches when Sonos diverges from MA", async () => {
    const synced = await resolveCurrentTrackUri(
      "media_player.living_room_ma",
      { media_title: "MA Song" },
      { media_title: "MA Song", media_content_id: "ytmusic://track/abc" }
    );
    expect(synced).toBe("ytmusic://track/abc");

    mockSendMessagePromise
      .mockResolvedValueOnce({
        entries: { music_assistant: "ma-entry-1" },
      })
      .mockResolvedValueOnce({
        response: {
          tracks: [
            {
              uri: "spotify://track/other",
              name: "Christmas Song",
              artists: [{ name: "Someone Else" }],
            },
            {
              uri: "spotify://track/mariah",
              name: "All I Want for Christmas Is You",
              artists: [{ name: "Mariah Carey" }],
            },
          ],
        },
      });

    const resolved = await resolveCurrentTrackUri(
      "media_player.living_room_ma",
      {
        media_title: "All I Want for Christmas Is You",
        media_artist: "Mariah Carey",
      },
      { media_title: "MA Song", media_content_id: "ytmusic://track/abc" }
    );
    expect(resolved).toBe("spotify://track/mariah");

    // Ensure getMassPlayerInfo helper is exercised cleanly
    const info = await getMassPlayerInfo("media_player.living_room_ma");
    expect(info?.entries?.music_assistant).toBe("ma-entry-1");
  });
});
