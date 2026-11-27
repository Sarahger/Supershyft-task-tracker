import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, addMonths, endOfMonth, endOfQuarter, format, parseISO, startOfMonth, startOfQuarter } from "date-fns";
import clsx from "clsx";
import { reportsApi, departmentsApi } from "../services/endpoints";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Avatar } from "../components/ui/Avatar";
import { toast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { canAccessManagerFeatures } from "../lib/roles";
import { mondayOf } from "../lib/weeklyPlanParse";
import { OverviewCharts } from "../components/reports/OverviewCharts";
import { EvaluationsPanel } from "../components/reports/EvaluationsPanel";
import {
  WorkloadTasksDrawer
} from "../components/reports/WorkloadTasksDrawer";
function WorkloadBar({ person }) {
  const total = person.pending || 1;
  const segments = [
    { value: person.overdue, color: "#ef4444", label: "Overdue" },
    { value: person.blocked, color: "#fb923c", label: "Blocked" },
    { value: person.in_progress, color: "#fbbf24", label: "In progress" },
    {
      value: Math.max(0, person.pending - person.overdue - person.blocked - person.in_progress),
      color: "#60a5fa",
      label: "Other pending"
    }
  ].filter((s) => s.value > 0);
  return /* @__PURE__ */ jsx("div", { className: "flex h-2 rounded-full overflow-hidden bg-dark-muted min-w-[80px]", title: `${person.pending} pending tasks`, children: segments.map((seg) => /* @__PURE__ */ jsx(
    "div",
    {
      style: { width: `${seg.value / total * 100}%`, backgroundColor: seg.color }
    },
    seg.label
  )) });
}
function CountButton({
  value,
  className,
  onClick,
  label
}) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick,
      className: clsx(
        "tabular-nums font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 rounded px-1",
        className
      ),
      "aria-label": `View ${value} ${label}`,
      children: value
    }
  );
}
function PersonWorkloadTable({
  people,
  onOpenBucket
}) {
  if (!people.length) {
    return /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted py-8 text-center", children: "No assigned tasks yet." });
  }
  return /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
    /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-dark-border text-left", children: [
      /* @__PURE__ */ jsx("th", { className: "px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider", children: "Person" }),
      /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Pending" }),
      /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "In progress" }),
      /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Overdue" }),
      /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Blocked" }),
      /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "In review" }),
      /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Due this week" }),
      /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Done" }),
      /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Cancelled" }),
      /* @__PURE__ */ jsx("th", { className: "px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider min-w-[120px]", children: "Load" })
    ] }) }),
    /* @__PURE__ */ jsx("tbody", { children: people.map((person) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-dark-border hover:bg-dark-hover transition-colors", children: [
      /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 min-w-[160px]", children: [
        /* @__PURE__ */ jsx(Avatar, { name: person.name, size: "sm" }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "font-medium text-text-primary truncate", children: person.name }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted truncate", children: person.departments?.length ? person.departments.join(", ") : "No department" })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-3 text-center", children: /* @__PURE__ */ jsx(
        CountButton,
        {
          value: person.pending,
          className: person.pending > 0 ? "metric-sky-strong font-semibold" : "text-text-muted",
          onClick: () => onOpenBucket(person, "pending"),
          label: "pending tasks"
        }
      ) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-3 text-center", children: /* @__PURE__ */ jsx(
        CountButton,
        {
          value: person.in_progress,
          className: "metric-amber-strong",
          onClick: () => onOpenBucket(person, "in_progress"),
          label: "in progress tasks"
        }
      ) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-3 text-center", children: /* @__PURE__ */ jsx(
        CountButton,
        {
          value: person.overdue,
          className: person.overdue > 0 ? "metric-red" : "text-text-muted",
          onClick: () => onOpenBucket(person, "overdue"),
          label: "overdue tasks"
        }
      ) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-3 text-center", children: /* @__PURE__ */ jsx(
        CountButton,
        {
          value: person.blocked,
          className: "metric-orange-strong",
          onClick: () => onOpenBucket(person, "blocked"),
          label: "blocked tasks"
        }
      ) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-3 text-center", children: /* @__PURE__ */ jsx(
        CountButton,
        {
          value: person.in_review ?? 0,
          className: "metric-purple-strong",
          onClick: () => onOpenBucket(person, "in_review"),
          label: "in review tasks"
        }
      ) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-3 text-center", children: /* @__PURE__ */ jsx(
        CountButton,
        {
          value: person.due_this_week,
          className: "metric-purple-strong",
          onClick: () => onOpenBucket(person, "due_this_week"),
          label: "tasks due this week"
        }
      ) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-3 text-center", children: /* @__PURE__ */ jsx(
        CountButton,
        {
          value: person.completed,
          className: "metric-emerald-strong",
          onClick: () => onOpenBucket(person, "completed"),
          label: "completed tasks"
        }
      ) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-3 text-center", children: /* @__PURE__ */ jsx(
        CountButton,
        {
          value: person.cancelled ?? 0,
          className: "text-text-muted",
          onClick: () => onOpenBucket(person, "cancelled"),
          label: "cancelled tasks"
        }
      ) }),
      /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx(WorkloadBar, { person }) })
    ] }, person.user_id)) })
  ] }) });
}
function iso(day) {
  return format(day, "yyyy-MM-dd");
}
function clampToQuarterSpan(startStr, endStr) {
  const start = parseISO(startStr);
  let end = parseISO(endStr || startStr);
  if (Number.isNaN(start.getTime())) {
    const fallback = /* @__PURE__ */ new Date();
    return { start: iso(fallback), end: iso(fallback) };
  }
  if (Number.isNaN(end.getTime()) || end < start) end = start;
  const maxEnd = addDays(addMonths(start, 3), -1);
  if (end > maxEnd) end = maxEnd;
  return { start: iso(start), end: iso(end) };
}
function ReportsPage() {
  const { user } = useAuth();
  const isManager = canAccessManagerFeatures(user);
  const [tab, setTab] = useState("overview");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [period, setPeriod] = useState("week");
  const [customStart, setCustomStart] = useState(iso(startOfMonth(/* @__PURE__ */ new Date())));
  const [customEnd, setCustomEnd] = useState(iso(endOfMonth(/* @__PURE__ */ new Date())));
  const [openEvaluationId, setOpenEvaluationId] = useState(null);
  const [workloadTarget, setWorkloadTarget] = useState(null);
  const clearOpenedEvaluation = useCallback(() => setOpenEvaluationId(null), []);
  const reportFilters = useMemo(
    () => ({ department_id: departmentFilter ? Number(departmentFilter) : void 0 }),
    [departmentFilter]
  );
  const departmentId = departmentFilter ? Number(departmentFilter) : void 0;
  const range = useMemo(() => {
    const now = /* @__PURE__ */ new Date();
    if (period === "week") {
      const start = mondayOf(now);
      return { start: iso(start), end: iso(addDays(start, 6)) };
    }
    if (period === "quarter") {
      return { start: iso(startOfQuarter(now)), end: iso(endOfQuarter(now)) };
    }
    if (period === "custom") {
      return clampToQuarterSpan(customStart, customEnd || customStart);
    }
    return { start: iso(startOfMonth(now)), end: iso(endOfMonth(now)) };
  }, [period, customStart, customEnd]);
  const customMaxEnd = useMemo(
    () => iso(addDays(addMonths(parseISO(customStart || iso(/* @__PURE__ */ new Date())), 3), -1)),
    [customStart]
  );
  const { data, isLoading } = useQuery({
    queryKey: ["reports", reportFilters],
    queryFn: () => reportsApi.tasks(reportFilters).then((r) => r.data.data),
    enabled: isManager
  });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
    enabled: isManager
  });
  const handleExport = async () => {
    try {
      const response = await reportsApi.exportCsv(reportFilters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "tasks_report.csv";
      a.click();
      toast.success("Report exported");
    } catch {
      toast.error("Export failed");
    }
  };
  const openWorkloadBucket = useCallback((person, bucket) => {
    setWorkloadTarget({
      userId: person.user_id,
      personName: person.name,
      bucket
    });
  }, []);
  if (!isManager) {
    return /* @__PURE__ */ jsx("div", { className: "max-w-workspace mx-auto pb-12", children: /* @__PURE__ */ jsx(PageHeader, { title: "Reports", subtitle: "Reports are available to managers and admins." }) });
  }
  if (isLoading) {
    return /* @__PURE__ */ jsxs("div", { className: "max-w-workspace mx-auto pb-12 space-y-4", children: [
      /* @__PURE__ */ jsx("div", { className: "animate-pulse h-10 w-48 bg-dark-muted rounded-lg" }),
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: Array.from({ length: 3 }).map((_, i) => /* @__PURE__ */ jsx("div", { className: "h-72 bg-dark-muted rounded-lg animate-pulse" }, i)) })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "max-w-workspace mx-auto pb-12 space-y-8", children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        title: "Reports",
        subtitle: "See who has work pending, what needs attention, and how the team is progressing",
        action: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
          departments && departments.length > 0 && /* @__PURE__ */ jsxs(
            "select",
            {
              value: departmentFilter,
              onChange: (e) => setDepartmentFilter(e.target.value),
              className: "input py-1.5 text-sm w-auto",
              "aria-label": "Filter by department",
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "All departments" }),
                departments.map((d) => /* @__PURE__ */ jsx("option", { value: d.id, children: d.name }, d.id))
              ]
            }
          ),
          tab === "overview" && /* @__PURE__ */ jsxs(
            "select",
            {
              value: period,
              onChange: (e) => setPeriod(e.target.value),
              className: "input py-1.5 text-sm w-auto",
              "aria-label": "Reporting time frame",
              children: [
                /* @__PURE__ */ jsx("option", { value: "week", children: "This week" }),
                /* @__PURE__ */ jsx("option", { value: "month", children: "This month" }),
                /* @__PURE__ */ jsx("option", { value: "quarter", children: "This quarter" }),
                /* @__PURE__ */ jsx("option", { value: "custom", children: "Custom range" })
              ]
            }
          ),
          tab === "overview" && period === "custom" && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "date",
                className: "input py-1.5 text-sm w-auto",
                value: customStart,
                max: customEnd,
                onChange: (e) => {
                  const next = clampToQuarterSpan(e.target.value, customEnd);
                  setCustomStart(next.start);
                  setCustomEnd(next.end);
                },
                "aria-label": "Start date"
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "date",
                className: "input py-1.5 text-sm w-auto",
                value: customEnd,
                min: customStart,
                max: customMaxEnd,
                onChange: (e) => {
                  const next = clampToQuarterSpan(customStart, e.target.value);
                  setCustomStart(next.start);
                  setCustomEnd(next.end);
                },
                "aria-label": "End date"
              }
            )
          ] }),
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: handleExport, children: "Export CSV" })
        ] })
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "flex gap-2 border-b border-dark-border", children: [
      ["overview", "Overview"],
      ["evaluations", "Evaluations"]
    ].map(([id, label]) => /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => setTab(id),
        className: clsx(
          "px-3 py-2 text-sm border-b-2 -mb-px",
          tab === id ? "border-accent-primary text-text-primary" : "border-transparent text-text-muted"
        ),
        children: label
      },
      id
    )) }),
    tab === "overview" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        OverviewCharts,
        {
          departmentId,
          start: range.start,
          end: range.end,
          people: data?.by_assignee ?? [],
          onOpenEvaluation: (id) => {
            setOpenEvaluationId(id);
            setTab("evaluations");
          }
        }
      ),
      /* @__PURE__ */ jsxs("section", { className: "card overflow-hidden", children: [
        /* @__PURE__ */ jsxs("div", { className: "px-6 py-5 border-b border-dark-border", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-sm font-medium text-text-primary", children: "Workload by person" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted mt-1", children: "Pending tasks per team member \u2014 sorted by who has the most open work. Click a number to see the tasks." })
        ] }),
        /* @__PURE__ */ jsx(
          PersonWorkloadTable,
          {
            people: data?.by_assignee ?? [],
            onOpenBucket: openWorkloadBucket
          }
        )
      ] })
    ] }) : /* @__PURE__ */ jsx(
      EvaluationsPanel,
      {
        departmentId,
        initialEvaluationId: openEvaluationId,
        onConsumedInitial: clearOpenedEvaluation
      }
    ),
    /* @__PURE__ */ jsx(
      WorkloadTasksDrawer,
      {
        target: workloadTarget,
        departmentId,
        onClose: () => setWorkloadTarget(null)
      }
    )
  ] });
}
export {
  ReportsPage as default
};
