import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GithubIcon } from "@/design-system/icons/github-icon";
import { Button } from "@/design-system/ui/button";
import { authClient } from "@/auth/lib/auth-client";
import { cn } from "@/design-system/cn";
import { toast } from "@/design-system/toast";
import { errorMessage } from "@/app/lib/error-message";

type Props = {
  callbackURL: string;
  errorCallbackURL: string;
  lastLoginMethod?: string | null;
  disabled?: boolean;
  turnstileToken?: string | null;
  onAttemptComplete?: () => void;
};

export function SSOProviders({
  callbackURL,
  errorCallbackURL,
  lastLoginMethod,
  disabled = false,
  turnstileToken,
  onAttemptComplete,
}: Props) {
  const { t } = useTranslation();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSocial = async (
    provider: "google" | "github",
    errorKey: string,
  ) => {
    if (disabled) return;
    setLoadingProvider(provider);
    try {
      const result = await authClient.signIn.social(
        {
          provider,
          callbackURL,
          errorCallbackURL,
        },
        {
          headers: turnstileToken
            ? { "x-turnstile-token": turnstileToken }
            : undefined,
        },
      );
      if (result.error) throw new Error(result.error.message);
    } catch (error) {
      toast.error(errorMessage(t, error, t(errorKey)));
    } finally {
      setLoadingProvider(null);
      onAttemptComplete?.();
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ProviderButton
        providerId="google"
        disabled={disabled}
        isLoading={loadingProvider === "google"}
        isLastUsed={lastLoginMethod === "google"}
        onClick={() => handleSocial("google", "auth:signIn.googleError")}
        label={t("auth:providers.google")}
        accessibleLabel={t("auth:signIn.continueWithGoogle")}
        loadingLabel={t("auth:signIn.signingIn")}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="w-5 h-5 mr-2"
            aria-label={t("auth:providers.google")}
          >
            <title>Google</title>
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
        }
      />
      <ProviderButton
        providerId="github"
        disabled={disabled}
        isLoading={loadingProvider === "github"}
        isLastUsed={lastLoginMethod === "github"}
        onClick={() => handleSocial("github", "auth:signIn.githubError")}
        label={t("auth:providers.github")}
        accessibleLabel={t("auth:signIn.continueWithGithub")}
        loadingLabel={t("auth:signIn.signingIn")}
        icon={<GithubIcon className="w-5 h-5 mr-2" />}
      />
    </div>
  );
}

function ProviderButton({
  providerId,
  icon,
  label,
  accessibleLabel,
  loadingLabel,
  isLoading,
  isLastUsed,
  onClick,
  disabled = false,
}: {
  providerId: string;
  icon: React.ReactNode;
  label: string;
  accessibleLabel: string;
  loadingLabel: string;
  isLoading: boolean;
  isLastUsed: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={onClick}
        disabled={isLoading || disabled}
        className={cn("w-full", isLastUsed && "border-primary/50!")}
        data-provider={providerId}
        aria-label={isLoading ? loadingLabel : accessibleLabel}
      >
        {icon}
        {isLoading ? loadingLabel : label}
      </Button>
      {isLastUsed && (
        <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
          {t("auth:signIn.lastUsed")}
        </span>
      )}
    </div>
  );
}
