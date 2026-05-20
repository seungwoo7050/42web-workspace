import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, PADDLE_HEIGHT } from "@pong-pong/shared";
import { PongAi } from "./pongAi";
import { PongSimulation, type PongSimulationInputs } from "./pongSimulation";

const FIXED_DELTA_MS = 50;

describe("PongSimulation", () => {
  it("returns a deterministic next state without mutating its input", () => {
    const initial = PongSimulation.initialState();
    const before = structuredClone(initial);
    const inputs = { left: -1, right: 1 } as const;

    const first = PongSimulation.step(initial, inputs, FIXED_DELTA_MS);
    const second = PongSimulation.step(initial, inputs, FIXED_DELTA_MS);

    expect(first).toEqual(second);
    expect(initial).toEqual(before);
    expect(first).not.toBe(initial);
    expect(first.paddles.left).not.toBe(initial.paddles.left);
    expect(first.ball).not.toBe(initial.ball);
  });

  it("scales movement by delta while clamping paddles to the arena", () => {
    const initial = PongSimulation.initialState();
    const halfStep = PongSimulation.step(initial, { left: 1, right: 0 }, 25);
    const fullStep = PongSimulation.step(initial, { left: 1, right: 0 }, 50);

    expect(fullStep.paddles.left.y - initial.paddles.left.y).toBeCloseTo(
      (halfStep.paddles.left.y - initial.paddles.left.y) * 2
    );

    let state = initial;
    for (let tick = 0; tick < 100; tick += 1) {
      state = PongSimulation.step(state, { left: 1, right: -1 }, FIXED_DELTA_MS);
    }
    expect(state.paddles.left.y).toBeLessThanOrEqual(GAME_HEIGHT - PADDLE_HEIGHT - 16);
    expect(state.paddles.right.y).toBeGreaterThanOrEqual(16);
  });

  it("finishes when the winning score is reached", () => {
    const state = PongSimulation.initialState();
    state.rightScore = 2;
    state.ball.position.x = -1;
    state.ball.velocity = { x: 0, y: 0 };

    const finished = PongSimulation.step(state, { left: 0, right: 0 }, FIXED_DELTA_MS);

    expect(finished).toMatchObject({
      phase: "finished",
      leftScore: 0,
      rightScore: 3,
      winnerSide: "right"
    });
  });

  it("keeps playing a golden goal when the clock runs out on a tie", () => {
    const state = { ...PongSimulation.initialState(), tick: 899, leftScore: 1, rightScore: 1 };

    const overtime = PongSimulation.step(state, { left: 0, right: 0 }, FIXED_DELTA_MS);

    expect(overtime).toMatchObject({ phase: "playing", tick: 900, winnerSide: null });
  });

  it("ends overtime on the next goal", () => {
    const state = { ...PongSimulation.initialState(), tick: 950, leftScore: 1, rightScore: 1 };
    state.ball = { position: { x: -1, y: 300 }, velocity: { x: 0, y: 0 } };

    const finished = PongSimulation.step(state, { left: 0, right: 0 }, FIXED_DELTA_MS);

    expect(finished).toMatchObject({ phase: "finished", leftScore: 1, rightScore: 2, winnerSide: "right" });
  });

  it("awards the leader when the clock runs out without a tie", () => {
    const state = { ...PongSimulation.initialState(), tick: 899, leftScore: 0, rightScore: 2 };

    const finished = PongSimulation.step(state, { left: 0, right: 0 }, FIXED_DELTA_MS);

    expect(finished).toMatchObject({ phase: "finished", winnerSide: "right" });
  });

  it("still returns the ball on the last tick of overtime", () => {
    // step()은 tick을 먼저 올리므로 이 스텝은 2099틱, 상한(900 + 1,200) 바로 앞이다.
    const state = overtimeRallyState(900 + 1_198);

    const next = PongSimulation.step(state, { left: 0, right: 0 }, FIXED_DELTA_MS);

    expect(next.ball.velocity.x).toBeGreaterThan(0);
    expect(next.phase).toBe("playing");
  });

  it("stops returning the ball once overtime reaches its cap so the next crossing ends the match", () => {
    let state = overtimeRallyState(900 + 1_199);

    for (let tick = 0; tick < 10 && state.phase === "playing"; tick += 1) {
      state = PongSimulation.step(state, { left: 0, right: 0 }, FIXED_DELTA_MS);
    }

    expect(state).toMatchObject({ phase: "finished", leftScore: 1, rightScore: 2, winnerSide: "right" });
  });

  it("rejects invalid time deltas", () => {
    const state = PongSimulation.initialState();
    expect(() => PongSimulation.step(state, { left: 0, right: 0 }, 0)).toThrow(RangeError);
    expect(() => PongSimulation.step(state, { left: 0, right: 0 }, Number.NaN)).toThrow(RangeError);
  });

  it("replays one thousand ticks to the same final hash", () => {
    const first = replayHash("replay-seed-2026");
    const second = replayHash("replay-seed-2026");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});

function replayHash(seed: string): string {
  const ai = new PongAi(seed, 1_300);
  let state = PongSimulation.initialState();

  for (let tick = 0; tick < 1_000; tick += 1) {
    const inputs: PongSimulationInputs = {
      left: tick % 60 < 20 ? -1 : tick % 60 < 40 ? 1 : 0,
      right: ai.nextDirection(state)
    };
    state = PongSimulation.step(state, inputs, FIXED_DELTA_MS);
  }

  return createHash("sha256")
    .update(JSON.stringify({ state, ai: ai.snapshot() }))
    .digest("hex");
}

// 1:1 연장 중, 공이 왼쪽 패들 바로 앞에서 패들 쪽으로 오고 패들이 공 높이에 맞춰 서 있는 상태
function overtimeRallyState(tick: number) {
  const state = { ...PongSimulation.initialState(), tick, leftScore: 1, rightScore: 1 };
  state.ball = { position: { x: 48, y: 300 }, velocity: { x: -10, y: 0 } };
  state.paddles.left.y = 300 - PADDLE_HEIGHT / 2;
  return state;
}

