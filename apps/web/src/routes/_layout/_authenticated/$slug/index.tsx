import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/design-system/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/design-system/ui/card";
import { Empty, EmptyDescription } from "@/design-system/ui/empty";
import { Skeleton } from "@/design-system/ui/skeleton";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout } from "@/app/components/workspace-layout";
import { PageTitle } from "@/design-system/page-title";
import { ActivityItem } from "@/activity";
import { WorkspaceMembers } from "@/members";
import { useActiveWorkspace } from "@/workspace";
import { orpc } from "@/app/lib/orpc";

export const Route = createFileRoute("/_layout/_authenticated/$slug/")({
  component: WorkspaceHome,
});

function WorkspaceHome() {
  const { t } = useTranslation();
  const { workspace: resolved } = Route.useRouteContext();
  const workspaceId = resolved.id;
  // The route already resolved the workspace; no second request for its name.
  const { data: current } = useActiveWorkspace();
  const workspace = current ?? resolved;
  const activity = useInfiniteQuery(
    orpc.activity.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ workspaceId, cursor }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    }),
  );
  const title = workspace.name;
  const pages = activity.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);

  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout title={title}>
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <WorkspaceMembers workspaceId={workspaceId} />
          <section aria-label={t("workspace:home.activity.title")}>
            <Card>
              <CardHeader>
                <CardTitle>{t("workspace:home.activity.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                {activity.isPending ? (
                  <div aria-busy="true" className="flex flex-col gap-3">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                ) : activity.isError && items.length === 0 ? (
                  <div className="flex flex-col gap-3">
                    <p role="alert">{t("workspace:home.activity.error")}</p>
                    <Button
                      variant="outline"
                      onClick={() => void activity.refetch()}
                    >
                      {t("workspace:home.activity.retry")}
                    </Button>
                  </div>
                ) : items.length === 0 ? (
                  <Empty className="min-h-24 p-4">
                    <EmptyDescription>
                      {t("workspace:home.activity.empty")}
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <>
                    {activity.isError ? (
                      <p role="alert" className="mb-3 text-sm">
                        {t("workspace:home.activity.error")}
                      </p>
                    ) : null}
                    <ol>
                      {items.map((item) => (
                        <ActivityItem key={item.id} activity={item} />
                      ))}
                    </ol>
                    {activity.hasNextPage ? (
                      <Button
                        className="mt-4"
                        variant="outline"
                        disabled={activity.isFetchingNextPage}
                        onClick={() => void activity.fetchNextPage()}
                      >
                        {activity.isFetchingNextPage
                          ? t("workspace:home.activity.loadingMore")
                          : t("workspace:home.activity.loadMore")}
                      </Button>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </main>
      </WorkspaceLayout>
    </>
  );
}
