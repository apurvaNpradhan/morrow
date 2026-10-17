import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProjectRow } from "@morrow/sync-schemas";
import { errorMessage } from "@/app/lib/error-message";
import { rpc } from "@/app/lib/orpc";
import { Button } from "@/design-system/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { Spinner } from "@/design-system/ui/spinner";

/** The limits the server enforces, checked here first so a bad file fails at once. */
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_TASKS = 5000;

type Result = Awaited<ReturnType<typeof rpc.tasks.import>>;

/**
 * Imports tasks from a JSON file (an export, from here or another instance):
 * choose or drop the file, import, and read every warning about what could not
 * be matched. The import is all or nothing.
 */
export function ImportTasksDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("tasks");
  const [file, setFile] = useState<{ name: string; document: unknown } | null>(
    null,
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function choose(chosen: File | undefined) {
    setResult(null);
    setProblem(null);
    setFile(null);
    if (!chosen) return;
    if (chosen.size > MAX_BYTES) {
      setProblem(t("import.tooLarge"));
      return;
    }
    try {
      const document: unknown = JSON.parse(await chosen.text());
      const tasks = (document as { tasks?: unknown })?.tasks;
      if (!Array.isArray(tasks)) throw new Error("No tasks");
      if (tasks.length > MAX_TASKS) {
        setProblem(t("import.tooMany", { max: MAX_TASKS }));
        return;
      }
      setFile({ name: chosen.name, document });
    } catch {
      setProblem(t("import.invalid"));
    }
  }

  async function run() {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      setResult(
        await rpc.tasks.import({
          workspaceId: project.workspaceId,
          projectId: project.id,
          document: file.document,
        }),
      );
    } catch (error) {
      setProblem(errorMessage(t, error, t("import.error")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setFile(null);
          setProblem(null);
          setResult(null);
        }
      }}
    >
      <DialogPopup className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("import.dialogTitle", { key: project.key })}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          {result ? (
            <div className="space-y-3 text-sm" role="status">
              <p>{t("import.done", { count: result.created })}</p>
              {result.warnings.length > 0 ? (
                <div>
                  <p className="mb-1 font-medium">{t("import.warnings")}</p>
                  <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
                    {result.warnings.map((warning) => {
                      const { key, text } = describeWarning(t, warning);
                      return <li key={key}>{text}</li>;
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <label
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-6 text-center text-sm hover:bg-accent/40"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void choose(event.dataTransfer.files[0]);
              }}
            >
              <span className="font-medium">
                {file ? file.name : t("import.drop")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("import.limits", { count: MAX_TASKS })}
              </span>
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => void choose(event.target.files?.[0])}
              />
            </label>
          )}
          {problem ? (
            <p className="text-sm text-destructive-foreground" role="alert">
              {problem}
            </p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {result ? t("import.close") : t("common:actions.cancel")}
          </Button>
          {result ? null : (
            <Button
              type="button"
              size="sm"
              disabled={!file || busy}
              onClick={() => void run()}
            >
              {busy ? <Spinner /> : null}
              {t("import.run")}
            </Button>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

type Warning = Result["warnings"][number];

/** A warning's list key and its sentence. */
function describeWarning(t: TFunction, warning: Warning) {
  switch (warning.kind) {
    case "column_unmatched":
      return {
        key: `c:${warning.column}`,
        text: t("import.warning.columnUnmatched", warning),
      };
    case "assignee_unknown":
      return {
        key: `a:${warning.email}`,
        text: t("import.warning.assigneeUnknown", warning),
      };
    case "assignee_dropped":
      return {
        key: "dropped",
        text: t("import.warning.assigneeDropped", warning),
      };
    case "label_dropped":
      return {
        key: `l:${warning.label}`,
        text: t("import.warning.labelDropped", warning),
      };
    case "comment_author_unknown":
      return {
        key: `m:${warning.email}`,
        text: t("import.warning.commentAuthorUnknown", warning),
      };
  }
}
