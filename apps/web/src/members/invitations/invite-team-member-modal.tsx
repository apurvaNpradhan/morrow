import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { useInviteWorkspaceUser } from "./queries/use-invite-workspace-user";
import { useActiveWorkspace } from "@/workspace";
import { useWorkspacePermission } from "@/workspace";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/design-system/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/design-system/ui/form";
import { Input } from "@/design-system/ui/input";
import { InvitationLinkField } from "./invitation-link-field";
import { errorMessage } from "@/app/lib/error-message";

type Props = {
  open: boolean;
  onClose: () => void;
};

const inviteMemberSchema = z.object({ email: z.string() });
type InviteMemberValues = z.infer<typeof inviteMemberSchema>;

export function InviteTeamMemberModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { mutateAsync } = useInviteWorkspaceUser();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const { canInviteUsers } = useWorkspacePermission();
  const [createdInvitation, setCreatedInvitation] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const form = useForm<InviteMemberValues>({
    resolver: standardSchemaResolver(inviteMemberSchema),
    defaultValues: { email: "" },
  });

  const closeModal = () => {
    onClose();
  };

  const onSubmit = async ({ email }: InviteMemberValues) => {
    if (!workspaceId || !canInviteUsers()) {
      toast.error(t("team:inviteModal.error"));
      return;
    }
    try {
      const invitation = await mutateAsync({
        email,
        workspaceId,
        role: "member",
      });
      toast.success(t("team:inviteModal.success"));
      if (invitation?.id) {
        setCreatedInvitation({ id: invitation.id, email });
        form.reset();
      } else {
        closeModal();
      }
    } catch (error) {
      toast.error(errorMessage(t, error, t("team:inviteModal.error")));
    }
  };

  const resetAfterClose = (isOpen: boolean) => {
    if (isOpen) return;
    setCreatedInvitation(null);
    form.reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeModal();
      }}
      onOpenChangeComplete={resetAfterClose}
    >
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdInvitation
              ? t("team:inviteModal.createdTitle")
              : t("team:inviteModal.title")}
          </DialogTitle>
        </DialogHeader>
        {createdInvitation ? (
          <>
            <DialogPanel className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("team:inviteModal.shareLinkDescription", {
                  email: createdInvitation.email,
                })}
              </p>
              <InvitationLinkField invitationId={createdInvitation.id} />
            </DialogPanel>
            <DialogFooter>
              <Button size="sm" onClick={closeModal}>
                {t("team:inviteModal.done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
              <DialogPanel className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("team:inviteModal.emailLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("team:inviteModal.emailPlaceholder")}
                          autoFocus
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </DialogPanel>
              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline" size="sm" type="button" />}
                >
                  {t("common:actions.cancel")}
                </DialogClose>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!workspaceId || !canInviteUsers()}
                >
                  {t("team:inviteModal.sendInvitation")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
