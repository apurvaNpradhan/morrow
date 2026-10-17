import type {
  LabelRow,
  ProjectColumnRow,
  ProjectRow,
  TaskRow,
} from "@morrow/sync-schemas";
import { createContext, type ReactNode, useContext } from "react";
import type { Person } from "../queries/use-workspace-people";

/** What each card and row shows, from the device preferences. */
export type TaskDisplay = {
  numbers: boolean;
  assignees: boolean;
  dueDates: boolean;
  priority: boolean;
  checklist: boolean;
};

/** What the signed-in user may do with this Project's tasks. */
export type TaskPermissions = {
  create: boolean;
  edit: boolean;
  delete: boolean;
  assign: boolean;
  /** Create a Workspace label from the picker. */
  createLabel: boolean;
  /** Write comments. */
  comment: boolean;
  /** Delete anyone's comment, not only one's own. */
  moderateComments: boolean;
};

/**
 * Everything a card, row or picker needs about the Project it is shown in, so
 * the board and the list do not pass a dozen props down to each task.
 */
export type TaskViewValue = {
  workspace: { id: string; slug: string };
  project: ProjectRow;
  columns: ProjectColumnRow[];
  columnById: Map<string, ProjectColumnRow>;
  /** How full each `started` Column's status icon is. */
  statusFractions: ReadonlyMap<string, number>;
  /** The Workspace's labels in order, and by id. */
  labels: LabelRow[];
  labelById: Map<string, LabelRow>;
  people: Person[];
  personById: Map<string, Person>;
  meId: string;
  today: string;
  display: TaskDisplay;
  can: TaskPermissions;
  /** The Project is archived: nothing can be edited. */
  frozen: boolean;
  openTask: (task: TaskRow) => void;
  /** Goes to the Project's board or list. */
  switchLayout: (layout: "board" | "list") => void;
};

const TaskViewContext = createContext<TaskViewValue | null>(null);

export function TaskViewProvider({
  value,
  children,
}: {
  value: TaskViewValue;
  children: ReactNode;
}) {
  return (
    <TaskViewContext.Provider value={value}>
      {children}
    </TaskViewContext.Provider>
  );
}

export function useTaskView(): TaskViewValue {
  const value = useContext(TaskViewContext);
  if (!value) throw new Error("useTaskView needs a TaskViewProvider");
  return value;
}
