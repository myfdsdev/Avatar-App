import {
  LocalVideoTrack,
  TrackPublishOptions,
  TrackSource,
  VideoBufferType,
  VideoFrame,
  VideoSource,
} from "@livekit/rtc-node";
import { BaseAvatarRenderer } from "./base.renderer.js";
import { logger } from "../../config/logger.js";

const WIDTH = 256;
const HEIGHT = 256;
const FPS = 12;
// One full pulse per cycle; frames are reused, so this only costs memory.
const CYCLE_FRAMES = 16;

/**
 * Publishes a generated video track in place of a real avatar.
 *
 * This exists so the entire call path - token, room, dispatch, track
 * publication, client playback - can be exercised with no vendor account.
 *
 * Every frame is drawn once at startup and then replayed. The first version
 * computed each frame on demand, and LiveKit's agent loop reported exactly what
 * that costs: "event loop blocked; synchronous work on the agent loop delays
 * audio and turn handling", followed by a TTS synthesis retry. Publishing video
 * must never compete with the conversation, so the per-frame cost here is a
 * buffer lookup and nothing else.
 *
 * Phase 2 replaces this with the LemonSlice renderer. Nothing outside this file
 * changes when it does.
 */
export class MockAvatarRenderer extends BaseAvatarRenderer {
  constructor() {
    super("mock");
    this.timer = null;
    this.track = null;
    this.source = null;
    this.frameIndex = 0;
    this.speaking = false;
    /** @type {{idle: Uint8Array[], speaking: Uint8Array[]}|null} */
    this.frames = null;
  }

  async start({ room, avatar }) {
    this.frames = await renderCycles();

    this.source = new VideoSource(WIDTH, HEIGHT);
    this.track = LocalVideoTrack.createVideoTrack("avatar-video", this.source);

    const options = new TrackPublishOptions();
    options.source = TrackSource.SOURCE_CAMERA;

    await room.localParticipant.publishTrack(this.track, options);

    this.timer = setInterval(() => this.#pushFrame(), Math.round(1000 / FPS));
    logger.info({ avatar: avatar?.name, w: WIDTH, h: HEIGHT, fps: FPS }, "mock renderer publishing");
  }

  /** Drives the disc's pulse, so the placeholder reacts while the agent talks. */
  setSpeaking(speaking) {
    this.speaking = speaking;
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
    this.source = null;
    this.frames = null;
  }

  #pushFrame() {
    const cycle = this.speaking ? this.frames.speaking : this.frames.idle;
    const data = cycle[this.frameIndex % cycle.length];
    this.source.captureFrame(new VideoFrame(data, WIDTH, HEIGHT, VideoBufferType.RGBA));
    this.frameIndex += 1;
  }
}

/**
 * Draws both pulse cycles once, yielding between frames.
 *
 * Doing it in one synchronous pass is ~12 MB of pixel writes, and the agent
 * loop reported it as blocked - at the worst possible moment, while the call is
 * connecting. Yielding costs nothing here because this runs once per call.
 */
async function renderCycles() {
  const build = async (amplitude) => {
    const frames = [];
    for (let i = 0; i < CYCLE_FRAMES; i += 1) {
      frames.push(drawFrame(0.3 + amplitude * Math.sin((i / CYCLE_FRAMES) * Math.PI * 2)));
      // Hand the loop back so audio and turn handling keep their slice.
      await new Promise((resolve) => setImmediate(resolve));
    }
    return frames;
  };

  return { idle: await build(0.03), speaking: await build(0.14) };
}

/**
 * A pink disc on a near-black field, using the same values as the design
 * tokens so the placeholder does not look foreign inside the app.
 */
function drawFrame(radiusRatio) {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const radiusSq = (WIDTH * radiusRatio) ** 2;

  for (let y = 0; y < HEIGHT; y += 1) {
    const dy = y - cy;
    for (let x = 0; x < WIDTH; x += 1) {
      const i = (y * WIDTH + x) * 4;
      const dx = x - cx;

      if (dx * dx + dy * dy < radiusSq) {
        // --pink, shaded top to bottom.
        const shade = 1 - (dy / HEIGHT) * 0.5;
        data[i] = 255 * shade;
        data[i + 1] = 97 * shade;
        data[i + 2] = 131 * shade;
      } else {
        // --bg
        data[i] = 10;
        data[i + 1] = 10;
        data[i + 2] = 12;
      }
      data[i + 3] = 255;
    }
  }

  return data;
}
