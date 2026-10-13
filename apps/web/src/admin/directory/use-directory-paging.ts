import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/design-system/use-debounced-value";

/**
 * Search box and page index for a paged directory. A new search returns to the
 * first page.
 */
export function useDirectoryPaging() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [searchedFor, setSearchedFor] = useState(debouncedSearch);
  const [page, setPage] = useState(0);

  if (debouncedSearch !== searchedFor) {
    setSearchedFor(debouncedSearch);
    setPage(0);
  }

  return { search, setSearch, debouncedSearch, page, setPage };
}

/** Steps back when the current page no longer exists (rows were removed). */
export function usePageClamp({
  page,
  pageCount,
  loaded,
  setPage,
}: {
  page: number;
  pageCount: number;
  loaded: boolean;
  setPage: (page: number) => void;
}) {
  useEffect(() => {
    if (loaded && page >= pageCount) setPage(pageCount - 1);
  }, [loaded, page, pageCount, setPage]);
}
