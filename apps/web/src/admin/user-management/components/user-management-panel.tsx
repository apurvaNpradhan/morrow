import { UsersRoundIcon } from "lucide-react";
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
  useAdminUsers,
  ADMIN_USERS_PAGE_SIZE,
  ADMIN_USERS_SEARCH_MAX_LENGTH,
  type AdminUser,
} from "@/admin/use-admin-users";
import { SettingsPage } from "@/app/settings/settings-page";
import { useAuth } from "@/auth";
import { Badge } from "@/design-system/ui/badge";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system/ui/table";
import { EditUserDialog } from "./edit-user-dialog";
import type { PendingUserAction } from "@/admin/user-management/pending-user-action";
import { UserConfirmDialog } from "./user-confirm-dialog";
import { UserDirectoryRow } from "./user-directory-row";

const COLUMN_COUNT = 5;

export function UserManagementPanel() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(
    null,
  );
  const { search, setSearch, debouncedSearch, page, setPage } =
    useDirectoryPaging();

  const { data, isLoading, isFetching, isError, refetch } = useAdminUsers(
    debouncedSearch,
    page,
  );

  const total = data?.total ?? 0;
  const pageCount = getPageCount(total, ADMIN_USERS_PAGE_SIZE);
  usePageClamp({ page, pageCount, loaded: Boolean(data), setPage });

  const isSearchActive = debouncedSearch.trim().length > 0;

  return (
    <SettingsPage
      className="max-w-5xl"
      title={
        <span className="flex items-center gap-2">
          {t("settings:adminUsers.title")}
          <Badge variant="outline" size="sm">
            {t("settings:adminUsers.instanceBadge")}
          </Badge>
        </span>
      }
      description={t("settings:adminUsers.subtitle")}
    >
      <section className="overflow-hidden rounded-xl border bg-card shadow-xs/5">
        <DirectoryHeading
          title={t("settings:adminUsers.directoryTitle")}
          count={
            isSearchActive
              ? t("settings:adminUsers.searchCount", { count: total })
              : t("settings:adminUsers.userCount", { count: total })
          }
          refreshing={isFetching && !isLoading}
          refreshingLabel={t("settings:adminUsers.refreshing")}
          search={search}
          onSearchChange={setSearch}
          searchMaxLength={ADMIN_USERS_SEARCH_MAX_LENGTH}
          searchPlaceholder={t("settings:adminUsers.searchPlaceholder")}
          searchLabel={t("settings:adminUsers.searchLabel")}
        />

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-6">
                  {t("settings:adminUsers.columns.user")}
                </TableHead>
                <TableHead>{t("settings:adminUsers.columns.role")}</TableHead>
                <TableHead>{t("settings:adminUsers.columns.status")}</TableHead>
                <TableHead>{t("settings:adminUsers.columns.joined")}</TableHead>
                <TableHead className="w-px pe-6">
                  <span className="sr-only">
                    {t("settings:adminUsers.columns.actions")}
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
                  message={t("settings:adminUsers.loadError")}
                  retryLabel={t("settings:adminUsers.retry")}
                  onRetry={() => refetch()}
                />
              ) : null}

              {!isLoading && !isError && data?.users.length === 0 ? (
                <DirectoryEmptyRow
                  columns={COLUMN_COUNT}
                  icon={<UsersRoundIcon />}
                  title={t("settings:adminUsers.emptyTitle")}
                  description={t("settings:adminUsers.emptyDescription")}
                  clearLabel={t("settings:adminUsers.clearSearch")}
                  onClear={search ? () => setSearch("") : undefined}
                />
              ) : null}

              {!isLoading && !isError
                ? data?.users.map((managedUser) => (
                    <UserDirectoryRow
                      key={managedUser.id}
                      user={managedUser}
                      isSelf={managedUser.id === currentUser?.id}
                      onEdit={setEditingUser}
                      onAction={setPendingAction}
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
            summary={t("settings:adminUsers.pagination", {
              current: page + 1,
              total: pageCount,
            })}
            previousLabel={t("settings:adminUsers.previous")}
            nextLabel={t("settings:adminUsers.next")}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      <EditUserDialog user={editingUser} onClose={() => setEditingUser(null)} />
      <UserConfirmDialog
        action={pendingAction}
        onClose={() => setPendingAction(null)}
      />
    </SettingsPage>
  );
}
