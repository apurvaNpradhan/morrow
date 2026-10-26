// Recreates every page's current stream from `document_body`, for a Durable
// Streams volume that was lost (docs/runbook.md, "Durable Streams (pages)").
// Run it with the production environment, with `morrow` and `morrow-worker`
// stopped and `morrow-streams` running on an empty volume:
//
//   pnpm --filter @morrow/api exec varlock run -- tsx ../../scripts/rebuild-document-streams.ts
//
// It skips a stream that already exists, so it can be run again.
import { startYjsServer, stopYjsServer } from "../apps/api/src/documents/index";
import { rebuildDocumentStreams } from "../apps/api/src/documents/lib/rebuild-streams";

const yjsUrl = await startYjsServer();
try {
  const { created, skipped } = await rebuildDocumentStreams(yjsUrl);
  console.log(`Rebuilt ${created} page streams; ${skipped} already existed.`);
} finally {
  await stopYjsServer();
  process.exit(0);
}
