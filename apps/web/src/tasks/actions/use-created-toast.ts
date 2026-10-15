import { ticketId } from "@morrow/sync-schemas";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/design-system/toast";
import { useActiveWorkspace } from "@/workspace";

/** "MOR-12 created", with an action that opens the task. */
export function useCreatedToast() {
  const { t } = useTranslation("tasks");
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  const slug = workspace?.slug;

  return useCallback(
    (projectKey: string, number: number) => {
      const id = ticketId(projectKey, number);
      toast.success(t("toast.created", { id }), {
        action: slug
          ? {
              label: t("toast.open"),
              onClick: () =>
                void navigate({
                  to: "/$slug/tasks/$ticketId",
                  params: { slug, ticketId: id },
                }),
            }
          : undefined,
      });
    },
    [t, navigate, slug],
  );
}
