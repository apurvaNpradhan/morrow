import { createYjsRoutes } from "./lib/yjs-proxy";
import { yjsServerUrl } from "./lib/yjs-server";
import { documentAccess, documentUpdateCheck } from "./lib/write-check";

/** `/api/documents/yjs/*`: the access-checked way to a page's stream. */
export const documentRoutes = createYjsRoutes({
  upstreamUrl: yjsServerUrl,
  access: documentAccess,
  checkUpdate: documentUpdateCheck,
});
