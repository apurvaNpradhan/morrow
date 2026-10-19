import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";

/** A name box and an Add button for the settings lists that grow by one named row. */
export function AddNameForm({
  placeholder,
  addLabel,
  errorFallback,
  onAdd,
}: {
  placeholder: string;
  addLabel: string;
  errorFallback: string;
  onAdd: (name: string) => Promise<unknown>;
}) {
  const { t } = useTranslation("projects");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await onAdd(trimmed);
      setName("");
    } catch (error) {
      toast.error(errorMessage(t, error, errorFallback));
    } finally {
      setAdding(false);
    }
  }

  return (
    <form onSubmit={add} className="flex items-center gap-2 px-3 py-2">
      <Input
        size="sm"
        className="min-w-0 flex-1"
        aria-label={placeholder}
        placeholder={placeholder}
        maxLength={50}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={!name.trim() || adding}
      >
        <Plus aria-hidden="true" />
        {addLabel}
      </Button>
    </form>
  );
}
