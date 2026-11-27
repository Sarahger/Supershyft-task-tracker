import { jsx, jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { reportsApi } from "../../services/endpoints";
import { useTheme } from "../../contexts/ThemeContext";
import { getChartTheme } from "../../lib/chartTheme";
import { Avatar } from "../ui/Avatar";
function periodLabel(start) {
  return format(parseISO(start), "MMM yyyy");
}
function ChartCard({
  title,
  description,
  children
}) {
  return /* @__PURE__ */ jsxs("section", { className: "card p-6 min-h-[280px]", children: [
    /* @__PURE__ */ jsx("h3", { className: "text-sm font-medium text-text-primary", children: title }),
    description && /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted mt-1 mb-4", children: description }),
    children
  ] });
}
function EmptyChart({ text }) {
  return /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted py-16 text-center", children: text });
}
function formatLeaveDays(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
function OverviewCharts({
  departmentId,
  start,
  end,
  people,
  onOpenEvaluation
}) {
  const { theme } = useTheme();
  const chartTheme = getChartTheme(theme);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports-analytics", start, end, departmentId ?? null],
    queryFn: () => reportsApi.analytics({
      start_date: start,
      end_date: end,
      ...departmentId ? { department_id: departmentId } : {}
    }).then((r) => r.data.data),
    enabled: Boolean(start && end)
  });
  if (isLoading) {
    return /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: Array.from({ length: 3 }).map((_, i) => /* @__PURE__ */ jsx("div", { className: "h-72 bg-dark-muted rounded-lg animate-pulse" }, i)) });
  }
  if (isError || !data) {
    return /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted", children: "Could not load report charts." });
  }
  return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [
    /* @__PURE__ */ jsx(PerformersChart, { data, chartTheme, onOpen: onOpenEvaluation }),
    /* @__PURE__ */ jsx(AnnualLeavesCard, { rows: data.leave_balances ?? [] }),
    /* @__PURE__ */ jsx("div", { className: "lg:col-span-2", children: /* @__PURE__ */ jsx(PendingWorkChart, { people, chartTheme }) })
  ] });
}
function AnnualLeavesCard({ rows }) {
  const year = rows[0]?.year ?? (/* @__PURE__ */ new Date()).getFullYear();
  const through = rows[0]?.through ? format(parseISO(rows[0].through), "MMM d") : null;
  return /* @__PURE__ */ jsx(
    ChartCard,
    {
      title: "Annual leaves",
      description: through ? `${year} allotment \xB7 taken through week ending ${through}` : `${year} allotment \xB7 taken through the current week`,
      children: rows.length === 0 ? /* @__PURE__ */ jsx(EmptyChart, { text: "No people to show." }) : /* @__PURE__ */ jsx("div", { className: "overflow-x-auto -mx-1", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-dark-border text-left", children: [
          /* @__PURE__ */ jsx("th", { className: "px-2 py-2 text-2xs font-medium text-text-muted uppercase tracking-wider", children: "Person" }),
          /* @__PURE__ */ jsx("th", { className: "px-2 py-2 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Assigned" }),
          /* @__PURE__ */ jsx("th", { className: "px-2 py-2 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Taken" }),
          /* @__PURE__ */ jsx("th", { className: "px-2 py-2 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Pending" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: rows.map((row) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-dark-border last:border-0", children: [
          /* @__PURE__ */ jsx("td", { className: "px-2 py-2.5", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 min-w-[120px]", children: [
            /* @__PURE__ */ jsx(Avatar, { name: row.name, size: "sm" }),
            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("p", { className: "font-medium text-text-primary truncate", children: row.name }),
              /* @__PURE__ */ jsx("p", { className: "text-2xs text-text-muted truncate", children: row.departments?.length ? row.departments.join(", ") : "No department" })
            ] })
          ] }) }),
          /* @__PURE__ */ jsx("td", { className: "px-2 py-2.5 text-center tabular-nums text-text-primary", children: formatLeaveDays(row.assigned) }),
          /* @__PURE__ */ jsx("td", { className: "px-2 py-2.5 text-center tabular-nums metric-amber-strong", children: formatLeaveDays(row.taken) }),
          /* @__PURE__ */ jsx("td", { className: "px-2 py-2.5 text-center tabular-nums metric-emerald-strong", children: formatLeaveDays(row.pending) })
        ] }, row.user_id)) })
      ] }) })
    }
  );
}
function chartFirstName(name, taken) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] || name;
  if ((taken.get(first) ?? 0) < 2) return first;
  const last = parts[1];
  return last ? `${first} ${last[0]}` : first;
}
function PendingWorkChart({
  people,
  chartTheme
}) {
  const ranked = people.filter((person) => person.pending > 0).slice().sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));
  const firstCounts = /* @__PURE__ */ new Map();
  ranked.forEach((person) => {
    const first = person.name.trim().split(/\s+/)[0] || person.name;
    firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
  });
  const rows = ranked.map((person) => ({
    name: chartFirstName(person.name, firstCounts),
    fullName: person.name,
    pending: Math.max(0, person.pending - person.overdue),
    overdue: person.overdue
  }));
  return /* @__PURE__ */ jsx(ChartCard, { title: "Who has the most pending work?", description: "Blue = pending \xB7 Red segment = overdue within pending", children: rows.length === 0 ? /* @__PURE__ */ jsx(EmptyChart, { text: "Nobody has pending work." }) : /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: 280, children: /* @__PURE__ */ jsxs(BarChart, { data: rows, margin: { left: 0, right: 8, top: 8 }, children: [
    /* @__PURE__ */ jsx(XAxis, { dataKey: "name", tick: { fill: chartTheme.axisTick, fontSize: 12 }, axisLine: { stroke: chartTheme.axisLine }, tickLine: false }),
    /* @__PURE__ */ jsx(YAxis, { allowDecimals: false, tick: { fill: chartTheme.axisTick, fontSize: 11 }, axisLine: false, tickLine: false, width: 32 }),
    /* @__PURE__ */ jsx(
      Tooltip,
      {
        contentStyle: chartTheme.tooltip,
        cursor: { fill: chartTheme.cursor },
        content: ({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const row = payload[0].payload;
          return /* @__PURE__ */ jsxs("div", { style: chartTheme.tooltip, className: "px-3 py-2", children: [
            /* @__PURE__ */ jsx("p", { children: row.fullName }),
            /* @__PURE__ */ jsxs("p", { children: [
              "Pending ",
              row.pending + row.overdue
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              "Overdue ",
              row.overdue
            ] })
          ] });
        }
      }
    ),
    /* @__PURE__ */ jsx(
      Legend,
      {
        iconType: "square",
        formatter: (value) => /* @__PURE__ */ jsx("span", { style: { color: chartTheme.axisTick }, children: value })
      }
    ),
    /* @__PURE__ */ jsx(Bar, { dataKey: "pending", name: "Pending", stackId: "work", fill: "#3b82f6", maxBarSize: 56 }),
    /* @__PURE__ */ jsx(Bar, { dataKey: "overdue", name: "Overdue", stackId: "work", fill: "#ef4444", maxBarSize: 56, radius: [4, 4, 0, 0] })
  ] }) }) });
}
function PerformersChart({
  data,
  chartTheme,
  onOpen
}) {
  const rows = data.top_performers.map((row) => ({
    ...row,
    label: `${row.name} \xB7 ${periodLabel(row.period_start)} avg`
  }));
  return /* @__PURE__ */ jsx(
    ChartCard,
    {
      title: "Top-Performing Employees",
      description: "Monthly average of finalized period scores. Drafts are not included.",
      children: rows.length === 0 ? /* @__PURE__ */ jsx(EmptyChart, { text: "No finalized evaluations for this period." }) : /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: Math.max(240, rows.length * 36), children: /* @__PURE__ */ jsxs(BarChart, { data: rows, layout: "vertical", margin: { left: 8, right: 24 }, children: [
        /* @__PURE__ */ jsx(XAxis, { type: "number", domain: [0, 100], tick: { fill: chartTheme.axisTick, fontSize: 11 }, axisLine: { stroke: chartTheme.axisLine }, tickLine: false }),
        /* @__PURE__ */ jsx(YAxis, { type: "category", dataKey: "name", width: 120, tick: { fill: chartTheme.axisTick, fontSize: 11 }, axisLine: false, tickLine: false }),
        /* @__PURE__ */ jsx(
          Tooltip,
          {
            contentStyle: chartTheme.tooltip,
            formatter: (value, _name, item) => {
              const row = item.payload;
              const count = row.evaluation_count ?? 1;
              return [
                `${value}/100 \xB7 ${periodLabel(row.period_start)} avg (${count} period${count === 1 ? "" : "s"})`,
                "Monthly avg"
              ];
            }
          }
        ),
        /* @__PURE__ */ jsx(
          Bar,
          {
            dataKey: "score",
            fill: "#a78bfa",
            radius: [0, 4, 4, 0],
            barSize: 16,
            cursor: "pointer",
            onClick: (bar) => {
              const row = bar.payload;
              if (row?.evaluation_id) onOpen(row.evaluation_id);
            }
          }
        )
      ] }) })
    }
  );
}
export {
  OverviewCharts
};
