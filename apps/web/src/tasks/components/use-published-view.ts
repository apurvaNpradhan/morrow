import { useEffect } from "react";
import { clearSelection, pruneSelection } from "../lib/selection-store";
import {
  clearView,
  type PublishedView,
  publishView,
} from "../lib/view-order-store";

/**
 * Publishes what the board or list shows for the keyboard, while it is
 * mounted. The selection follows it: tasks that stop being shown leave the
 * selection, and leaving the view (another layout or Project) clears it.
 */
export function usePublishedView(view: PublishedView) {
  useEffect(() => {
    publishView(view);
    pruneSelection((view.selectable ?? view.tasks).map((task) => task.id));
    return clearView;
  }, [view]);
  useEffect(() => clearSelection, []);
}
