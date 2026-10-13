import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AuthLayout, authClient } from "@/auth";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { Button } from "@/design-system/ui/button";

export const Route = createFileRoute("/mcp/authorize")({
  component: McpAuthorizePage,
});

// The OAuth server signs the whole query it redirects here with; it is sent
// back unchanged with the decision, never parsed or trusted by this page.
const signedQuery = () => window.location.search.slice(1);
const clientId = () =>
  new URLSearchParams(window.location.search).get("client_id");
/** Where the client asks to be sent back; shown by host so a lookalike is easy to spot. */
const redirectHost = () => {
  const target = new URLSearchParams(window.location.search).get(
    "redirect_uri",
  );
  if (!target) return null;
  try {
    const url = new URL(target);
    return url.host || url.protocol;
  } catch {
    return null;
  }
};

function McpAuthorizePage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const id = clientId();
  const client = useQuery({
    queryKey: ["oauth-client", id],
    enabled: Boolean(id),
    retry: false,
    queryFn: async () => {
      const { data, error } = await authClient.$fetch<{
        client_name?: string;
        name?: string;
      }>("/oauth2/public-client", { query: { client_id: id } });
      if (error) throw error;
      return data;
    },
  });
  const decision = useMutation({
    mutationFn: async (accept: boolean) => {
      const { data, error } = await authClient.$fetch<{ url: string }>(
        "/oauth2/consent",
        { method: "POST", body: { accept, oauth_query: signedQuery() } },
      );
      if (error || !data?.url) throw error ?? new Error("No redirect");
      return data.url;
    },
    onSuccess: (url) => window.location.assign(url),
  });
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  if (!id || client.isError) {
    return (
      <AuthLayout
        title={t("mcpAuthorize.failedTitle")}
        subtitle={t("mcpAuthorize.failedSubtitle")}
      >
        <p className="text-sm text-muted-foreground">
          {t("mcpAuthorize.failedHint")}
        </p>
      </AuthLayout>
    );
  }

  if (client.isLoading || isSessionPending) {
    return (
      <AuthLayout
        title={t("mcpAuthorize.title")}
        subtitle={t("mcpAuthorize.loadingSubtitle")}
      >
        <p className="text-sm text-muted-foreground">
          {t("mcpAuthorize.loadingHint")}
        </p>
      </AuthLayout>
    );
  }

  if (!session?.user) {
    return (
      <AuthLayout
        title={t("mcpAuthorize.signInTitle")}
        subtitle={t("mcpAuthorize.signInSubtitle")}
      >
        <Button
          type="button"
          className="w-full"
          onClick={() =>
            void navigate({
              to: "/auth/sign-in",
              search: {
                redirect: `/mcp/authorize${window.location.search}`,
              },
            })
          }
        >
          {t("mcpAuthorize.signIn")}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("mcpAuthorize.title")}
      subtitle={t("mcpAuthorize.subtitle")}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("mcpAuthorize.warning")}
        </p>
        <SettingsCard>
          <SettingsRow
            title={
              client.data?.client_name ??
              client.data?.name ??
              t("mcpAuthorize.defaultClientName")
            }
            description={t("mcpAuthorize.clientName")}
          />
          {redirectHost() ? (
            <SettingsRow
              title={redirectHost()}
              description={t("mcpAuthorize.redirectsTo")}
            />
          ) : null}
          <SettingsRow
            title={session.user.email}
            description={t("mcpAuthorize.signedInAs")}
          />
        </SettingsCard>
        {decision.isError ? (
          <p role="alert" className="text-destructive text-sm">
            {t("common:errors.unknown")}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button
            type="button"
            className="flex-1"
            loading={decision.isPending && decision.variables === true}
            disabled={decision.isPending}
            onClick={() => decision.mutate(true)}
          >
            {t("mcpAuthorize.approve")}
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={decision.isPending && decision.variables === false}
            disabled={decision.isPending}
            onClick={() => decision.mutate(false)}
          >
            {t("mcpAuthorize.deny")}
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
