import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { rpc } from "@/app/lib/orpc";
import { useDebouncedValue } from "@/design-system/use-debounced-value";
import { getSlugIssue } from "@morrow/permissions/workspace-slug";
import {
  getSlugFieldStatus,
  isSlugUsable,
  slugAfterEdit,
  slugAfterNameChange,
  type SlugFieldValue,
} from "./slug-field-state";

const CHECK_DELAY_MS = 300;

type Options = {
  /** The name the slug follows until it is edited by hand. Omit when renaming. */
  name?: string;
  /** The workspace being renamed: its own slugs always count as available. */
  workspaceId?: string;
  /** The slug to start from when renaming. */
  initialSlug?: string;
};

/** Slug input state with live availability, shared by create and rename. */
export function useWorkspaceSlugField({
  name,
  workspaceId,
  initialSlug = "",
}: Options) {
  const [value, setValue] = useState<SlugFieldValue>({
    slug: initialSlug,
    edited: initialSlug !== "",
  });
  const { slug } = value;

  useEffect(() => {
    if (name !== undefined)
      setValue((current) => slugAfterNameChange(current, name));
  }, [name]);

  const debouncedSlug = useDebouncedValue(slug, CHECK_DELAY_MS);
  const isUnchanged = initialSlug !== "" && slug === initialSlug;
  const { data: result, isError } = useQuery({
    queryKey: ["slug-availability", debouncedSlug, workspaceId],
    queryFn: () =>
      rpc.workspace.slugAvailability({ slug: debouncedSlug, workspaceId }),
    enabled:
      debouncedSlug !== "" && !getSlugIssue(debouncedSlug) && !isUnchanged,
    staleTime: 0,
    gcTime: 30_000,
    retry: false,
  });

  // A failed check (rate limit, network) must not read as "checking" forever.
  const status =
    isUnchanged || isError
      ? "idle"
      : getSlugFieldStatus({ slug, checkedSlug: debouncedSlug, result });

  return {
    slug,
    status,
    isUnchanged,
    isUsable: isUnchanged || isSlugUsable(status),
    setSlug: (next: string) => setValue(slugAfterEdit(next)),
    reset: () => setValue({ slug: initialSlug, edited: initialSlug !== "" }),
  };
}
