import { afterEach, describe, expect, it, vi } from "vitest";
import { startAutomationScheduler } from "./automationScheduler";

afterEach(() => {
  vi.useRealTimers();
});

describe("startAutomationScheduler", () => {
  it("起動直後と定期間隔で実行し、前回処理中の重複起動を防ぐ", async () => {
    vi.useFakeTimers();
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const runTick = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue(undefined);

    const scheduler = startAutomationScheduler({
      intervalMs: 1000,
      runTick,
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(runTick).toHaveBeenCalledTimes(1);

    releaseFirst();
    await first;
    await vi.advanceTimersByTimeAsync(1000);
    expect(runTick).toHaveBeenCalledTimes(2);

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(3000);
    expect(runTick).toHaveBeenCalledTimes(2);
  });
});
