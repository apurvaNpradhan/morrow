import { getSafeRedirect } from "@/onboarding";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import {
  AuthCaptcha,
  AuthDivider,
  AuthLayout,
  AuthLegalFooter,
  AuthToggle,
  OtpSignInForm,
  SignInFormSkeleton,
  SSOProviders,
  authClient,
  useAuthCaptcha,
  useRegistrationStatus,
} from "@/auth";
import { PageTitle } from "@/design-system/page-title";
import { Alert, AlertDescription } from "@/design-system/ui/alert";

const signInSearchSchema = z.object({
  invitationId: z.string().optional(),
  email: z.string().optional(),
  redirect: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
  validateSearch: signInSearchSchema,
});

function SignIn() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/auth/sign-in" });
  const captcha = useAuthCaptcha();
  const lastLoginMethod = authClient.getLastUsedLoginMethod();
  const { data: registration, isLoading: isStatusLoading } =
    useRegistrationStatus();

  const invitationId = search.invitationId;

  const getSafeRedirectPath = useCallback(
    () => getSafeRedirect(search.redirect),
    [search.redirect],
  );

  const callbackURL = (() => {
    const baseUrl = window.location.origin;
    const redirectPath = getSafeRedirectPath();
    if (redirectPath) return `${baseUrl}${redirectPath}`;
    if (invitationId) return `${baseUrl}/invitation/accept/${invitationId}`;
    return `${baseUrl}/`;
  })();

  if (isStatusLoading) {
    return (
      <>
        <PageTitle title={t("auth:signIn.pageTitle")} />
        <AuthLayout
          title={t("auth:signIn.title")}
          subtitle={t("auth:signIn.subtitle")}
        >
          <SignInFormSkeleton />
        </AuthLayout>
      </>
    );
  }

  const errorText = search.error
    ? t(
        `auth:signIn.errors.${search.error.replace(/[._]+/g, "_").toLowerCase()}`,
        {
          defaultValue: "",
        },
      ) || search.error.replace(/_/g, " ")
    : null;

  const registrationClosed = registration?.open === false;

  return (
    <>
      <PageTitle title={t("auth:signIn.pageTitle")} />
      <AuthLayout
        title={t("auth:signIn.title")}
        subtitle={
          invitationId
            ? t("auth:signIn.invitationSubtitle")
            : t("auth:signIn.subtitle")
        }
        notice={
          errorText || invitationId ? (
            <div className="space-y-3">
              {errorText ? (
                <Alert variant="error">
                  <AlertDescription>{errorText}</AlertDescription>
                </Alert>
              ) : null}
              {invitationId ? (
                <Alert>
                  <AlertDescription>
                    {t("auth:signIn.invitationAlert")}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null
        }
        footer={
          <AuthLegalFooter>
            {registrationClosed
              ? t("auth:signIn.registrationDisabled")
              : t("auth:signIn.footerOpen")}
          </AuthLegalFooter>
        }
      >
        <div className="space-y-4">
          <AuthCaptcha captcha={captcha} />
          <SSOProviders
            callbackURL={callbackURL}
            errorCallbackURL={`${window.location.origin}/auth/sign-in`}
            lastLoginMethod={lastLoginMethod}
            disabled={captcha.pending}
            turnstileToken={captcha.token}
            onAttemptComplete={captcha.reset}
          />
          <AuthDivider />
          <OtpSignInForm
            turnstileToken={captcha.token}
            onAttemptComplete={captcha.reset}
            invitationId={invitationId}
            defaultEmail={search.email}
            redirect={getSafeRedirectPath()}
          />
          {registrationClosed ? null : (
            <AuthToggle
              message={t("auth:signIn.toggleMessage")}
              linkText={t("auth:signIn.toggleLink")}
              linkTo="/auth/sign-up"
            />
          )}
        </div>
      </AuthLayout>
    </>
  );
}
