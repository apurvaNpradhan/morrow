import { useRef, useState } from "react";
import { Input, type InputProps } from "@/design-system/ui/input";

type BlurSaveInputProps = Omit<InputProps, "value" | "onChange" | "onBlur"> & {
  value: string;
  /** Called with the trimmed text when the field loses focus with a changed, acceptable value. */
  onCommit: (value: string) => void | Promise<unknown>;
  /** Whether a changed value may be saved; an empty name, say. Defaults to non-empty. */
  isAcceptable?: (value: string) => boolean;
};

/**
 * A text field that saves when it loses focus instead of on every keystroke
 * or behind a save button. Escape puts back the saved text; a value that is
 * not accepted is put back on blur rather than saved.
 */
export function BlurSaveInput({
  value,
  onCommit,
  isAcceptable = (text) => text.length > 0,
  ...props
}: BlurSaveInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const text = draft ?? value;

  async function commit() {
    const next = text.trim();
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (next === value || !isAcceptable(next)) return;
    await onCommit(next);
  }

  return (
    <Input
      {...props}
      value={text}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancelled.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
}
