# Automatic GIF compression

User approved automatic compression before evidence uploads, preserving readable animated evidence and keeping the original if optimization fails or is not smaller.

Design: optimize GIF structure losslessly with pinned `gifsicle-wasm-browser@1.5.19`, loaded only on GIF uploads. Use a dedicated worker, at most one compression job at a time, a 30-second deadline, and explicit worker/object-URL cleanup. The existing PNG/JPEG/WebP and video paths stay intact. Keep GIF dimensions, frame count, per-frame delays and looping; do not resize, quantize colors or remove frames. Validate the output before selecting it and preserve the original filename/import anchor. No GIF data goes to an external optimizer. Existing Drive ownership and upload size limits stay intact. Existing saved evidence is not rewritten.

Implementation and checks:
- Write a valid animated GIF fixture and observe the existing upload compressor return it unchanged before adding the feature.
- Add bounded GIF metadata inspection and validation, a cancellable worker bridge, and serialized fallback-safe compression.
- Integrate through the shared `compressEvidenceImage` used by manual and whole-project uploads.
- Exercise the actual pinned WASM engine under a Node worker bridge; test timing, looping, filenames, concurrency, failure, timeout, growth and malformed output.
- Run a browser smoke harness with the production compressor and compare decoded frames; measure a representative large GIF if available.
- Run full tests, TypeScript/build/lint/guards and independent review. No real evidence uploads or retroactive file replacement are needed for verification.

References: [package source](https://github.com/renzhezhilu/gifsicle-wasm-browser), [Gifsicle optimization options](https://www.lcdf.org/gifsicle/man.html). Use level 1 and preserve empty frames; higher optimization levels can cost disproportionately more time on large files.

## Verification results

- Observed the existing compressor fail the new GIF compression assertion, then passed with the actual pinned WASM worker engine. Nine focused cases cover animation metadata, filename/import identity, single-worker concurrency, invalid/larger output, startup failures, deadline termination/object URL cleanup, malformed input and bounds, and transparent disposal modes 1/2/3.
- Full suite: 519/519 pass. Production build, TypeScript, changed-file lint, read-only/navigation guards, and whitespace checks pass.
- Offline integration runs the exact browser worker script with only messaging adapted to Node worker_threads. Synthetic intentionally unoptimized inputs: a 98,821-byte four-frame GIF and a 23,688,165-byte 120-frame GIF, plus three transparent four-frame fixtures. All optimize successfully. These artificial ratios are not estimates for user evidence.
- Independent Pillow decoding compared every displayed pixel/alpha, per-frame timing, dimensions and loop count for all 136 frames; all match. No real evidence was uploaded or replaced.
- Browser smoke execution was blocked by the automatic origin-approval review because its account usage limit was exhausted. The independent review agent also failed for that quota limit. Manual source review completed; actual browser UI confirmation remains unperformed. No alternate browser surface was used. The temporary local smoke server was stopped.
- Durable measurement report: `gif-compression-verification.json` in this task's visualization directory.
