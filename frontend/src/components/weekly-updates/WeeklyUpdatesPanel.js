import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { departmentsApi, weeklyUpdatesApi } from "../../services/endpoints";
import { useAuth } from "../../contexts/AuthContext";
import { EmptyState, Skeleton } from "../ui/Skeleton";
import { EmployeeProfileStrip } from "./EmployeeProfileStrip";
import { OverdueRevisionModal } from "./OverdueRevisionModal";
import { SubmitWeeklyUpdateForm } from "./SubmitWeeklyUpdateForm";
import { WeeklyReportCard } from "./WeeklyReportCard";
import {
  mondayOf,
  monthKeyFromDate,
  monthSelectOptions,
  weeksInMonth
} from "../../lib/weeklyPlanParse";
function isoMonday(day = /* @__PURE__ */ new Date()) {
  return format(mondayOf(day), "yyyy-MM-dd");
}
function monthKeyFromWeekStart(weekStartIso) {
  try {
    return format(parseISO(weekStartIso), "yyyy-MM");
  } catch {
    return monthKeyFromDate();
  }
}
function WeeklyUpdatesPanel() {
  const { user } = useAuth();
  const [departmentId, setDepartmentId] = useState("");
  const [weekStart, setWeekStart] = useState(isoMonday());
  const [selectedMonth, setSelectedMonth] = useState(() => monthKeyFromDate());
  const [selectedUserId, setSelectedUserId] = useState(user?.id ?? null);
  const [writing, setWriting] = useState(false);
  const [reviseItem, setReviseItem] = useState(null);
  const monthOptions = useMemo(() => monthSelectOptions(), []);
  const weekOptions = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return [];
    return weeksInMonth(year, monthIndex);
  }, [selectedMonth]);
  const employeeParams = useMemo(
    () => departmentId !== "" ? { department_id: Number(departmentId) } : {},
    [departmentId]
  );
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsApi.list().then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1e3
  });
  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ["weekly-updates", "employees", employeeParams],
    queryFn: () => weeklyUpdatesApi.employees(employeeParams).then((r) => r.data.data),
    staleTime: 2 * 60 * 1e3,
    placeholderData: keepPreviousData
  });
  const employees = employeesData?.items ?? [];
  useEffect(() => {
    if (!employees.length) return;
    if (selectedUserId && employees.some((e) => e.id === selectedUserId)) return;
    const preferred = employees.find((e) => e.id === user?.id) ?? employees[0];
    setSelectedUserId(preferred.id);
  }, [employees, selectedUserId, user?.id]);
  const { data: historyData, isLoading: historyLoading, isFetching: historyFetching, isError: historyError } = useQuery({
    queryKey: ["weekly-updates", "user", selectedUserId, weekStart],
    queryFn: () => weeklyUpdatesApi.userHistory(selectedUserId, weekStart).then((r) => r.data.data),
    enabled: selectedUserId != null,
    staleTime: 30 * 1e3,
    placeholderData: keepPreviousData
  });
  useEffect(() => {
    if (!weekOptions.length) return;
    if (weekOptions.some((w) => w.monday === weekStart)) return;
    const todayMonday = isoMonday();
    const preferred = weekOptions.find((w) => w.monday === todayMonday)?.monday ?? weekOptions[0]?.monday;
    if (preferred) setWeekStart(preferred);
  }, [weekOptions, weekStart]);
  const historyMatchesSelection = Boolean(
    historyData && historyData.user?.id === selectedUserId && (historyData.focus_week === weekStart || historyData.current_period_start === weekStart || historyData.reports?.some((r) => r.period_start === weekStart))
  );
  const history = historyMatchesSelection ? historyData : void 0;
  const showHistorySkeleton = selectedUserId != null && (historyLoading && !historyData || historyFetching && !historyMatchesSelection);
  const selected = employees.find((e) => e.id === selectedUserId);
  const isOwn = selectedUserId === user?.id;
  const writablePeriod = history?.writable_period_start ?? history?.current_period_start ?? weekStart;
  const selectedReport = history?.reports.find((r) => r.period_start === weekStart) ?? null;
  const canWrite = Boolean(isOwn && weekStart >= writablePeriod);
  const writeWeekEndIso = weekStart === history?.writable_period_start && history.writable_period_end ? history.writable_period_end : weekStart === history?.current_period_start && history.current_period_end ? history.current_period_end : format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const writeWeekEnd = format(parseISO(writeWeekEndIso), "MMMM d, yyyy");
  const weekLabel = `${format(parseISO(weekStart), "MMMM d")} \u2013 ${writeWeekEnd}`;
  const liveCurrentWeek = history?.current_week_tasks ?? history?.outstanding ?? [];
  const showUnwrittenCard = !showHistorySkeleton && isOwn && canWrite && !writing && !selectedReport;
  const showSelectedCard = !showHistorySkeleton && Boolean(selectedReport) && !(writing && selectedReport?.period_start === weekStart);
  const jumpToWeek = (mondayIso) => {
    if (!mondayIso) return;
    const monday = isoMonday(parseISO(mondayIso));
    setSelectedMonth(monthKeyFromWeekStart(monday));
    setWeekStart(monday);
    requestAnimationFrame(() => {
      document.getElementById(`week-${monday}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const onMonthChange = (monthValue) => {
    setSelectedMonth(monthValue);
    const [yearStr, monthStr] = monthValue.split("-");
    const weeks = weeksInMonth(Number(yearStr), Number(monthStr) - 1);
    if (!weeks.length) return;
    const todayMonday = isoMonday();
    const todayMonth = monthKeyFromDate();
    const nextWeek = monthValue === todayMonth ? weeks.find((w) => w.monday === todayMonday) ?? weeks[weeks.length - 1] : weeks[0];
    setWeekStart(nextWeek.monday);
    requestAnimationFrame(() => {
      document.getElementById(`week-${nextWeek.monday}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const author = selected ? {
    id: selected.id,
    first_name: selected.first_name,
    last_name: selected.last_name,
    profile_picture: selected.profile_picture
  } : history?.user ?? null;
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 md:h-full md:min-h-0", children: [
    /* @__PURE__ */ jsxs("header", { className: "shrink-0", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-xl font-semibold text-text-primary", children: "Weekly Updates" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted mt-0.5", children: "Share completed work and this week's tasks. Use @name to tag someone. Plan future weeks on those weeks." })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4 md:grid-cols-[280px_minmax(0,1fr)] md:flex-1 md:min-h-0", children: [
      /* @__PURE__ */ jsxs("aside", { className: "space-y-3 md:overflow-y-auto min-w-0", children: [
        /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-dark-border bg-dark-card p-3 sm:p-4 space-y-3", children: [
          /* @__PURE__ */ jsxs("label", { className: "block", children: [
            /* @__PURE__ */ jsx("span", { className: "block text-2xs uppercase tracking-wider text-text-muted mb-1.5", children: "Department" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                className: "input w-full text-sm",
                value: departmentId,
                onChange: (e) => setDepartmentId(e.target.value === "" ? "" : Number(e.target.value)),
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "All Departments" }),
                  (departments ?? []).map((d) => /* @__PURE__ */ jsx("option", { value: d.id, children: d.name }, d.id))
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "block", children: [
            /* @__PURE__ */ jsx("span", { className: "block text-2xs uppercase tracking-wider text-text-muted mb-1.5", children: "Month" }),
            /* @__PURE__ */ jsx(
              "select",
              {
                className: "input w-full text-sm",
                value: selectedMonth,
                onChange: (e) => onMonthChange(e.target.value),
                children: monthOptions.map((month) => /* @__PURE__ */ jsx("option", { value: month.value, children: month.label }, month.value))
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "block", children: [
            /* @__PURE__ */ jsx("span", { className: "block text-2xs uppercase tracking-wider text-text-muted mb-1.5", children: "Week" }),
            /* @__PURE__ */ jsx(
              "select",
              {
                className: "input w-full text-sm",
                value: weekOptions.some((w) => w.monday === weekStart) ? weekStart : weekOptions[0]?.monday ?? "",
                onChange: (e) => jumpToWeek(e.target.value),
                children: weekOptions.map((week) => /* @__PURE__ */ jsx("option", { value: week.monday, children: week.label }, week.monday))
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-dark-border bg-dark-card p-3 sm:p-4", children: [
          /* @__PURE__ */ jsx("p", { className: "text-2xs uppercase tracking-wider text-text-muted mb-2", children: "People" }),
          employeesLoading && employees.length === 0 ? /* @__PURE__ */ jsx(Skeleton, { className: "h-10 w-full" }) : /* @__PURE__ */ jsx(
            EmployeeProfileStrip,
            {
              employees,
              selectedId: selectedUserId,
              onSelect: (id) => {
                setSelectedUserId(id);
                setWriting(false);
              }
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "min-h-[280px] min-w-0 space-y-4 md:overflow-y-auto", children: [
        showUnwrittenCard && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-dark-border bg-dark-card px-5 py-4 space-y-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: "Week of" }),
              /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-text-primary mt-0.5", children: weekLabel })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setWriting(true),
                className: "text-sm text-accent-primary hover:underline",
                children: "Write"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: "Weekly Tasks" }),
              liveCurrentWeek.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted mt-1", children: "No tasks yet" }) : /* @__PURE__ */ jsx("ol", { className: "space-y-1 mt-1", children: liveCurrentWeek.map((item, i) => {
                const carried = Boolean(item.is_carried_forward || item.commitment_type === "carried_forward" || item.is_overdue);
                return /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2", children: [
                  /* @__PURE__ */ jsxs("span", { className: "text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5", children: [
                    i + 1,
                    "."
                  ] }),
                  /* @__PURE__ */ jsxs("p", { className: carried ? "text-sm text-amber-400" : "text-sm text-text-primary", children: [
                    item.title,
                    item.is_overdue ? /* @__PURE__ */ jsx("span", { className: "ml-2 text-2xs text-accent-danger", children: "Overdue" }) : null
                  ] })
                ] }, item.task_id ?? `${item.title}-${i}`);
              }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: "Completed Tasks" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted mt-1", children: "No tasks yet" })
            ] })
          ] })
        ] }),
        writing && isOwn && canWrite && /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-dark-border bg-dark-card p-5 sm:p-6", children: /* @__PURE__ */ jsx(
          SubmitWeeklyUpdateForm,
          {
            periodStart: weekStart,
            existing: selectedReport ?? void 0,
            onClose: () => setWriting(false)
          }
        ) }),
        showHistorySkeleton && /* @__PURE__ */ jsx(Skeleton, { className: "h-48 w-full" }),
        historyError && /* @__PURE__ */ jsx(EmptyState, { title: "Could not load weekly updates", description: "Try again in a moment." }),
        !showHistorySkeleton && history && !showSelectedCard && !showUnwrittenCard && !writing && /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-dark-border bg-dark-card p-5", children: /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted", children: isOwn ? "No weekly update for this week yet." : `${selected?.first_name ?? "This person"} has no weekly update for this week.` }) }),
        showSelectedCard && selectedReport && (() => {
          const report = selectedReport;
          const overlayWritableLive = report.period_start === writablePeriod || report.is_current;
          const currentIds = new Set((report.current_week_tasks ?? []).map((c) => c.task_id).filter(Boolean));
          const merged = overlayWritableLive ? {
            ...report,
            current_week_tasks: [
              ...liveCurrentWeek.filter((c) => c.task_id && !currentIds.has(c.task_id)),
              ...report.current_week_tasks ?? []
            ]
          } : {
            ...report,
            current_week_tasks: report.current_week_tasks ?? []
          };
          const openCount = merged.current_week_tasks?.length ?? 0;
          return /* @__PURE__ */ jsx(
            WeeklyReportCard,
            {
              report: merged,
              author,
              onEdit: canWrite && !writing ? () => setWriting(true) : void 0,
              actionLabel: report.status === "draft" && openCount === 0 ? "Write update" : "Edit",
              onRevise: canWrite ? setReviseItem : void 0
            },
            report.id
          );
        })()
      ] })
    ] }),
    /* @__PURE__ */ jsx(OverdueRevisionModal, { item: reviseItem, onClose: () => setReviseItem(null) })
  ] });
}
export {
  WeeklyUpdatesPanel
};
