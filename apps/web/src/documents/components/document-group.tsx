import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/design-system/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/design-system/ui/sidebar";
import { useWorkspacePermission } from "@/workspace";
import { createDocument } from "../actions/document-actions";
import type { TreeScope } from "../lib/document-tree";
import { DocumentTree } from "./document-tree";

/**
 * A sidebar group holding one scope's page tree, folded by its label, with a
 * button that adds a page at the top level of the scope.
 */
export function DocumentGroup({
  workspace,
  scope,
  title,
  activeId,
  icon,
}: {
  workspace: { id: string; slug: string };
  scope: TreeScope;
  title: string;
  activeId: string | null;
  icon?: ReactNode;
}) {
  const { t } = useTranslation("documents");
  const navigate = useNavigate();
  const { canCreateDocuments } = useWorkspacePermission();
  const [open, setOpen] = useState(true);

  async function addPage() {
    try {
      const page = await createDocument({
        workspaceId: workspace.id,
        projectId: scope.projectId,
        parentId: null,
      });
      void navigate({
        to: "/$slug/pages/$documentId",
        params: { slug: workspace.slug, documentId: page.id },
      });
    } catch (error) {
      toast.error(errorMessage(t, error, t("tree.createError")));
    }
  }

  return (
    <SidebarGroup className="gap-1 p-2 pt-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <SidebarGroupLabel
          render={
            <CollapsibleTrigger className="group/pages w-full cursor-pointer gap-1 hover:text-sidebar-accent-foreground" />
          }
        >
          {icon}
          <span className="truncate">{title}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 transition-transform duration-150 group-not-data-[panel-open]/pages:-rotate-90 motion-reduce:transition-none"
          />
        </SidebarGroupLabel>
        {canCreateDocuments() ? (
          <SidebarGroupAction
            aria-label={t("tree.add", { name: title })}
            title={t("tree.add", { name: title })}
            onClick={() => void addPage()}
          >
            <Plus aria-hidden="true" />
          </SidebarGroupAction>
        ) : null}
        <CollapsiblePanel>
          <SidebarGroupContent>
            <DocumentTree
              workspace={workspace}
              scope={scope}
              activeId={activeId}
              className="max-h-72"
            />
          </SidebarGroupContent>
        </CollapsiblePanel>
      </Collapsible>
    </SidebarGroup>
  );
}
