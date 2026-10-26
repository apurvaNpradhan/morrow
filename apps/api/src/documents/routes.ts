import { acceptEveryUpdate, refuseEveryPage } from "./lib/yjs-access";
import { createYjsRoutes } from "./lib/yjs-proxy";
import { yjsServerUrl } from "./lib/yjs-server";

/** `/api/documents/yjs/*`: the access-checked way to a page's stream. */
export const documentRoutes = createYjsRoutes({
  upstreamUrl: yjsServerUrl,
  access: refuseEveryPage,
  checkUpdate: acceptEveryUpdate,
});
