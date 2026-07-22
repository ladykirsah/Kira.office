import { describe, it, expect } from "vitest";
import { retryRead, isRetryableStorageError } from "./retryRead";

/**
 * 2026-07-22: roughly one in eight image requests on the live storefront returned HTTP 500.
 * The Worker log had the answer all along:
 *
 *   [api] GET /img/taxonomy/car-brand-….png failed:
 *   Error: get: We encountered an internal error. Please try again. (10001)
 *
 * R2 throws a transient internal error and literally asks the caller to try again. We never did,
 * so it fell to the top-level boundary and became a 500 — a visibly broken product photo.
 *
 * It hid for so long because the Worker CATCHES that error and returns a 500 Response, so the
 * dashboard "Errors" metric — which counts uncaught throws — stayed at 0.
 */
describe("isRetryableStorageError", () => {
  it("given R2's own internal-error message > says retry", () => {
    const err = new Error("get: We encountered an internal error. Please try again. (10001)");
    expect(isRetryableStorageError(err)).toBe(true);
  });

  it("given the bare 10001 code > says retry", () => {
    expect(isRetryableStorageError(new Error("something broke (10001)"))).toBe(true);
  });

  it("given a transient network failure > says retry", () => {
    expect(isRetryableStorageError(new TypeError("Network connection lost."))).toBe(true);
  });

  it("given a programming mistake > does NOT retry", () => {
    // Retrying a bug just triples the latency before failing anyway, and hides the bug.
    expect(isRetryableStorageError(new TypeError("obj.body is not a function"))).toBe(false);
  });

  it("given a non-Error throw > does not retry", () => {
    expect(isRetryableStorageError("nope")).toBe(false);
  });
});

describe("retryRead", () => {
  it("given it succeeds first time > returns the value and calls once", async () => {
    let calls = 0;
    const out = await retryRead(async () => {
      calls++;
      return "obj";
    });
    expect(out).toBe("obj");
    expect(calls).toBe(1);
  });

  it("given a null result > returns null WITHOUT retrying, because absent is a real answer", async () => {
    // R2 returns null for a key that does not exist. Retrying that would turn every 404 into three
    // round trips — the exact opposite of the point.
    let calls = 0;
    const out = await retryRead(async () => {
      calls++;
      return null;
    });
    expect(out).toBeNull();
    expect(calls).toBe(1);
  });

  it("given the R2 transient error once > retries and returns the value", async () => {
    let calls = 0;
    const out = await retryRead(async () => {
      calls++;
      if (calls === 1) throw new Error("get: We encountered an internal error. (10001)");
      return "obj";
    });
    expect(calls).toBe(2);
    expect(out).toBe("obj");
  });

  it("given it fails twice then works > still returns the value", async () => {
    let calls = 0;
    const out = await retryRead(async () => {
      calls++;
      if (calls < 3) throw new Error("internal error (10001)");
      return "obj";
    });
    expect(calls).toBe(3);
    expect(out).toBe("obj");
  });

  it("given it always fails > rethrows the LAST error after exhausting attempts", async () => {
    let calls = 0;
    await expect(
      retryRead(async () => {
        calls++;
        throw new Error(`internal error (10001) attempt ${calls}`);
      }),
    ).rejects.toThrow("attempt 3");
    expect(calls).toBe(3);
  });

  it("given a non-retryable error > rethrows immediately without retrying", async () => {
    let calls = 0;
    await expect(
      retryRead(async () => {
        calls++;
        throw new TypeError("bucket.get is not a function");
      }),
    ).rejects.toThrow("not a function");
    expect(calls).toBe(1);
  });
});
