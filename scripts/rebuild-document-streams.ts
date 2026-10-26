// Recreates every page's current stream from `document_body`, for a Durable
// Streams volume that was lost (docs/runbook.md, "Durable Streams (pages)").
// Run it with the production environment, with `morrow` and `morrow-worker`
// stopped and `morrow-streams` running on an empty volume:
//
//   pnpm --filter @morrow/api exec varlock run -- tsx ../../scripts/rebuild-document-streams.ts
//
// It skips a stream that already exists, so it can be run again.
import { createPageStream } from "../apps/api/src/documents/lib/yjs-streams";
import { startYjsServer, stopYjsServer } from "../apps/api/src/documents/index";

type PageToRebuild = { docId: string; generation: number; update: Uint8Array };

/** The pages and the Yjs state of their stored content. Filled in with the `documents` tables. */
async function pagesToRebuild(): Promise<PageToRebuild[]> {
  return [];
}

const yjsUrl = await startYjsServer();
let created = 0;
let skipped = 0;
try {
  for (const { docId, generation, update } of await pagesToRebuild()) {
    const wasCreated = await createPageStream(
      yjsUrl,
      { docId, generation },
      update,
    );
    if (wasCreated) created += 1;
    else skipped += 1;
  }
} finally {
  await stopYjsServer();
}
console.log(`Rebuilt ${created} page streams; ${skipped} already existed.`);
