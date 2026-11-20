/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "require", "default"]}
 */
jest.mock("react", () => jest.requireActual("preact/compat"), {
  virtual: true,
});
jest.mock("@components/GlanceGuard", () => ({
  GlanceGuard: ({ children }: { children: unknown }) => children,
}));
jest.mock("@components/i18n", () => ({
  IntlContextProvider: ({ children }: { children: unknown }) => children,
  useIntl: () => ({
    t: ({ id, defaultMessage }: { id: string; defaultMessage?: string }) =>
      defaultMessage ?? id,
  }),
}));

import { act } from "preact/test-utils";
import { css, jsx } from "@emotion/react";
import { HomeAssistant } from "@types";
import { useHass } from "@components/HassContext";

import { CardWrapper } from "./CardWrapper";
import { CardEditorWrapper, EditorCardProps } from "./CardEditorWrapper";

type TestConfig = {
  entity_id: string;
  label?: string;
};

const cardStyle = css({
  color: "red",
});

const TestCard = () => {
  const hass = useHass();
  const state = hass.states["media_player.test"]?.state ?? "missing";
  return jsx(
    "div",
    { className: "test-card", css: cardStyle },
    `state:${state}`
  );
};

class TestCardElement extends CardWrapper<TestConfig> {
  Card = TestCard;
  shouldUpdate = jest.fn(() => false);
}

let editorRenderCount = 0;

const TestEditor = ({ config, hass }: EditorCardProps<TestConfig>) => {
  editorRenderCount += 1;
  const state = hass.states["media_player.test"]?.state ?? "missing";
  return jsx(
    "div",
    { className: "test-editor", css: cardStyle },
    `editor:${config.entity_id}:${state}`
  );
};

class TestCardEditorElement extends CardEditorWrapper<TestConfig> {
  Card = TestEditor;
}

if (!customElements.get("test-card-wrapper")) {
  customElements.define("test-card-wrapper", TestCardElement);
}

if (!customElements.get("test-card-editor-wrapper")) {
  customElements.define("test-card-editor-wrapper", TestCardEditorElement);
}

function makeHass(playerState = "playing"): HomeAssistant {
  return {
    language: "en",
    states: {
      "media_player.test": {
        entity_id: "media_player.test",
        state: playerState,
        attributes: {
          friendly_name: "Test Player",
        },
        last_changed: "2026-01-01T00:00:00Z",
        last_updated: "2026-01-01T00:00:00Z",
        context: { id: "1", parent_id: null, user_id: null },
      },
    },
    entities: {},
    hassUrl: (path: string) => path,
  } as unknown as HomeAssistant;
}

