# Faster Evidence Upload Implementation Plan

**Goal:** Reduce repeated Drive calls and allow bounded image parallelism, including within one result tab. Preserve per-tab durable completion and PO readiness gates.

**Architecture:** Cache/coalesce Drive folder lookups per signed-in user and project in the server process with bounded lifetime/size. Retain authorization on every upload. Schedule image transfers using one global worker budget with fair interleaving across tabs; serialize shared DB checkpoints. Reuse content-hash calculations within one import. No new provider, access grant, queue, or deployment.

## Tasks

- [x] Tests: prove simultaneous uploads share folder lookups, users/projects remain isolated, failures expire/retry, same-tab images overlap, global transfer budget is enforced, and durable checkpoints still serialize.
- [x] Implement folder cache and integrate the existing evidence upload route. Invalidate failed Drive paths for retry without automatically replaying upload side effects.
- [x] Replace tab-only image scheduling with image workers and bounded, queued tab progress. Reuse computed image keys in the importer; retain proof of durable completion. Coalesce duplicate concurrent references to the same case/result/image.
- [x] Run controlled before/after benchmarks, full tests, lint/build and read-only checks. Review changes and document that live external upload timing is not measured by the controlled benchmark.

## Verification

- Controlled transfer-only benchmark: 16 images, each with 40ms simulated transfer latency, previous same-tab serial loop 658ms, new global-four worker pool 167ms (3.94x). Maximum transfers observed: 4.
- Same-user/project/case folder lookup benchmark: 48 calls reduced to 3 for 16 uploads in one warm process. Cache is best effort per server process, expires after five minutes, and is bounded to 1000 entries. Cold serverless instances have separate caches.
- No live external uploads or changes to public/recipient permissions were performed for the benchmark. It does not measure workbook extraction, compression, internet latency or real Google Drive throughput.
- 448 tests passed; ESLint, production build/TypeScript, read-only checks, navigation-cache checks, and diff whitespace check passed. Static review found no concrete issues in the targeted changes.
- Reproduce: `node --import tsx scripts/benchmark-evidence-upload.ts` using the supported Node >=22 runtime.
