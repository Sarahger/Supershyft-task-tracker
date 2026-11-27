import { jsx, jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { reportsApi } from "../../services/endpoints";
import { useTaskDrawer } from "../../contexts/TaskDrawerContext";
import { Drawer } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { STATUS_LABELS } from "../../types";
const BUCKET_LABELS = {
  pending: "Pending",
  in_progress: "In progress",
  overdue: "Overdue",
  blocked: "Blocked",
  due_this_week: "Due this week",
  completed: "Done",
  in_review: "In review",
  cancelled: "Cancelled"
};
function formatDue(value) {
  if (!value) return "No due date";
  try {
    return format(parseISO(value), "EEE, MMM d \xB7 h:mm a");
  } catch {
    return value;
  }
}
function WorkloadTasksDrawer({
  target,
  departmentId,
  onClose
}) {
  const { openTask } = useTaskDrawer();
  const open = target != null;
  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "reports-workload-tasks",
      target?.userId,
      target?.bucket,
      departmentId ?? null
    ],
    queryFn: () => reportsApi.workloadTasks({
      user_id: target.userId,
      bucket: target.bucket,
      ...departmentId ? { department_id: departmentId } : {}
    }).then((r) => r.data.data),
    enabled: open
  });
  const title = target ? `${BUCKET_LABELS[target.bucket]} \xB7 ${target.personName}` : "";
  return /* @__PURE__ */ jsx(Drawer, { isOpen: open, onClose, children: /* @__PURE__ */ jsxs("div", { className: "px-6 pt-14 pb-8 space-y-5", "data-testid": "workload-tasks-drawer", children: [
    /* @__PURE__ */ jsxs("header", { children: [
      /* @__PURE__ */ jsx("h2", { className: "text-base font-medium text-text-primary", children: title }),
      /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted mt-1", children: data ? `${data.tasks.length} task${data.tasks.length === 1 ? "" : "s"}` : "Loading tasks\u2026" })
    ] }),
    isLoading ? /* @__PURE__ */ jsx("div", { className: "space-y-2", children: Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ jsx(Skeleton, { className: "h-14 w-full" }, i)) }) : isError ? /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted py-8 text-center", children: "Could not load tasks." }) : !data?.tasks.length ? /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted py-8 text-center", children: "No tasks in this group." }) : /* @__PURE__ */ jsx("ul", { className: "rounded-lg border border-dark-border overflow-hidden divide-y divide-dark-border", children: data.tasks.map((task) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => openTask(task.id),
        className: "w-full text-left px-4 py-3 hover:bg-dark-hover transition-colors",
        children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-text-primary truncate", children: task.title }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 mt-1", children: [
            /* @__PURE__ */ jsx("span", { className: "chip bg-surface-muted text-text-secondary text-2xs", children: STATUS_LABELS[task.status] || task.status.replace(/_/g, " ") }),
            /* @__PURE__ */ jsx("span", { className: "text-2xs text-text-muted tabular-nums", children: formatDue(task.due_date) })
          ] })
        ]
      }
    ) }, task.id)) })
  ] }) });
}
export {
  WorkloadTasksDrawer
};
