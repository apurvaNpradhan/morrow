import { Link } from "@tanstack/react-router";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardTrigger,
} from "@/design-system/ui/preview-card";
import { useTicketLookup } from "../queries/use-ticket-lookup";
import { TicketReferencePreview } from "./ticket-reference-preview";
import { useTicketWorkspace } from "./ticket-workspace-context";

/**
 * A ticket id that names a task of this Workspace: a link to the task, with a
 * preview on hover. Any other id, or one outside a Workspace, is the plain text.
 * In an editable field a click places the cursor instead of leaving the page.
 */
export function TicketReferenceView({ node, editor }: NodeViewProps) {
  const ticketId = String(node.attrs.ticketId);
  const workspace = useTicketWorkspace();
  const lookup = useTicketLookup(workspace?.id, ticketId);

  return (
    <NodeViewWrapper as="span">
      {workspace && lookup ? (
        <PreviewCard>
          <PreviewCardTrigger
            render={
              <Link
                to="/$slug/tasks/$ticketId"
                params={{ slug: workspace.slug, ticketId }}
                className="rounded-sm text-primary underline decoration-primary/40 underline-offset-2 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(event) => {
                  if (editor.isEditable) event.preventDefault();
                }}
              />
            }
          >
            {ticketId}
          </PreviewCardTrigger>
          <PreviewCardPopup>
            <TicketReferencePreview task={lookup.task} ticketId={ticketId} />
          </PreviewCardPopup>
        </PreviewCard>
      ) : (
        ticketId
      )}
    </NodeViewWrapper>
  );
}
