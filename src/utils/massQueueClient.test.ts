import { clearHassMessageCache } from "./getHassMessageWithCache";
import {
  cancelBulkPlayForEntity,
  clearMassConfigEntryCache,
  extractMaImage,
  filterOutSeedTrack,
  getConfigEntryId,
  getMassPlayerInfo,
  getSimilarArtists,
  hasMassQueueService,
  type MassTrackItem,
  playMassTracksProgressive,
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

  describe("filterOutSeedTrack", () => {
    const sampleTracks: MassTrackItem[] = [
      {
        media_title: "The Pain",
        media_content_id: "ytmusic--A9uPVvsx://track/dEFrgyWdKY0",
        media_artist: "LXNE",
      },
      {
        media_title: "Control",
        media_content_id: "ytmusic--A9uPVvsx://track/QdwOlnB7aDY",
        media_artist: "LXNE",
      },
      {
        media_title: "Control",
        media_content_id: "ytmusic--A9uPVvsx://track/halsey1",
        media_artist: "Halsey",
      },
      {
        media_title: "The Pain",
        media_content_id: "ytmusic--A9uPVvsx://track/feat1",
        media_artist: "LXNE, Guest",
      },
    ];

    it("excludes exact URI match case-insensitively", () => {
      const filtered = filterOutSeedTrack(sampleTracks, {
        trackUri: "YTMUSIC--A9UPVVSX://TRACK/QDWOLNB7ADY",
      });
      expect(filtered.map(t => t.media_content_id)).toEqual([
        "ytmusic--A9uPVvsx://track/dEFrgyWdKY0",
        "ytmusic--A9uPVvsx://track/halsey1",
        "ytmusic--A9uPVvsx://track/feat1",
      ]);
    });

    it("excludes cross-provider matches by normalized title and artist, including featured artists, while keeping same-title tracks by other artists", () => {
      const filtered = filterOutSeedTrack(
        [
          ...sampleTracks,
          {
            media_title: "  the pain ",
            media_content_id: "ytmusic--A9uPVvsx://track/feat2",
            media_artist: "LXNE feat. Someone",
          },
          {
            media_title: "The Pain",
            media_content_id: "ytmusic--A9uPVvsx://track/other",
            media_artist: "Different Artist",
          },
        ],
        {
          trackUri: "library://track/5425",
          title: "The Pain",
          artist: "LXNE",
        }
      );

      expect(filtered.map(t => t.media_content_id)).toEqual([
        "ytmusic--A9uPVvsx://track/QdwOlnB7aDY",
        "ytmusic--A9uPVvsx://track/halsey1",
        "ytmusic--A9uPVvsx://track/other",
      ]);
    });

    it("does not filter purely by title when seed artist is omitted", () => {
      const filtered = filterOutSeedTrack(sampleTracks, {
        trackUri: "library://track/5425",
        title: "The Pain",
      });
      expect(filtered).toHaveLength(sampleTracks.length);
    });
  });

  describe("playMassTracksProgressive", () => {
    const makeUris = (count: number) =>
      Array.from({ length: count }, (_, idx) => `ytmusic://track/${idx + 1}`);

    it("starts Play All immediately with track 1 using replace and queues remaining chunks via add", async () => {
      const uris = makeUris(12);
      const events: string[] = [];
      mockCallService.mockImplementation(
        async (_domain, _service, data: { media_id: string | string[] }) => {
          events.push(
            `service:${Array.isArray(data.media_id) ? data.media_id.length : 1}`
          );
        }
      );

      const result = await playMassTracksProgressive({
        maEntityId: "media_player.living_room_ma",
        uris,
        mode: "play",
        batchSize: 5,
        onFirstBatchReady: info => {
          events.push(
            `firstBatchReady:${info.startedCount}/${info.remainingCount}/${info.totalCount}`
          );
        },
        onProgress: info => {
          events.push(`progress:${info.queuedCount}/${info.totalCount}`);
        },
      });

      expect(result).toEqual({
        totalCount: 12,
        queuedCount: 12,
        failedCount: 0,
        cancelled: false,
      });

      expect(events).toEqual([
        "service:1",
        "firstBatchReady:1/11/12",
        "progress:1/12",
        "service:5",
        "progress:6/12",
        "service:5",
        "progress:11/12",
        "service:1",
        "progress:12/12",
      ]);

      expect(mockCallService).toHaveBeenNthCalledWith(
        1,
        "music_assistant",
        "play_media",
        {
          media_id: "ytmusic://track/1",
          media_type: "track",
          enqueue: "replace",
        },
        { entity_id: "media_player.living_room_ma" }
      );
      expect(mockCallService).toHaveBeenNthCalledWith(
        2,
        "music_assistant",
        "play_media",
        {
          media_id: uris.slice(1, 6),
          media_type: "track",
          enqueue: "add",
        },
        { entity_id: "media_player.living_room_ma" }
      );
      expect(mockCallService).toHaveBeenNthCalledWith(
        3,
        "music_assistant",
        "play_media",
        {
          media_id: uris.slice(6, 11),
          media_type: "track",
          enqueue: "add",
        },
        { entity_id: "media_player.living_room_ma" }
      );
      expect(mockCallService).toHaveBeenNthCalledWith(
        4,
        "music_assistant",
        "play_media",
        {
          media_id: "ytmusic://track/12",
          media_type: "track",
          enqueue: "add",
        },
        { entity_id: "media_player.living_room_ma" }
      );
    });

    it("handles a single track in Play All without follow-up add calls", async () => {
      mockCallService.mockResolvedValue(undefined);
      const onFirstBatchReady = jest.fn();

      const result = await playMassTracksProgressive({
        maEntityId: "media_player.living_room_ma",
        uris: ["ytmusic://track/only"],
        mode: "play",
        onFirstBatchReady,
      });

      expect(result).toEqual({
        totalCount: 1,
        queuedCount: 1,
        failedCount: 0,
        cancelled: false,
      });
      expect(mockCallService).toHaveBeenCalledTimes(1);
      expect(onFirstBatchReady).toHaveBeenCalledWith({
        startedCount: 1,
        remainingCount: 0,
        totalCount: 1,
      });
    });

    it("sends Queue All in ordered batches and deduplicates empty/duplicate URIs", async () => {
      mockCallService.mockResolvedValue(undefined);
      const uris = [
        ...makeUris(6),
        "ytmusic://track/2",
        "  ",
        "",
        ...makeUris(12).slice(6),
      ];

      const result = await playMassTracksProgressive({
        maEntityId: "media_player.living_room_ma",
        uris,
        mode: "add",
        batchSize: 5,
      });

      expect(result).toEqual({
        totalCount: 12,
        queuedCount: 12,
        failedCount: 0,
        cancelled: false,
      });
      expect(mockCallService).toHaveBeenCalledTimes(3);
      expect(mockCallService).toHaveBeenNthCalledWith(
        1,
        "music_assistant",
        "play_media",
        {
          media_id: makeUris(12).slice(0, 5),
          media_type: "track",
          enqueue: "add",
        },
        { entity_id: "media_player.living_room_ma" }
      );
      expect(mockCallService).toHaveBeenNthCalledWith(
        2,
        "music_assistant",
        "play_media",
        {
          media_id: makeUris(12).slice(5, 10),
          media_type: "track",
          enqueue: "add",
        },
        { entity_id: "media_player.living_room_ma" }
      );
      expect(mockCallService).toHaveBeenNthCalledWith(
        3,
        "music_assistant",
        "play_media",
        {
          media_id: makeUris(12).slice(10, 12),
          media_type: "track",
          enqueue: "add",
        },
        { entity_id: "media_player.living_room_ma" }
      );
    });

    it("propagates errors when the initial call fails", async () => {
      mockCallService.mockRejectedValueOnce(new Error("Player unavailable"));

      await expect(
        playMassTracksProgressive({
          maEntityId: "media_player.living_room_ma",
          uris: makeUris(4),
          mode: "play",
        })
      ).rejects.toThrow("Player unavailable");
      expect(mockCallService).toHaveBeenCalledTimes(1);
    });

    it("continues remaining batches and reports failedCount when a later batch rejects", async () => {
      mockCallService
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Transient timeout"))
        .mockResolvedValueOnce(undefined);

      const progressCalls: number[] = [];
      const result = await playMassTracksProgressive({
        maEntityId: "media_player.living_room_ma",
        uris: makeUris(11),
        mode: "play",
        batchSize: 5,
        onProgress: info => progressCalls.push(info.queuedCount),
      });

      expect(result).toEqual({
        totalCount: 11,
        queuedCount: 6,
        failedCount: 5,
        cancelled: false,
      });
      expect(progressCalls).toEqual([1, 1, 6]);
    });

    it("cancels an older in-flight progressive job when a new one starts for the same entity", async () => {
      let resolveSecondCall!: () => void;
      const secondCallGate = new Promise<void>(resolve => {
        resolveSecondCall = resolve;
      });

      mockCallService
        .mockResolvedValueOnce(undefined) // job1 batch 1 (replace track 1)
        .mockReturnValueOnce(secondCallGate) // job1 batch 2 (tracks 2..6) hangs
        .mockResolvedValue(undefined); // job2 calls resolve immediately

      const job1Promise = playMassTracksProgressive({
        maEntityId: "media_player.living_room_ma",
        uris: makeUris(12),
        mode: "play",
        batchSize: 5,
      });

      // Wait a tick for job1 to enter its second batch call
      await Promise.resolve();
      await Promise.resolve();

      const job2Promise = playMassTracksProgressive({
        maEntityId: "media_player.living_room_ma",
        uris: ["ytmusic://track/new-1", "ytmusic://track/new-2"],
        mode: "play",
        batchSize: 5,
      });

      const job2Result = await job2Promise;
      expect(job2Result).toEqual({
        totalCount: 2,
        queuedCount: 2,
        failedCount: 0,
        cancelled: false,
      });

      resolveSecondCall();
      const job1Result = await job1Promise;
      expect(job1Result.cancelled).toBe(true);
      // job1 stopped before invoking its 3rd batch (tracks 7..11) and final track
      expect(mockCallService).toHaveBeenCalledTimes(4);

      cancelBulkPlayForEntity("media_player.living_room_ma");
    });
  });
});
