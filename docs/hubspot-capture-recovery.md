# HubSpot full-page capture recovery — 2026-10-11

## Observed failure

The live playground request used JPEG, desktop 1280×720 at 2×, visible-section full-page capture, quality 90, and a 60-second timeout. Worker logs showed three queue attempts: 118,563 ms and 116,313 ms ended with an exhausted full-page budget; 39,951 ms ended with `page.evaluate: Target crashed`. Worker memory repeatedly plateaued around 1 GB during the failures. This is evidence of resource pressure, although no kernel OOM event was retrieved.

The engine independently retried browser crashes inside each queue attempt. Each engine attempt created a new rendering budget. Therefore a configured 60-second request could occupy the only worker for several minutes and delay other jobs.

An equivalent local full-page HubSpot JPEG completed in 39.5 seconds: 2560×13508 pixels, 11 sections, complete bottom coverage, about 2.37 MB. Local timings do not establish production throughput.

## Changes

- Capture every section and perform content validation/optional inspection, then close the page context before PNG-strip processing, whole-image composition, or PDF assembly. The compressed viewport buffers remain available for encoding. This reduces simultaneous browser and image-processing memory without changing pixels.
- Disable the worker's spare prewarmed page and internal engine retry. The queue continues to own recovery from transient crashes and storage/network failures.
- Keep one rendering budget across engine retries. A deadline timer closes stalled page operations; exhausted render budgets are terminal instead of automatically repeating the same timeout.
- Recycle browsers after crashes and timeouts so later jobs do not reuse a damaged renderer.
- Use Node's available/container-constrained memory when calculating headroom rather than host-wide RAM.
- Log failed phase timings and error code without dumping page artifacts.

## Verification

Exact decoded image comparison passes for PNG, JPEG, and WebP with and without releasing the renderer before encoding. Existing full-page regressions verify lazy media, reveal animations, delayed growth, fixed elements, fractional scale, full-page PDF layout, and bottom coverage. A stalled HTTP response verifies deadline cancellation, terminal timeout, and released worker slots. Worker delivery/startup checks and the production frontend build pass.

Four existing exact-color tests had implicitly used the default lossy WebP format. Their fixtures now explicitly request PNG; production format defaults remain unchanged.

Production capture results must be verified after deployment. Heavy websites can still take tens of seconds at 2×, and the single-worker queue serializes simultaneous requests.
