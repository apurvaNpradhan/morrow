import { useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkspaceSlugField } from "@/workspace";
import { useWorkspaceSlugField } from "@/workspace";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { useCreateWorkspace } from "@/workspace";
import { toast } from "@/design-system/toast";
import { SlugUnavailableError } from "@/workspace";
import { errorMessage } from "@/app/lib/error-message";

type CreatedWorkspace = { id: string; slug: string; name: string };

type CreateWorkspaceFormProps = {
  onCreated: (workspace: CreatedWorkspace) => void | Promise<void>;
  autoFocus?: boolean;
};

/** Name, URL slug and preview for a new workspace. */
export function CreateWorkspaceForm({
  onCreated,
  autoFocus = true,
}: CreateWorkspaceFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const field = useWorkspaceSlugField({ name });
  const { mutateAsync: createWorkspace, isPending } = useCreateWorkspace();
  // A slug lost to a concurrent create is reported as taken until it changes.
  const [lost, setLost] = useState<{
    slug: string;
    reason: "taken" | "reserved" | "invalid";
  } | null>(null);
  const status = lost?.slug === field.slug ? lost.reason : field.status;
  const canSubmit =
    name.trim() !== "" && (lost?.slug === field.slug ? false : field.isUsable);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || isPending) return;
    try {
      const workspace = await createWorkspace({
        name: name.trim(),
        slug: field.slug,
      });
      await onCreated({
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
      });
    } catch (error) {
      if (error instanceof SlugUnavailableError) {
        setLost({ slug: field.slug, reason: error.reason });
        return;
      }
      toast.error(
        errorMessage(t, error, t("auth:onboarding.workspace.createFailed")),
      );
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label
          htmlFor="onboarding-workspace-name"
          className="text-sm font-normal text-muted-foreground"
        >
          {t("auth:onboarding.workspace.nameLabel")}
        </Label>
        <Input
          id="onboarding-workspace-name"
          autoFocus={autoFocus}
          autoComplete="organization"
          size="lg"
          className="rounded-xl"
          value={name}
          placeholder={t("auth:onboarding.workspace.namePlaceholder")}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <WorkspaceSlugField
        value={field.slug}
        status={status}
        onChange={field.setSlug}
      />
      <Button
        type="submit"
        className="w-full"
        disabled={!canSubmit || isPending}
      >
        {t("auth:onboarding.continue")}
      </Button>
    </form>
  );
}
