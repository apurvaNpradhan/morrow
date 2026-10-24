import {
  FIELD_NAME_MAX,
  FIELD_TYPES,
  type FieldType,
} from "@morrow/sync-schemas";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";

/** A name box, a type and an Add button: the row that adds a custom Field. */
export function AddFieldForm({
  onAdd,
}: {
  onAdd: (field: { name: string; type: FieldType }) => Promise<unknown>;
}) {
  const { t } = useTranslation("projects");
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("single_choice");
  const [adding, setAdding] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await onAdd({ name: trimmed, type });
      setName("");
    } catch (error) {
      toast.error(errorMessage(t, error, t("fields.addFieldError")));
    } finally {
      setAdding(false);
    }
  }

  return (
    <form
      onSubmit={add}
      className="flex flex-wrap items-center gap-2 px-3 py-2"
    >
      <Input
        size="sm"
        className="min-w-40 flex-1"
        aria-label={t("fields.addFieldPlaceholder")}
        placeholder={t("fields.addFieldPlaceholder")}
        maxLength={FIELD_NAME_MAX}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Select
        value={type}
        onValueChange={(value) => {
          if (value) setType(value as FieldType);
        }}
      >
        <SelectTrigger
          size="sm"
          className="w-40"
          aria-label={t("fields.typeLabel")}
        >
          <SelectValue>{t(`fields.type.${type}`)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FIELD_TYPES.map((candidate) => (
            <SelectItem key={candidate} value={candidate}>
              {t(`fields.type.${candidate}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={!name.trim() || adding}
      >
        <Plus aria-hidden="true" />
        {t("fields.addField")}
      </Button>
    </form>
  );
}
