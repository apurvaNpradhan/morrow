import {
  closeOverlay,
  CommandHotkeys,
  useCommands,
  useIsOverlayOpen,
} from "@/app/commands";
import { CommandDialog, CommandDialogPopup } from "@/design-system/ui/command";
import { InviteTeamMemberModal } from "@/members";
import { CreateProjectDialog } from "@/projects";
import { CreateWorkspaceModal, useActiveWorkspace } from "@/workspace";
import { PaletteContent } from "./palette-content";

/** Always mounted: binds the hotkeys and hosts the overlays commands open. */
export function CommandPalette() {
  const { data: workspace } = useActiveWorkspace();
  const commands = useCommands();
  const open = useIsOverlayOpen("palette");
  const createWorkspaceOpen = useIsOverlayOpen("createWorkspace");
  const createProjectOpen = useIsOverlayOpen("createProject");
  const inviteMemberOpen = useIsOverlayOpen("inviteMember");

  return (
    <>
      <CommandHotkeys commands={commands} />
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeOverlay("palette");
        }}
      >
        <CommandDialogPopup instant>
          <PaletteContent commands={commands} />
        </CommandDialogPopup>
      </CommandDialog>

      <CreateWorkspaceModal
        open={createWorkspaceOpen}
        onClose={() => closeOverlay("createWorkspace")}
      />
      {workspace ? (
        <CreateProjectDialog
          workspace={workspace}
          open={createProjectOpen}
          onOpenChange={(next) => {
            if (!next) closeOverlay("createProject");
          }}
        />
      ) : null}
      <InviteTeamMemberModal
        open={inviteMemberOpen}
        onClose={() => closeOverlay("inviteMember")}
      />
    </>
  );
}
