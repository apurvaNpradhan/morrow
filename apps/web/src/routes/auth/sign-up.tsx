import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import {
  AuthCaptcha,
  AuthDivider,
  AuthLayout,
  AuthLegalFooter,
  AuthToggle,
  OtpSignInForm,
  REGISTRATION_STATUS_QUERY_KEY,
  SSOProviders,
  useAuthCaptcha,
  useRegistrationStatus,
} from "@/auth";
import { PageTitle } from "@/design-system/page-title";
import { Alert, AlertDescription } from "@/design-system/ui/alert";
import { rpc } from "@/app/lib/orpc";

const signUpSearchSchema = z.object({
  invitationId: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
  validateSearch: signUpSearchSchema,
  loader: ({ context }) =>
    context.queryClient.prefetchQuery({
      queryKey: REGISTRATION_STATUS_QUERY_KEY,
      queryFn: () => rpc.auth.registrationStatus(),
    }),
});

function SignUp() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/auth/sign-up" });
  const captcha = useAuthCaptcha();
  const { data: registration } = useRegistrationStatus();

  const invitationId = search.invitationId;
  // Closed registration still lets an invited address through.
  const isClosed = registration?.open === false && !invitationId;

  const baseUrl = window.location.origin;
  const callbackURL = invitationId
    ? `${baseUrl}/invitation/accept/${invitationId}`
    : `${baseUrl}/`;

  return (
    <>
      <PageTitle title={t("auth:signUp.pageTitle")} />
      <AuthLayout
        title={t("auth:signUp.title")}
        subtitle={
          invitationId
            ? t("auth:signUp.subtitleInvitation")
            : isClosed
              ? t("auth:signUp.subtitleRegistrationDisabled")
              : t("auth:signUp.subtitleDefault")
        }
        notice={
          invitationId || isClosed ? (
            <Alert>
              <AlertDescription>
                {invitationId
                  ? t("auth:signUp.invitationAlert")
                  : t("auth:signUp.registrationDisabledAlert")}
              </AlertDescription>
            </Alert>
          ) : null
        }
        footer={
          <AuthLegalFooter>
            {isClosed ? null : t("auth:signUp.footer")}
          </AuthLegalFooter>
        }
      >
        <div className="space-y-4">
          {isClosed ? null : (
            <>
              <AuthCaptcha captcha={captcha} />
              <SSOProviders
                callbackURL={callbackURL}
                errorCallbackURL={`${baseUrl}/auth/sign-up`}
                disabled={captcha.pending}
                turnstileToken={captcha.token}
                onAttemptComplete={captcha.reset}
              />
              <AuthDivider />
              <OtpSignInForm
                invitationId={invitationId}
                defaultEmail={search.email}
                turnstileToken={captcha.token}
                onAttemptComplete={captcha.reset}
              />
            </>
          )}
          <AuthToggle
            message={t("auth:signUp.toggleMessage")}
            linkText={t("auth:signUp.toggleLink")}
            linkTo="/auth/sign-in"
          />
        </div>
      </AuthLayout>
    </>
  );
}
