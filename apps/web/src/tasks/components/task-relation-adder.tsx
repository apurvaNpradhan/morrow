import type { RelationKind, TaskRow } from "@morrow/sync-schemas";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import { addRelation } from "../actions/relation-actions";
import { relationChoices } from "../lib/picker-choices";
import {
  RELATION_KINDS,
  relationBetween,
  typeOfKind,
} from "../lib/relation-kinds";
import type { useTaskRelations } from "../queries/use-task-queries";
import { TaskPicker } from "./task-picker";
import { useTaskView } from "./task-view-context";

/**
 * Adds a relation: first how this task stands to the other, then which task.
 * The picker searches the whole Workspace except this task and the tasks it is
 * already linked to with that type.
 */
export function TaskRelationAdder({
  task,
  relations,
}: {
  task: TaskRow;
  relations: ReturnType<typeof useTaskRelations>;
}) {
  const { t } = useTranslation("tasks");
  const { workspace, meId } = useTaskView();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RelationKind | null>(null);

  async function add(kindChosen: RelationKind, otherId: string) {
    setOpen(false);
    try {
      await addRelation({
        workspaceId: workspace.id,
        userId: meId,
        ...relationBetween(kindChosen, task.id, otherId),
      });
    } catch (error) {
      toast.error(errorMessage(t, error, t("relations.error")));
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setKind(null);
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="ghost" size="xs" className="text-muted-foreground" />
        }
      >
        <Plus aria-hidden="true" />
        {t("relations.add")}
      </PopoverTrigger>
      <PopoverPopup>
        {kind === null ? (
          <ul role="menu" aria-label={t("relations.add")} className="w-56 p-1">
            {RELATION_KINDS.map((candidate) => (
              <li key={candidate} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                  onClick={() => setKind(candidate)}
                >
                  {t(`relations.kinds.${candidate}`)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <TaskPicker
            workspaceId={workspace.id}
            label={t(`relations.kinds.${kind}`)}
            choose={(hits) =>
              relationChoices(hits, task, relations, typeOfKind(kind))
            }
            onPick={(hit) => void add(kind, hit.id)}
          />
        )}
      </PopoverPopup>
    </Popover>
  );
}
