import { useState } from "react";
import { Button } from "@/design-system/ui/button";
import { trackedCollections } from "./collection-registry";
import { CollectionsView } from "./collections-view";
import { FaultsBar } from "./faults-bar";
import { MutationsView } from "./mutations-view";
import { RequestsView } from "./requests-view";
import { useStore } from "./use-store";

const VIEWS = {
  Collections: CollectionsView,
  Requests: RequestsView,
  Mutations: MutationsView,
};

/** The "Sync" tab of the devtools dock. */
export function SyncPanel() {
  const [view, setView] = useState<keyof typeof VIEWS>("Collections");
  const shapes = useStore(trackedCollections).map(
    (collection) => collection.id,
  );
  const View = VIEWS[view];
  return (
    <div className="h-full overflow-auto">
      <div className="flex gap-1 border-b p-2">
        {(Object.keys(VIEWS) as Array<keyof typeof VIEWS>).map((name) => (
          <Button
            key={name}
            size="xs"
            variant={name === view ? "default" : "outline"}
            onClick={() => setView(name)}
          >
            {name}
          </Button>
        ))}
      </div>
      <FaultsBar shapes={shapes} />
      <View />
    </div>
  );
}
