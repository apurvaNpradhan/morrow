import { isHttpUrl, LINK_TITLE_MAX, LINK_URL_MAX } from "@morrow/sync-schemas";
import type { TaskLinkRow, TaskRow } from "@morrow/sync-schemas";
import { Globe, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { addLink, editLink, removeLink } from "../actions/link-actions";
import { faviconUrl, linkHost, linkLabel } from "../lib/link-display";
import { useTaskLinks } from "../queries/use-task-queries";
import { useTaskView } from "./task-view-context";

/**
 * The links attached to a task, under its description: favicon, title (or host
 * and a short path) and host, oldest first. Anyone who can edit the task can
 * add, change and remove them. The browser fetches the icons; the server never
 * visits a linked page.
 */
export function TaskLinks({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { can, frozen } = useTaskView();
  const links = useTaskLinks(task.id);
  const editable = can.edit && !frozen;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (links.length === 0 && !editable) return null;

  return (
    <section aria-label={t("links.title")} className="space-y-1.5">
      <h2 className="text-xs font-medium text-muted-foreground">
        {t("links.title")}
      </h2>
      {links.length > 0 ? (
        <ul className="space-y-0.5">
          {links.map((link) =>
            editingId === link.id ? (
              <li key={link.id}>
                <LinkForm
                  initial={link}
                  existing={links}
                  onSubmit={(value) => editLink(link.id, value)}
                  onClose={() => setEditingId(null)}
                />
              </li>
            ) : (
              <LinkRow
                key={link.id}
                link={link}
                editable={editable}
                onEdit={() => setEditingId(link.id)}
              />
            ),
          )}
        </ul>
      ) : null}
      {editable ? (
        adding ? (
          <LinkForm
            existing={links}
            onSubmit={(value) => addLink(task, value)}
            onClose={() => setAdding(false)}
          />
        ) : (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => setAdding(true)}
          >
            <Plus aria-hidden="true" />
            {t("links.add")}
          </Button>
        )
      ) : null}
    </section>
  );
}

function LinkRow({
  link,
  editable,
  onEdit,
}: {
  link: TaskLinkRow;
  editable: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation("tasks");

  async function remove() {
    try {
      await removeLink(link.id);
    } catch (error) {
      toast.error(errorMessage(t, error, t("links.error")));
    }
  }

  return (
    <li className="group flex items-center gap-1 rounded-md hover:bg-accent/40">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Favicon url={link.url} />
        <span className="truncate">{linkLabel(link.url, link.title)}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {linkHost(link.url)}
        </span>
      </a>
      {editable ? (
        <span className="flex shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("links.edit")}
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("links.remove")}
            onClick={() => void remove()}
          >
            <X aria-hidden="true" />
          </Button>
        </span>
      ) : null}
    </li>
  );
}

/** The site's own icon; a globe when it has none or it will not load. */
function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(url);
  if (!src || failed) {
    return (
      <Globe
        aria-hidden="true"
        data-testid="link-globe"
        className="size-4 shrink-0 text-muted-foreground"
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      referrerPolicy="no-referrer"
      loading="lazy"
      className="size-4 shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}

function LinkForm({
  initial,
  existing,
  onSubmit,
  onClose,
}: {
  initial?: TaskLinkRow;
  existing: readonly TaskLinkRow[];
  onSubmit: (value: { url: string; title: string | null }) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation("tasks");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [invalid, setInvalid] = useState(false);

  async function submit() {
    const address = url.trim();
    if (!isHttpUrl(address)) {
      setInvalid(true);
      return;
    }
    const value = { url: address, title: title.trim() || null };
    // A URL the task already has is not added twice.
    const taken = existing.some(
      (link) => link.url === address && link.id !== initial?.id,
    );
    onClose();
    if (taken) return;
    try {
      await onSubmit(value);
    } catch (error) {
      toast.error(errorMessage(t, error, t("links.error")));
    }
  }

  return (
    <form
      className="space-y-1.5 rounded-lg border bg-card p-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // Only the form closes; the sheet and the page stay.
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <Input
        autoFocus
        size="sm"
        value={url}
        maxLength={LINK_URL_MAX}
        placeholder={t("links.urlPlaceholder")}
        aria-label={t("links.url")}
        aria-invalid={invalid}
        onChange={(event) => {
          setUrl(event.target.value);
          setInvalid(false);
        }}
      />
      {invalid ? (
        <p role="alert" className="text-destructive text-xs">
          {t("links.invalid")}
        </p>
      ) : null}
      <Input
        size="sm"
        value={title}
        maxLength={LINK_TITLE_MAX}
        placeholder={t("links.titlePlaceholder")}
        aria-label={t("links.titleLabel")}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="xs" onClick={onClose}>
          {t("common:actions.cancel")}
        </Button>
        <Button type="submit" size="xs">
          {initial ? t("links.save") : t("links.add")}
        </Button>
      </div>
    </form>
  );
}
