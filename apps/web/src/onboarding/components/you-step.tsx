import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { useUpdateUserProfile } from "@/account";
import { toast } from "@/design-system/toast";
import { OnboardingShell } from "./onboarding-shell";
import { errorMessage } from "@/app/lib/error-message";

type YouStepProps = {
  /** The name already on the account, e.g. from a sign-in provider. */
  initialName: string;
  /** Shown as a placeholder, never as a value, so it prompts a real name. */
  emailLocalPart: string;
  /** True for someone who already joined a workspace: this is their only step. */
  isSingleStep: boolean;
  onBack?: () => void;
  onDone: () => void | Promise<void>;
};

export function YouStep({
  initialName,
  emailLocalPart,
  isSingleStep,
  onBack,
  onDone,
}: YouStepProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const { mutateAsync: updateProfile, isPending } = useUpdateUserProfile();
  const [isFinishing, setIsFinishing] = useState(false);
  const trimmed = name.trim();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    try {
      if (trimmed !== initialName.trim()) {
        await updateProfile({ name: trimmed });
      }
      setIsFinishing(true);
      await onDone();
    } catch (error) {
      setIsFinishing(false);
      toast.error(errorMessage(t, error, t("auth:onboarding.you.failed")));
    }
  };

  return (
    <OnboardingShell
      title={t("auth:onboarding.you.title")}
      subtitle={t("auth:onboarding.you.subtitle")}
      segments={isSingleStep ? 0 : 3}
      current={1}
      onBack={onBack}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label
            htmlFor="onboarding-name"
            className="text-sm font-normal text-muted-foreground"
          >
            {t("auth:onboarding.you.nameLabel")}
          </Label>
          <Input
            id="onboarding-name"
            autoFocus
            autoComplete="name"
            size="lg"
            className="rounded-xl"
            value={name}
            placeholder={emailLocalPart}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!trimmed || isPending || isFinishing}
        >
          {t("auth:onboarding.continue")}
        </Button>
      </form>
    </OnboardingShell>
  );
}
