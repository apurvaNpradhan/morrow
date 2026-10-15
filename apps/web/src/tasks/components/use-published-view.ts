import { useEffect } from "react";
import {
  clearView,
  type PublishedView,
  publishView,
} from "../lib/view-order-store";

/** Publishes what the board or list shows for the keyboard, while it is mounted. */
export function usePublishedView(view: PublishedView) {
  useEffect(() => {
    publishView(view);
    return clearView;
  }, [view]);
}
