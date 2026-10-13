import { ScreenshotAPIError, type CaptureOptions } from "@screenshotapi/contracts";
import type { ScreenshotAPIEngine, CaptureOutcome } from "@screenshotapi/engine";
import type { CaptureStore } from "@screenshotapi/storage";
import type { CaptureContext, CaptureExecutor } from "@screenshotapi/queue";

/**
 * Wires the headless capture engine to the byte store so a BullMQ job turns into
 * a real screenshot.
 *
 * The executor is the only place where the engine and the store share state. Keeping it
 * thin lets the rest of the worker be a pure queue consumer — easier to test, easier to
 * swap the engine or the store independently.
 */
export function createWorkerExecutor(deps: {
  engine: ScreenshotAPIEngine;
  store: CaptureStore;
  logger?: (level: "debug" | "info" | "warn" | "error", message: string, fields?: Record<string, unknown>) => void;
}): CaptureExecutor {
  const log = deps.logger ?? (() => undefined);
  return async (options: CaptureOptions, context: CaptureContext) => {
    const started = Date.now();
    log("debug", "worker job received", {
      worker_id: context.workerId,
      attempt: context.attempt,
      url: options.url,
    });

    let outcome: CaptureOutcome;
    try {
      outcome = await deps.engine.capture(options, { inspectPage: options.inspect_page });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log("warn", "worker job failed at engine", {
        worker_id: context.workerId,
        attempt: context.attempt,
        duration_ms: Date.now() - started,
        url: options.url,
        reason,
        ...(error instanceof ScreenshotAPIError ? {
          code: error.code,
          phases_ms: (error.details?.timings as { phases_ms?: Record<string, number> } | undefined)?.phases_ms,
        } : {}),
      });
      if (error instanceof ScreenshotAPIError && error.code === "render_timeout") {
        throw new ScreenshotAPIError({ code: error.code, message: error.message, requestId: error.requestId, retriable: false, details: error.details });
      }
      throw error;
    }

    const renderedAt = Date.now();
    const stored = outcome.data.cached ? outcome.data : await deps.store.save(options, outcome.data, outcome.buffer);
    if (!stored.cdn_url) throw new ScreenshotAPIError({
      code: "internal_error",
      message: "Screenshot delivery URL is unavailable; capture was not delivered",
      requestId: context.workerId,
      retriable: true,
    });
    log("info", "worker job completed", {
      worker_id: context.workerId,
      attempt: context.attempt,
      duration_ms: Date.now() - started,
      engine_ms: renderedAt - started,
      storage_ms: Date.now() - renderedAt,
      phases_ms: outcome.timings?.phases_ms,
      format: stored.format,
      bytes: stored.bytes,
      cached: stored.cached,
    });

    return { data: { ...stored, ...(options.inspect_page ? { inspection: {
      markdown: (outcome.inspection?.markdown ?? "").slice(0, 12000),
      accessible_tree: (outcome.inspection?.accessibleTree ?? "").slice(0, 12000),
      untrusted_content: true as const,
      character_limit: 12000 as const,
    } } : {}) } };
  };
}
