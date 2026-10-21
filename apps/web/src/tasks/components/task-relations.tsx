import { relationKind, type TaskRow } from "@morrow/sync-schemas";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { removeRelation } from "../actions/relation-actions";
import { RELATION_KINDS } from "../lib/relation-kinds";
import { useTaskRelations } from "../queries/use-task-queries";
import { useTaskSummaries } from "../queries/use-task-summaries";
import { LinkedTaskRow } from "./linked-task-row";
import { TaskRelationAdder } from "./task-relation-adder";
import { useTaskView } from "./task-view-context";

/**
 * The relations of a task in the properties rail, grouped as blocked by, blocks,
 * related, duplicate of and duplicated by, each row the other task's Column
 * marker and title. Relations to tasks of other Projects are listed too. Only
 * the groups that have a task show; the adder is always last for an editor.
 */
export function TaskRelations({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { workspace, can, frozen } = useTaskView();
  const relations = useTaskRelations(task.id);
  const summaries = useTaskSummaries(
    workspace.id,
    relations.map((relation) =>
      relation.sourceTaskId === task.id
        ? relation.targetTaskId
        : relation.sourceTaskId,
    ),
  );
  const editable = can.edit && !frozen;

  if (relations.length === 0 && !editable) return null;

  async function remove(relationId: string) {
    try {
      await removeRelation(relationId);
    } catch (error) {
      toast.error(errorMessage(t, error, t("relations.error")));
    }
  }

  return (
    <section
      aria-label={t("relations.title")}
      className="mt-3 space-y-2 @min-[720px]:w-full"
    >
      {RELATION_KINDS.map((kind) => {
        const ofKind = relations.filter(
          (relation) =>
            relationKind(
              relation.type,
              relation.sourceTaskId === task.id ? "outgoing" : "incoming",
            ) === kind,
        );
        if (ofKind.length === 0) return null;
        return (
          <div
            key={kind}
            role="group"
            aria-label={t(`relations.kinds.${kind}`)}
          >
            <h3 className="mb-0.5 px-2 text-xs font-medium text-muted-foreground">
              {t(`relations.kinds.${kind}`)}
            </h3>
            <ul className="space-y-0.5">
              {ofKind.map((relation) => {
                const otherId =
                  relation.sourceTaskId === task.id
                    ? relation.targetTaskId
                    : relation.sourceTaskId;
                const other = summaries.get(otherId);
                // The other task has not loaded yet.
                if (!other) return null;
                return (
                  <LinkedTaskRow
                    key={relation.id}
                    task={other.task}
                    ticketId={other.ticketId}
                    column={other.column}
                    compact
                    trailing={
                      editable ? (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t("relations.remove", {
                            id: other.ticketId,
                          })}
                          className="opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                          onClick={() => void remove(relation.id)}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      ) : null
                    }
                  />
                );
              })}
            </ul>
          </div>
        );
      })}
      {editable ? (
        <TaskRelationAdder task={task} relations={relations} />
      ) : null}
    </section>
  );
}
