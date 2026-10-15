import { useRef, useState } from "react";

/** What the toolbar holds: search text, which menus are open, and the search field to focus. */
export function useToolbarState() {
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  return {
    search,
    setSearch,
    filterOpen,
    setFilterOpen,
    displayOpen,
    setDisplayOpen,
    searchRef,
    focusSearch: () => searchRef.current?.focus(),
  };
}

export type ToolbarState = ReturnType<typeof useToolbarState>;
