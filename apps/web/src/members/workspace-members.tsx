import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/design-system/ui/card";
import { Empty, EmptyDescription } from "@/design-system/ui/empty";
import { useWorkspaceMembers } from "./queries/use-workspace-members";

const MEMBERS_PER_PAGE = 20;

export function WorkspaceMembers({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const [memberPage, setMemberPage] = useState({ workspaceId, page: 0 });
  const page = memberPage.workspaceId === workspaceId ? memberPage.page : 0;
  useEffect(() => {
    setMemberPage({ workspaceId, page: 0 });
  }, [workspaceId]);
  const members = useWorkspaceMembers(workspaceId);
  const totalMembers = members.length;
  const memberPages = Math.ceil(totalMembers / MEMBERS_PER_PAGE);
  const memberRangeStart = totalMembers === 0 ? 0 : page * MEMBERS_PER_PAGE + 1;
  const memberRangeEnd = Math.min((page + 1) * MEMBERS_PER_PAGE, totalMembers);
  const pageMembers = members.slice(
    page * MEMBERS_PER_PAGE,
    (page + 1) * MEMBERS_PER_PAGE,
  );

  useEffect(() => {
    const lastPage = Math.max(0, memberPages - 1);
    if (page > lastPage) setMemberPage({ workspaceId, page: lastPage });
  }, [memberPages, page, workspaceId]);

  return (
    <section aria-label={t("workspace:home.members.title")}>
      <Card>
        <CardHeader>
          <CardTitle>{t("workspace:home.members.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {t("workspace:home.members.count", {
              start: memberRangeStart,
              end: memberRangeEnd,
              total: totalMembers,
            })}
          </p>
          {pageMembers.length ? (
            <>
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {pageMembers.map((member) => (
                  <li key={member.id} className="text-sm">
                    <span>{member.user.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
              {memberPages > 1 ? (
                <nav
                  className="mt-4 flex items-center justify-between gap-4"
                  aria-label={t("workspace:home.members.pagination")}
                >
                  <Button
                    variant="outline"
                    disabled={page === 0}
                    onClick={() =>
                      setMemberPage({ workspaceId, page: page - 1 })
                    }
                  >
                    {t("workspace:home.members.previous")}
                  </Button>
                  <span className="text-sm" aria-live="polite">
                    {t("workspace:home.members.page", {
                      page: page + 1,
                      total: memberPages,
                    })}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page + 1 >= memberPages}
                    onClick={() =>
                      setMemberPage({ workspaceId, page: page + 1 })
                    }
                  >
                    {t("workspace:home.members.next")}
                  </Button>
                </nav>
              ) : null}
            </>
          ) : (
            <Empty className="min-h-24 p-4">
              <EmptyDescription>
                {t("workspace:home.members.empty")}
              </EmptyDescription>
            </Empty>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
