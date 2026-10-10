# Capture delivery performance — 2026-10-11

## Changes

- Production storage uses managed S3 multipart upload for artifacts at least 10 MiB. Parts are 5 MiB, with at most three simultaneous uploads. Smaller artifacts keep a single PUT. Failed multipart uploads are aborted automatically.
- Authenticated artifact requests first read the account-scoped retained result. Completed previews avoid Redis lookup and repeated terminal billing finalization. Missing retained results fall back to the existing capture service.
- Worker completion logs now include engine time, storage time, engine phase timings, output format, bytes, and cache status. Default completion logs omit target URLs.

These changes preserve the exact artifact bytes, 2× desktop resolution, full-page section coverage, lazy-image preparation, stability checks, and account authentication. No rendering settings or worker concurrency were changed.

## Compression evaluation

Offline re-encoding of existing RGB PDF strips compared decoded SHA-256 pixel hashes. Every tested encoding preserved pixels, but extra compression cost CPU time:

| Artifact | Encoding | PNG strip bytes | Encode plus pixel verification |
| --- | --- | ---: | ---: |
| Documentation PDF, five strips | Existing settings | 639,012 | 478 ms |
| Documentation PDF | Compression 9 | 476,948 | 799 ms |
| Documentation PDF | Adaptive filtering, compression 6 | 671,362 | 1,071 ms |
| Earlier local Stripe PDF, 24 strips | Existing settings | 23,773,593 | 4,246 ms |
| Earlier local Stripe PDF | Compression 9 | 22,252,195 | 8,320 ms |
| Earlier local Stripe PDF | Adaptive filtering, compression 6 | 18,480,267 | 9,581 ms |
| Earlier local Stripe PDF | Adaptive filtering, compression 9 | 17,545,312 | 31,443 ms |

These are local single-run experiments, including decoding and hash verification, rather than production rendering timings. The Stripe file predates the latest retained production capture. Encoding remains unchanged because these results do not establish a consistent end-to-end speed improvement.

## Verification and measurement limits

The actual AWS SDK uploader is exercised against a local HTTP S3 fixture. An 11 MiB upload produces three concurrent parts, preserves the entire SHA-256 digest and object metadata, and completes successfully. A failed part causes an abort and never produces a completed object. Authenticated preview tests cover owner access, other-account denial, anonymous denial, and retained-result bypass of queue finalization.

Production percentage improvement requires fresh captures on the deployed worker. Compare `engine_ms`, `storage_ms`, and `duration_ms` for repeated equivalent targets, and measure client preview time separately. Multipart throughput depends on service bandwidth and request latency; it does not guarantee a threefold speedup. One worker still serializes capture jobs. Additional replicas or separate heavy-PDF workers should follow CPU, memory, queue-wait, and cost measurements.
