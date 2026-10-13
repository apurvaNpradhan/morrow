import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout, authClient } from "@/auth";

export const Route = createFileRoute("/mcp/login")({
  component: McpLoginPage,
});

/**
 * Where the OAuth server sends a signed-out user. Signed-in users go straight
 * back to the authorize endpoint with the same signed query; others sign in
 * first and return here.
 */
function McpLoginPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;
    const { search } = window.location;
    if (session?.user) {
      window.location.assign(`/api/auth/oauth2/authorize${search}`);
    } else {
      void navigate({
        to: "/auth/sign-in",
        search: { redirect: `/mcp/login${search}` },
      });
    }
  }, [isPending, session, navigate]);

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
