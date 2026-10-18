import { openOverlay } from "@/app/commands";

let seed = "";

/** What the search dialog starts with: the text handed over by the palette, or nothing. */
export function getSearchSeed() {
  return seed;
}

/** Opens the search dialog, starting with `query` typed in. */
export function openSearch(query = "") {
  seed = query;
  openOverlay("search");
}
