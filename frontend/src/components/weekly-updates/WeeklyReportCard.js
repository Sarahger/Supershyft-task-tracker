import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import clsx from "clsx";
import { format, parseISO } from "date-fns";
import { useTaskDrawer } from "../../contexts/TaskDrawerContext";
import { isMentionPart, splitCommentMentions } from "../../lib/mentions";
import { formatHoursLabel, mondayOf, toDateInput } from "../../lib/weeklyPlanParse";
import { Avatar } from "../ui/Avatar";
function formatRange(start, end) {
  return `${format(parseISO(start), "d MMM")} \u2013 ${format(parseISO(end), "d MMM yyyy")}`;
}
function weekKindLabel(report) {
  if (report.is_current) return "Current week";
  try {
    const todayMonday = format(mondayOf(/* @__PURE__ */ new Date()), "yyyy-MM-dd");
    return report.period_start > todayMonday ? "Upcoming week" : "Earlier week";
  } catch {
    return "Earlier week";
  }
}
function formatShortDate(value) {
  if (!value) return null;
  try {
    return format(parseISO(value), "d MMM");
  } catch {
    return null;
  }
}
function leaveSummary(ctx) {
  if (!ctx) return [];
  const items = [
    ...ctx.leave_days.map((d) => `${d.label} ${formatShortDate(d.date) ?? d.date}`),
    ...ctx.holidays.filter((h) => h.kind === "holiday").map((d) => `${d.label} ${formatShortDate(d.date) ?? d.date}`)
  ];
  return items;
}
function hasRevisedDue(item) {
  if (item.deadline_revisions && item.deadline_revisions.length > 0) return true;
  if (!item.original_due_date || !item.due_date) return false;
  return toDateInput(item.original_due_date) !== toDateInput(item.due_date);
}
function MentionText({ text }) {
  return /* @__PURE__ */ jsx(Fragment, { children: splitCommentMentions(text).map(
    (part, i) => isMentionPart(part) ? /* @__PURE__ */ jsx("span", { className: "text-accent-primary font-medium", children: part }, i) : /* @__PURE__ */ jsx("span", { children: part }, i)
  ) });
}
function TaskTitle({
  title,
  taskId,
  className
}) {
  const { openTask } = useTaskDrawer();
  const textClass = clsx("text-[15px] leading-relaxed text-left", className ?? "text-text-primary");
  if (taskId) {
    return /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => openTask(taskId),
        className: clsx(textClass, "hover:underline"),
        children: /* @__PURE__ */ jsx(MentionText, { text: title })
      }
    );
  }
  return /* @__PURE__ */ jsx("p", { className: textClass, children: /* @__PURE__ */ jsx(MentionText, { text: title }) });
}
function metaLine(timeLabel, dateLabel, datePrefix) {
  return [timeLabel, dateLabel ? `${datePrefix} ${dateLabel}` : null].filter(Boolean).join(" \xB7 ");
}
function CompletionRow({ item, index }) {
  const timeLabel = item.estimated_hours != null ? formatHoursLabel(item.estimated_hours) : null;
  const doneLabel = formatShortDate(item.completion_date || item.completed_at);
  const delayed = Boolean(item.is_delayed || item.is_carried_forward);
  const revised = hasRevisedDue(item);
  const dueLabel = formatShortDate(item.due_date || item.original_due_date);
  const duePrefix = revised ? "Revised due" : "Due";
  return /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2 py-1", children: [
    /* @__PURE__ */ jsxs("span", { className: "text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5", children: [
      index,
      "."
    ] }),
    /* @__PURE__ */ jsx("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-1 md:gap-4", children: [
      /* @__PURE__ */ jsx(TaskTitle, { title: item.title, taskId: item.task_id, className: "text-text-primary" }),
      timeLabel || doneLabel || dueLabel ? /* @__PURE__ */ jsxs("p", { className: "text-xs tabular-nums text-text-muted md:pt-1 md:text-right md:shrink-0", children: [
        timeLabel,
        timeLabel && (doneLabel || dueLabel) ? " \xB7 " : null,
        dueLabel ? /* @__PURE__ */ jsxs(Fragment, { children: [
          duePrefix,
          " ",
          dueLabel,
          doneLabel ? " \xB7 " : null
        ] }) : null,
        doneLabel ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: delayed ? "text-amber-400" : void 0, children: "Completed" }),
          " ",
          doneLabel
        ] }) : null
      ] }) : null
    ] }) })
  ] });
}
function CommitmentRow({
  item,
  index,
  onRevise,
  freezeCarriedForward
}) {
  const revised = hasRevisedDue(item);
  const latestRevision = item.deadline_revisions?.[item.deadline_revisions.length - 1];
  const dueLabel = formatShortDate(latestRevision?.new_due_date || item.due_date);
  const timeLabel = item.estimated_hours != null ? formatHoursLabel(item.estimated_hours) : null;
  const latestReason = latestRevision?.reason;
  const carried = freezeCarriedForward ? item.commitment_type === "carried_forward" : Boolean(item.is_carried_forward || item.commitment_type === "carried_forward");
  const meta = metaLine(timeLabel, dueLabel, revised ? "Revised due" : "Due");
  return /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2 py-1", children: [
    /* @__PURE__ */ jsxs("span", { className: "text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5", children: [
      index,
      "."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-1 md:gap-4", children: [
        /* @__PURE__ */ jsx(
          TaskTitle,
          {
            title: item.title,
            taskId: item.task_id,
            className: carried ? "text-amber-400" : void 0
          }
        ),
        meta ? /* @__PURE__ */ jsx("p", { className: "text-xs tabular-nums text-text-muted md:pt-1 md:text-right md:shrink-0", children: meta }) : null
      ] }),
      revised && latestReason && /* @__PURE__ */ jsx("p", { className: "text-2xs text-text-muted mt-0.5", children: latestReason }),
      item.is_overdue && item.task_id && onRevise && /* @__PURE__ */ jsx("button", { type: "button", onClick: () => onRevise(item), className: "text-xs text-accent-primary mt-1", children: "Add reason and revised deadline" })
    ] })
  ] });
}
function TaskSection({
  title,
  emptyLabel,
  items,
  onRevise,
  freezeCarriedForward
}) {
  return /* @__PURE__ */ jsxs("section", { className: "space-y-1", children: [
    /* @__PURE__ */ jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: title }),
    items.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted", children: emptyLabel }) : /* @__PURE__ */ jsx("ol", { children: items.map((item, i) => /* @__PURE__ */ jsx(
      CommitmentRow,
      {
        item,
        index: i + 1,
        onRevise,
        freezeCarriedForward
      },
      `${item.task_id ?? item.title}-${i}`
    )) })
  ] });
}
function WeeklyReportCard({
  report,
  author,
  onRevise,
  onEdit,
  actionLabel = "Edit"
}) {
  const person = author ?? report.author;
  const personName = person ? `${person.first_name} ${person.last_name}`.trim() : "Weekly update";
  const thisWeekLeave = leaveSummary(report.leave);
  const freezeCarriedForward = !report.editable;
  const currentWeekTasks = report.current_week_tasks ?? [];
  const hasDelayed = report.completions.some((item) => item.is_delayed || item.is_carried_forward) || currentWeekTasks.some(
    (item) => freezeCarriedForward ? item.commitment_type === "carried_forward" : Boolean(item.is_carried_forward || item.commitment_type === "carried_forward")
  );
  return /* @__PURE__ */ jsxs(
    "article",
    {
      id: `week-${report.period_start}`,
      className: "min-w-0 rounded-2xl border border-dark-border bg-dark-card p-5 sm:p-6 space-y-4",
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: [
              weekKindLabel(report),
              !report.editable ? " \xB7 Locked" : null
            ] }),
            /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-text-primary mt-0.5", children: formatRange(report.period_start, report.period_end) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-end gap-1 shrink-0", children: [
            onEdit && /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onEdit,
                className: "rounded-lg border border-dark-border bg-dark-elevated px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-dark-hover transition-colors",
                children: actionLabel
              }
            ),
            hasDelayed && /* @__PURE__ */ jsxs("p", { className: "text-2xs text-text-muted", children: [
              /* @__PURE__ */ jsx("span", { className: "text-amber-400", children: "Yellow" }),
              " = delayed / carried forward"
            ] })
          ] })
        ] }),
        person && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(Avatar, { name: personName, size: "sm", src: person.profile_picture ?? void 0 }),
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-text-primary truncate", children: personName })
        ] }),
        /* @__PURE__ */ jsx(
          TaskSection,
          {
            title: "Weekly Tasks",
            emptyLabel: "No tasks yet",
            items: currentWeekTasks,
            onRevise,
            freezeCarriedForward
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "border-t border-dark-border" }),
        /* @__PURE__ */ jsxs("section", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: "Completed Tasks" }),
          report.completions.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted", children: "No tasks yet" }) : /* @__PURE__ */ jsx("ol", { className: "space-y-1", children: report.completions.map((item, i) => /* @__PURE__ */ jsx(
            CompletionRow,
            {
              item,
              index: i + 1
            },
            `${item.task_id ?? item.title}-${i}`
          )) })
        ] }),
        thisWeekLeave.length > 0 && /* @__PURE__ */ jsx("footer", { className: "text-xs text-text-muted space-y-0.5", children: /* @__PURE__ */ jsx("p", { children: thisWeekLeave.join(" \xB7 ") }) })
      ]
    }
  );
}
export {
  WeeklyReportCard
};
