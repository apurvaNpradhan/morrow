import { Building2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DirectoryEmptyRow } from "@/admin/directory/directory-empty-row";
import { DirectoryErrorRow } from "@/admin/directory/directory-error-row";
import { DirectoryHeading } from "@/admin/directory/directory-heading";
import { DirectoryPagination } from "@/admin/directory/directory-pagination";
import { DirectorySkeletonRows } from "@/admin/directory/directory-skeleton-rows";
import { getPageCount } from "@/admin/directory/get-page-count";
import {
  useDirectoryPaging,
  usePageClamp,
} from "@/admin/directory/use-directory-paging";
import {
  useAdminWorkspaces,
  ADMIN_WORKSPACES_PAGE_SIZE,
  ADMIN_WORKSPACES_SEARCH_MAX_LENGTH,
  type AdminWorkspace,
} from "@/admin/workspace-management/queries/use-admin-workspaces";
import { SettingsPage } from "@/app/settings/settings-page";
import { Badge } from "@/design-system/ui/badge";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system/ui/table";
import { WorkspaceMembersDialog } from "./workspace-members-dialog";
import { WorkspaceTableRow } from "./workspace-table-row";

const COLUMN_COUNT = 5;

export function WorkspaceManagementPanel() {
  const { t } = useTranslation();
  const { search, setSearch, debouncedSearch, page, setPage } =
    useDirectoryPaging();
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<AdminWorkspace | null>(null);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  const { data, isLoading, isFetching, isError, refetch } = useAdminWorkspaces(
    debouncedSearch,
    page,
  );

  const total = data?.total ?? 0;
  const pageCount = getPageCount(total, ADMIN_WORKSPACES_PAGE_SIZE);
  usePageClamp({ page, pageCount, loaded: Boolean(data), setPage });
  const isSearchActive = debouncedSearch.trim().length > 0;

  return (
    <SettingsPage
      className="max-w-5xl"
      title={
        <span className="flex items-center gap-2">
          {t("settings:adminWorkspaces.title")}
          <Badge variant="outline" size="sm">
            {t("settings:adminWorkspaces.instanceBadge")}
          </Badge>
        </span>
      }
      description={t("settings:adminWorkspaces.subtitle")}
    >
      <section className="overflow-hidden rounded-xl border bg-card shadow-xs/5">
        <DirectoryHeading
          title={t("settings:adminWorkspaces.directoryTitle")}
          count={
            isSearchActive
              ? t("settings:adminWorkspaces.searchCount", { count: total })
              : t("settings:adminWorkspaces.workspaceCount", { count: total })
          }
          refreshing={isFetching && !isLoading}
          refreshingLabel={t("settings:adminWorkspaces.refreshing")}
          search={search}
          onSearchChange={setSearch}
          searchMaxLength={ADMIN_WORKSPACES_SEARCH_MAX_LENGTH}
          searchPlaceholder={t("settings:adminWorkspaces.searchPlaceholder")}
          searchLabel={t("settings:adminWorkspaces.searchLabel")}
        />

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-6">
                  {t("settings:adminWorkspaces.columns.workspace")}
                </TableHead>
                <TableHead>
                  {t("settings:adminWorkspaces.columns.owners")}
                </TableHead>
                <TableHead>
                  {t("settings:adminWorkspaces.columns.members")}
                </TableHead>
                <TableHead>
                  {t("settings:adminWorkspaces.columns.created")}
                </TableHead>
                <TableHead className="w-px pe-6">
                  <span className="sr-only">
                    {t("settings:adminWorkspaces.columns.actions")}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <DirectorySkeletonRows columns={COLUMN_COUNT} />
              ) : null}

              {!isLoading && isError ? (
                <DirectoryErrorRow
                  columns={COLUMN_COUNT}
                  message={t("settings:adminWorkspaces.loadError")}
                  retryLabel={t("settings:adminWorkspaces.retry")}
                  onRetry={() => refetch()}
                />
              ) : null}

              {!isLoading && !isError && data?.workspaces.length === 0 ? (
                <DirectoryEmptyRow
                  columns={COLUMN_COUNT}
                  icon={<Building2Icon />}
                  title={t("settings:adminWorkspaces.emptyTitle")}
                  description={t("settings:adminWorkspaces.emptyDescription")}
                  clearLabel={t("settings:adminWorkspaces.clearSearch")}
                  onClear={search ? () => setSearch("") : undefined}
                />
              ) : null}

              {!isLoading && !isError
                ? data?.workspaces.map((workspace) => (
                    <WorkspaceTableRow
                      key={workspace.id}
                      workspace={workspace}
                      onManage={() => {
                        setSelectedWorkspace(workspace);
                        setIsMembersOpen(true);
                      }}
                    />
                  ))
                : null}
            </TableBody>
          </Table>
        </div>

        {!isLoading && !isError ? (
          <DirectoryPagination
            page={page}
            pageCount={pageCount}
            busy={isFetching}
            summary={t("settings:adminWorkspaces.pagination", {
              current: page + 1,
              total: pageCount,
            })}
            previousLabel={t("settings:adminWorkspaces.previous")}
            nextLabel={t("settings:adminWorkspaces.next")}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      <WorkspaceMembersDialog
        workspace={selectedWorkspace}
        open={isMembersOpen}
        onOpenChange={setIsMembersOpen}
      />
    </SettingsPage>
  );
}
