import { useEffect } from "react";

type PageTitleProps = {
  title: string;
  suffix?: string;
  hideAppName?: boolean;
};

/**
 * Sets the tab title while it is mounted and puts the previous one back when it
 * unmounts, so a title set by something nested (an open task) gives way to the
 * page's own when it closes. Only a page renders one; a layout that wraps pages
 * must not, because React runs a parent's effect after its children's and the
 * layout's title would replace every page's.
 */
export function PageTitle({
  title,
  suffix = "Morrow",
  hideAppName = false,
}: PageTitleProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = hideAppName || !suffix ? title : `${title} · ${suffix}`;
    return () => {
      document.title = previous;
    };
  }, [title, suffix, hideAppName]);

  return null;
}
