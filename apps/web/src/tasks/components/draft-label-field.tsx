import { Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import { LabelChips, labelsOfTask, useLabels } from "@/labels";
import { useWorkspacePermission } from "@/workspace";
import { LabelPickerList } from "./label-picker-list";

/** The create dialog's label chip: the labels chosen so far, and a picker to change them. */
export function DraftLabelField({
  workspaceId,
  labelIds,
  onChange,
}: {
  workspaceId: string;
  labelIds: readonly string[];
  onChange: (labelIds: string[]) => void;
}) {
  const { t } = useTranslation("tasks");
  const permission = useWorkspacePermission();
  const { labels, labelById } = useLabels(workspaceId);
  const chosen = labelsOfTask(labelIds, labelById);

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("fields.labels")}
        className="inline-flex min-h-7 max-w-full cursor-pointer flex-wrap items-center gap-1 rounded-md border bg-control px-2 py-1 text-xs outline-none hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring"
      >
        {chosen.length > 0 ? (
          <LabelChips labels={chosen} max={3} />
        ) : (
          <>
            <Tag aria-hidden="true" className="size-3.5" />
            {t("fields.labels")}
          </>
        )}
      </PopoverTrigger>
      <PopoverPopup>
        <LabelPickerList
          workspaceId={workspaceId}
          labels={labels}
          selected={labelIds}
          canCreate={permission.canCreateLabels()}
          onToggle={(labelId) =>
            onChange(
              labelIds.includes(labelId)
                ? labelIds.filter((id) => id !== labelId)
                : [...labelIds, labelId],
            )
          }
        />
      </PopoverPopup>
    </Popover>
  );
}
