import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type PlaceholderMeta =
  | { add: { id: string; pos: number; element: HTMLElement } }
  | { remove: { id: string } };

const key = new PluginKey<DecorationSet>("uploadPlaceholders");

/**
 * The marker shown where a file is uploading: its name and a progress bar. It
 * is a decoration, not part of the document, so it never reaches the markdown
 * or an autosave, and it moves with the text around it.
 */
export function uploadPlaceholders() {
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        const mapped = set.map(tr.mapping, tr.doc);
        const meta = tr.getMeta(key) as PlaceholderMeta | undefined;
        if (!meta) return mapped;
        if ("add" in meta) {
          return mapped.add(tr.doc, [
            Decoration.widget(meta.add.pos, meta.add.element, {
              id: meta.add.id,
              key: meta.add.id,
            }),
          ]);
        }
        return mapped.remove(
          mapped.find(
            undefined,
            undefined,
            (spec) => spec.id === meta.remove.id,
          ),
        );
      },
    },
    props: {
      decorations: (state) => key.getState(state),
    },
  });
}

/** The placeholder's element: the file name above a bar that `setProgress` fills. */
export function createPlaceholderElement(filename: string, label: string) {
  const element = document.createElement("div");
  element.className = "morrow-upload-placeholder";
  element.contentEditable = "false";
  element.setAttribute("role", "progressbar");
  element.setAttribute("aria-label", label);
  element.setAttribute("aria-valuemin", "0");
  element.setAttribute("aria-valuemax", "100");
  element.setAttribute("aria-valuenow", "0");
  const name = document.createElement("span");
  name.className = "morrow-upload-placeholder-name";
  name.textContent = filename;
  const bar = document.createElement("span");
  bar.className = "morrow-upload-placeholder-bar";
  const fill = document.createElement("span");
  fill.className = "morrow-upload-placeholder-fill";
  fill.style.width = "0%";
  bar.append(fill);
  element.append(name, bar);
  return {
    element,
    setProgress(fraction: number) {
      const percent = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
      fill.style.width = `${percent}%`;
      element.setAttribute("aria-valuenow", String(percent));
    },
  };
}

export const placeholders = {
  add: (id: string, pos: number, element: HTMLElement): PlaceholderMeta => ({
    add: { id, pos, element },
  }),
  remove: (id: string): PlaceholderMeta => ({ remove: { id } }),
  key,
  /** Where the placeholder is now, or null once it is gone. */
  find(state: Parameters<typeof key.getState>[0], id: string) {
    const [found] =
      key
        .getState(state)
        ?.find(undefined, undefined, (spec) => spec.id === id) ?? [];
    return found?.from ?? null;
  },
};
