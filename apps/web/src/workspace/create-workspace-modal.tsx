import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/design-system/ui/breadcrumb";
import { Button } from "@/design-system/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { Input } from "@/design-system/ui/input";
import { useWorkspaceSlugField } from "./slug/use-workspace-slug-field";
import { WorkspaceSlugField } from "./slug/workspace-slug-field";
import { useCreateWorkspace } from "./queries/use-create-workspace";
import { useWorkspaceCreationStatus } from "./queries/use-workspace-creation-status";
import { setActiveWorkspace } from "./routing/lib/set-active-workspace";
import { toast } from "@/design-system/toast";
import { SlugUnavailableError } from "./routing/lib/workspace-slug-error";
import { errorMessage } from "@/app/lib/error-message";

type CreateWorkspaceModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateWorkspaceModal({
  open,
  onClose,
}: CreateWorkspaceModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const slugField = useWorkspaceSlugField({ name });
  const [lostSlug, setLostSlug] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { mutateAsync } = useCreateWorkspace();
  const { data: creationStatus } = useWorkspaceCreationStatus(open);
  const isLimitReached = creationStatus?.reason === "limit";
  const slugStatus = lostSlug === slugField.slug ? "taken" : slugField.status;
  const canSubmit =
    name.trim() !== "" &&
    !isLimitReached &&
    lostSlug !== slugField.slug &&
    slugField.isUsable;

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleClose = () => {
    setName("");
    setDescription("");
    setLostSlug(null);
    slugField.reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      const createdWorkspace = await mutateAsync({
        name: name.trim(),
        slug: slugField.slug,
        description,
      });
      toast.success(t("common:modals.createWorkspace.successToast"));
      await setActiveWorkspace(createdWorkspace.id);

      navigate({
        to: "/$slug",
        params: { slug: createdWorkspace.slug },
      });

      handleClose();
    } catch (error) {
      if (error instanceof SlugUnavailableError) {
        setLostSlug(slugField.slug);
        return;
      }
      toast.error(
        errorMessage(t, error, t("common:modals.createWorkspace.errorToast")),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle asChild>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="text-muted-foreground font-semibold tracking-wider text-sm">
                  {t("common:modals.createWorkspace.breadcrumbMorrow")}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="text-foreground font-medium text-sm">
                  {t("common:modals.createWorkspace.title")}
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("common:modals.createWorkspace.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 px-6">
            <Input
              ref={inputRef}
              unstyled
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common:modals.createWorkspace.namePlaceholder")}
              className="w-full [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-2 [&_[data-slot=input]]:text-2xl [&_[data-slot=input]]:leading-tight [&_[data-slot=input]]:font-semibold [&_[data-slot=input]]:tracking-tight [&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:placeholder:text-muted-foreground [&_[data-slot=input]]:outline-none"
              required
            />

            <Input
              unstyled
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                "common:modals.createWorkspace.descriptionPlaceholder",
              )}
              className="w-full [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-2 [&_[data-slot=input]]:text-base [&_[data-slot=input]]:leading-relaxed [&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:placeholder:text-muted-foreground [&_[data-slot=input]]:outline-none"
            />
            <WorkspaceSlugField
              value={slugField.slug}
              status={slugStatus}
              onChange={slugField.setSlug}
            />
          </div>

          {isLimitReached && (
            <p role="alert" className="px-6 text-sm text-destructive">
              {t("common:modals.createWorkspace.limitReached", {
                limit: creationStatus?.limit,
              })}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              size="sm"
              className="border-border text-foreground hover:bg-accent"
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              size="sm"
              className="disabled:opacity-50"
            >
              {t("common:modals.createWorkspace.createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
