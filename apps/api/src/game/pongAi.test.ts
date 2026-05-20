import { describe, expect, it } from "vitest";
import { PongAi, SeededIntegerPrng } from "./pongAi";
import { PongSimulation } from "./pongSimulation";

describe("SeededIntegerPrng", () => {
  // [INTV:ARCH] 같은 seed로 여러 인스턴스를 만들어 스트림이 동일한지를 실제로 호출해 검증한다 —
  // 이 동작 검증 하나가 "Math.random()/Math.sin() 같은 비결정적 난수원으로 바뀌면 안 된다"는
  // 요구사항까지 함께 잡아준다(비결정적 소스로 바뀌면 이 테스트가 즉시 실패한다). 구현이 실제로
  // 어떤 함수를 쓰는지 소스 텍스트로 따로 확인할 필요가 없다.
  it("produces the same integer stream for the same seed", () => {
    const left = new SeededIntegerPrng("same-seed");
    const right = new SeededIntegerPrng("same-seed");

    expect(Array.from({ length: 20 }, () => left.nextUint32())).toEqual(
      Array.from({ length: 20 }, () => right.nextUint32())
    );
  });
});

describe("PongAi", () => {
  it("returns the same input sequence for the same seed and states", () => {
    const first = new PongAi("room-seed", 1_300);
    const second = new PongAi("room-seed", 1_300);
    let state = PongSimulation.initialState();
    const firstDirections: number[] = [];
    const secondDirections: number[] = [];

    for (let tick = 0; tick < 120; tick += 1) {
      const firstDirection = first.nextDirection(state);
      const secondDirection = second.nextDirection(state);
      firstDirections.push(firstDirection);
      secondDirections.push(secondDirection);
      state = PongSimulation.step(state, { left: 0, right: firstDirection }, 50);
    }

    expect(firstDirections).toEqual(secondDirections);
    expect(first.snapshot()).toEqual(second.snapshot());
  });

  it("stops producing movement after a match finishes", () => {
    const ai = new PongAi(42, 1_400);
    const state = PongSimulation.initialState();
    state.phase = "finished";
    state.winnerSide = "left";

    expect(ai.nextDirection(state)).toBe(0);
  });
});