describe("CardWrapper", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    editorRenderCount = 0;
  });

  it("renders via connectedCallback when config and hass are set before attaching", () => {
    const el = document.createElement("test-card-wrapper") as TestCardElement;
    el.config = { entity_id: "media_player.test" };
    el.hass = makeHass("playing");

    expect(el.querySelector(".test-card")).toBeNull();

    act(() => {
      document.body.appendChild(el);
    });

    expect(el.querySelector(".test-card")?.textContent).toBe("state:playing");
    expect(el.querySelectorAll('style[data-emotion^="mmpc"]').length).toBe(1);
  });

  it("renders via set hass when already connected to document.body", () => {
    const el = document.createElement("test-card-wrapper") as TestCardElement;
    el.config = { entity_id: "media_player.test" };

    act(() => {
      document.body.appendChild(el);
      el.hass = makeHass("paused");
    });

    expect(el.querySelector(".test-card")?.textContent).toBe("state:paused");
  });

  it("unmounts DOM content and flushes Emotion style tags on disconnectedCallback", () => {
    const el = document.createElement("test-card-wrapper") as TestCardElement;
    el.config = { entity_id: "media_player.test" };

    act(() => {
      document.body.appendChild(el);
      el.hass = makeHass("playing");
    });

    expect(el.querySelector(".test-card")).not.toBeNull();
    expect(el.querySelectorAll('style[data-emotion^="mmpc"]').length).toBe(1);

    act(() => {
      el.remove();
    });

    expect(el.querySelector(".test-card")).toBeNull();
    expect(el.querySelectorAll('style[data-emotion^="mmpc"]').length).toBe(0);
  });

  it("re-renders immediately on reconnect without a new hass tick and stays rendered when shouldUpdate returns false", () => {
    const el = document.createElement("test-card-wrapper") as TestCardElement;
    el.config = { entity_id: "media_player.test" };

    act(() => {
      document.body.appendChild(el);
      el.hass = makeHass("playing");
    });

    act(() => {
      el.remove();
    });
    expect(el.querySelector(".test-card")).toBeNull();

    act(() => {
      document.body.appendChild(el);
    });
    expect(el.querySelector(".test-card")?.textContent).toBe("state:playing");

    act(() => {
      el.hass = makeHass("playing");
    });
    expect(el.shouldUpdate).toHaveBeenCalled();
    expect(el.querySelector(".test-card")?.textContent).toBe("state:playing");
  });

  it("does not render while detached on hass updates, and renders latest hass when reconnected", () => {
    const el = document.createElement("test-card-wrapper") as TestCardElement;
    el.config = { entity_id: "media_player.test" };

    act(() => {
      document.body.appendChild(el);
      el.hass = makeHass("playing");
    });

    act(() => {
      el.remove();
      el.hass = makeHass("idle");
    });

    expect(el.querySelector(".test-card")).toBeNull();

    act(() => {
      document.body.appendChild(el);
    });

    expect(el.querySelector(".test-card")?.textContent).toBe("state:idle");
  });

  it("does not accumulate duplicate Emotion style tags across repeated disconnect/reconnect cycles", () => {
    const el = document.createElement("test-card-wrapper") as TestCardElement;
    el.config = { entity_id: "media_player.test" };

    act(() => {
      document.body.appendChild(el);
      el.hass = makeHass("playing");
    });

    for (let i = 0; i < 4; i++) {
      act(() => {
        el.remove();
      });
      expect(el.querySelectorAll('style[data-emotion^="mmpc"]').length).toBe(0);

      act(() => {
        document.body.appendChild(el);
      });
      expect(el.querySelector(".test-card")?.textContent).toBe("state:playing");
      expect(el.querySelectorAll('style[data-emotion^="mmpc"]').length).toBe(1);
    }
  });

  it("survives synchronous reparenting without losing DOM or Emotion styles", async () => {
    const col1 = document.createElement("div");
    const col2 = document.createElement("div");
    document.body.appendChild(col1);
    document.body.appendChild(col2);

    const el = document.createElement("test-card-wrapper") as TestCardElement;
    el.config = { entity_id: "media_player.test" };

    act(() => {
      col1.appendChild(el);
      el.hass = makeHass("playing");
    });

    expect(el.querySelector(".test-card")?.textContent).toBe("state:playing");
    expect(el.querySelectorAll('style[data-emotion^="mmpc"]').length).toBe(1);

    col2.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(el.querySelector(".test-card")?.textContent).toBe("state:playing");
    const styles = el.querySelectorAll('style[data-emotion^="mmpc"]');
    expect(styles.length).toBe(1);
    expect(styles[0].textContent).toContain("color:red");
  });
});

describe("CardEditorWrapper", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    editorRenderCount = 0;
  });

  it("renders when hass arrives after setConfig, unmounts on disconnect, re-renders on reconnect, and ignores subsequent hass updates while connected", () => {
    const el = document.createElement(
      "test-card-editor-wrapper"
    ) as TestCardEditorElement;

    act(() => {
      document.body.appendChild(el);
      el.setConfig({ entity_id: "media_player.test" });
    });

    expect(el.querySelector(".test-editor")).toBeNull();
    expect(editorRenderCount).toBe(0);

    act(() => {
      el.hass = makeHass("playing");
    });

    expect(el.querySelector(".test-editor")?.textContent).toBe(
      "editor:media_player.test:playing"
    );
    expect(editorRenderCount).toBe(1);

    act(() => {
      el.hass = makeHass("paused");
    });
    expect(editorRenderCount).toBe(1);
    expect(el.querySelector(".test-editor")?.textContent).toBe(
      "editor:media_player.test:playing"
    );

    act(() => {
      el.remove();
    });
    expect(el.querySelector(".test-editor")).toBeNull();

    act(() => {
      document.body.appendChild(el);
    });
    expect(el.querySelector(".test-editor")?.textContent).toBe(
      "editor:media_player.test:paused"
    );
    expect(editorRenderCount).toBe(2);
  });
});
