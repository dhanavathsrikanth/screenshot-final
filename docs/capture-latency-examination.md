# Capture latency examination — 2026-10-11

Read-only examination of retained PostgreSQL capture results, BullMQ `timestamp` / `processedOn` / `finishedOn`, worker configuration, and the engine / storage / preview code. No production settings or rendering behavior were changed.

## Measured recent captures

| Target and output | Engine-reported render | Worker processing | Queue wait | File size |
| --- | ---: | ---: | ---: | ---: |
| Stripe full-page PDF, 14,691 CSS px / 24 sections | 32.685 s | 62.479 s | 0.067 s | 19.325 MiB |
| Documentation full-page PDF, 2,590 CSS px / 5 sections | 7.608 s | 8.159 s | 0.072 s | 0.610 MiB |
| Example.com full-page PDF, 775 CSS px / 2 sections | 3.361 s | 3.769 s | 0.070 s | 0.148 MiB |
| Stripe viewport WebP | 2.966 s | 3.360 s | 0.070 s | 0.178 MiB |

These are individual samples, not percentile measurements. Worker processing includes finishing cleanup, object storage, signing, cache save, and final queue progress updates. Engine-reported render duration excludes those steps. The large Stripe PDF has 29.794 s outside the reported render duration; the code puts storage delivery in that interval, but existing logs do not isolate upload from SDK retry or cleanup time.

One earlier Example.com capture spent 1,078.393 s waiting for the worker during the previously fixed startup incident; its actual worker processing was 1.355 s. A later cache hit processed in 0.308 s. The current Redis queue had zero waiting and zero active jobs at the time of examination. All four recent uncached captures above completed on attempt 1.

## Causes

1. Full-page output uses a fidelity-oriented section algorithm. Desktop is 2× resolution, so each strip carries four times the pixel count of a 1× strip. Stripe required 24 viewport screenshots, cropping/re-encoding PNG strips, and PDF assembly.
2. Dynamic pages use a configured 400 ms scroll pause per section, image hydration up to 1.2 s, viewport stability checks up to 600 ms, and a bottom-of-page growth check. Static pages can skip the scroll pause. These waits protect lazy-loaded content and scroll reveals.
3. PDF output embeds lossless RGB PNG strips. The 19.3 MiB Stripe artifact makes storage delivery and browser download expensive. Storage currently uses one PutObject request, not parallel multipart upload.
4. Railway has one worker replica and worker concurrency 1. A heavy PDF holds that slot until delivery completes, making concurrently submitted captures wait. The worker and bucket are both US East; there is no evidenced worker/bucket region mismatch.
5. The PDF preview downloads through the authenticated Vercel route and renders visible canvas tiles. This adds delivery and browser work after job completion. Each artifact request also currently runs queue lookup and terminal database finalization; retained-result lookup can remove redundant database work from that path.
6. Polling adds up to roughly 1 s after an active job completes or 2 s while queued, plus HTTP time. Poll errors add a 3 s retry delay. Existing job duration fields do not expose these client costs, queue wait, or storage latency.

## Priorities to benchmark before changing production

- Measure storage upload/sign/cache/cleanup separately and preserve engine phase timings in normal worker logs.
- Benchmark lossless PNG adaptive row filtering and compression level against the large PDF; preserve decoded pixel equality and measure added CPU time against transfer savings.
- Railway documents multipart upload support. Benchmark parallel multipart delivery for large buffers against the current PutObject.
- Use retained authenticated results for artifact lookup rather than repeating terminal finalization for every PDF request.
- Isolate heavy PDF jobs from ordinary screenshots, or raise capacity only after measuring CPU/memory headroom. More concurrency can slow each job on a constrained host.

References: https://sharp.pixelplumbing.com/api-output/ ; https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html ; https://docs.railway.com/storage-buckets
