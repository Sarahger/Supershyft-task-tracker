import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { toast } from "../ui/Toast";
import { DailyUpdateEditor } from "../daily-updates/DailyUpdateEditor";
import { tasksApi, usersApi, weeklyUpdatesApi } from "../../services/endpoints";
import { extractMentionedUserIds } from "../../lib/mentions";
import {
  formatDueNoonForApi,
  formatHoursLabel,
  parseWeeklyPlanList,
  toDateInput
} from "../../lib/weeklyPlanParse";
function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
const DUE_DATE_EDIT_MS = 24 * 60 * 60 * 1e3;
function isDueDateLocked(item) {
  if (!item) return false;
  if (typeof item.due_date_locked === "boolean") return item.due_date_locked;
  if (!item.created_at) return false;
  return Date.now() >= new Date(item.created_at).getTime() + DUE_DATE_EDIT_MS;
}
function SubmitWeeklyUpdateForm({
  periodStart,
  existing,
  onClose
}) {
  const qc = useQueryClient();
  const [currentPlanText, setCurrentPlanText] = useState("1. ");
  const [dueDates, setDueDates] = useState({});
  const [revisionReasons, setRevisionReasons] = useState({});
  const [initialized, setInitialized] = useState(false);
  const { data: suggestions } = useQuery({
    queryKey: ["weekly-updates", "suggestions", periodStart],
    queryFn: () => weeklyUpdatesApi.suggestions(periodStart).then((r) => r.data.data)
  });
  const { data: carry } = useQuery({
    queryKey: ["weekly-updates", "carry-forward", periodStart],
    queryFn: () => weeklyUpdatesApi.carryForward(periodStart).then((r) => r.data.data)
  });
  const { data: myTasks } = useQuery({
    queryKey: ["tasks", "my"],
    queryFn: () => tasksApi.my().then((r) => r.data.data ?? [])
  });
  const { data: usersList } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const r = await usersApi.list({ page_size: 100 });
      const items = r.data?.data?.items;
      return Array.isArray(items) ? items : [];
    },
    staleTime: 5 * 60 * 1e3
  });
  const mentionUsers = (usersList ?? []).filter((u) => u.status !== "inactive");
  const currentWeekTasks = carry?.current_week_tasks ?? [
    ...carry?.items ?? [],
    ...(carry?.working_week_ended ? [] : carry?.due_this_week) ?? []
  ];
  const carried = currentWeekTasks.filter(
    (item) => item.is_carried_forward || item.commitment_type === "carried_forward"
  );
  const dueCurrentWeek = currentWeekTasks.filter(
    (item) => !(item.is_carried_forward || item.commitment_type === "carried_forward")
  );
  const structuredTaskIds = new Set(
    currentWeekTasks.map((item) => item.task_id).filter((id) => id != null)
  );
  const structuredTitles = new Set(
    currentWeekTasks.map((item) => item.title.trim().toLowerCase())
  );
  useEffect(() => {
    if (initialized) return;
    if (suggestions === void 0 || carry === void 0) return;
    const planLines = [];
    const dates = {};
    const liveCurrent = carry?.current_week_tasks ?? [
      ...carry?.items ?? [],
      ...(carry?.working_week_ended ? [] : carry?.due_this_week) ?? []
    ];
    const skipIds = new Set(
      liveCurrent.map((item) => item.task_id).filter((id) => id != null)
    );
    const skipTitles = new Set(
      liveCurrent.map((item) => item.title.trim().toLowerCase())
    );
    (existing?.current_week_tasks ?? []).filter((c) => {
      if (c.commitment_type === "carried_forward") return false;
      if (c.task_id && skipIds.has(c.task_id)) return false;
      if (skipTitles.has(c.title.trim().toLowerCase())) return false;
      return true;
    }).forEach((item, i) => {
      const hours = item.estimated_hours != null ? ` (${formatHoursLabel(item.estimated_hours)})` : "";
      planLines.push(`${i + 1}. ${item.title}${hours}`);
      if (item.due_date) dates[`cw-new:${item.title.trim().toLowerCase()}`] = toDateInput(item.due_date);
    });
    setCurrentPlanText(planLines.join("\n") || "1. ");
    setDueDates(dates);
    setInitialized(true);
  }, [initialized, suggestions, carry, existing]);
  const completedTasks = useMemo(() => {
    const rows = [];
    const seenIds = /* @__PURE__ */ new Set();
    for (const item of existing?.completions ?? []) {
      if (item.task_id) {
        if (seenIds.has(item.task_id)) continue;
        seenIds.add(item.task_id);
        rows.push({
          key: `done-${item.task_id}`,
          task_id: item.task_id,
          title: item.title,
          completion_date: item.completion_date,
          estimated_hours: item.estimated_hours,
          source: item.source === "manual" ? "manual" : "suggested",
          is_delayed: item.is_delayed,
          is_carried_forward: item.is_carried_forward
        });
      } else if (item.title) {
        rows.push({
          key: `manual-${item.title}-${rows.length}`,
          task_id: null,
          title: item.title,
          completion_date: item.completion_date,
          estimated_hours: item.estimated_hours,
          source: "manual",
          is_delayed: item.is_delayed,
          is_carried_forward: item.is_carried_forward
        });
      }
    }
    for (const item of suggestions?.items ?? []) {
      if (!item.task_id || seenIds.has(item.task_id)) continue;
      seenIds.add(item.task_id);
      rows.push({
        key: `done-${item.task_id}`,
        task_id: item.task_id,
        title: item.title,
        completion_date: item.completion_date,
        estimated_hours: item.estimated_hours,
        source: "suggested",
        is_delayed: item.is_delayed,
        is_carried_forward: item.is_carried_forward
      });
    }
    return rows;
  }, [existing, suggestions]);
  const parsedCurrentPlan = useMemo(
    () => parseWeeklyPlanList(currentPlanText, { periodStart, weekScope: "current" }),
    [currentPlanText, periodStart]
  );
  const openPlanItems = useMemo(
    () => parsedCurrentPlan.items.filter((item) => !item.alreadyCompleted),
    [parsedCurrentPlan]
  );
  const completedPlanItems = useMemo(
    () => parsedCurrentPlan.items.filter((item) => item.alreadyCompleted),
    [parsedCurrentPlan]
  );
  const completedViaPlanIds = useMemo(() => {
    const ids = /* @__PURE__ */ new Set();
    for (const item of completedPlanItems) {
      const titleKey = item.title.trim().toLowerCase();
      const weekMatch = currentWeekTasks.find((t) => t.title.trim().toLowerCase() === titleKey);
      if (weekMatch?.task_id) {
        ids.add(weekMatch.task_id);
        continue;
      }
      const trackerMatch = (myTasks ?? []).find((t) => t.title.trim().toLowerCase() === titleKey);
      if (trackerMatch?.id) ids.add(trackerMatch.id);
    }
    return ids;
  }, [completedPlanItems, currentWeekTasks, myTasks]);
  const mutation = useMutation({
    mutationFn: async () => {
      const today = format(/* @__PURE__ */ new Date(), "yyyy-MM-dd");
      const completions = [];
      const seen = /* @__PURE__ */ new Set();
      for (const task of completedTasks) {
        if (task.task_id) {
          if (seen.has(task.task_id)) continue;
          seen.add(task.task_id);
        }
        completions.push({
          key: task.key,
          task_id: task.task_id ?? null,
          title: task.title,
          completion_date: task.completion_date || today,
          estimated_hours: task.estimated_hours,
          source: task.source,
          included: true
        });
      }
      for (const item of completedPlanItems) {
        if (!item.title.trim()) continue;
        const titleKey = item.title.trim().toLowerCase();
        const weekMatch = currentWeekTasks.find((t) => t.title.trim().toLowerCase() === titleKey);
        const trackerMatch = (myTasks ?? []).find((t) => t.title.trim().toLowerCase() === titleKey);
        const existingMatch = completedTasks.find((t) => t.title.trim().toLowerCase() === titleKey);
        const matchId = weekMatch?.task_id ?? trackerMatch?.id ?? existingMatch?.task_id ?? null;
        if (matchId && seen.has(matchId)) continue;
        if (!matchId) {
          if (item.missingEffort || item.estimatedHours == null) {
            throw new Error(`Add time taken for \u201C${item.title}\u201D, e.g. #3h`);
          }
        }
        const hours = item.estimatedHours ?? weekMatch?.estimated_hours ?? trackerMatch?.estimated_hours ?? existingMatch?.estimated_hours ?? null;
        completions.push({
          key: newKey(),
          task_id: matchId,
          title: weekMatch?.title ?? trackerMatch?.title ?? item.title,
          completion_date: item.completionDate || today,
          estimated_hours: hours,
          source: matchId ? "suggested" : "manual",
          included: true
        });
        if (matchId) seen.add(matchId);
      }
      const trackerDraft = (item, kind, prefix) => {
        if (item.task_id && completedViaPlanIds.has(item.task_id)) return null;
        const key = `${prefix}-${item.task_id}`;
        const currentDue = toDateInput(item.due_date);
        const nextDue = dueDates[key] || currentDue;
        return {
          key,
          task_id: item.task_id,
          title: item.title,
          description: item.description ?? "",
          estimated_hours: item.estimated_hours != null ? String(item.estimated_hours) : "",
          due_date: nextDue,
          commitment_type: kind,
          revision_reason: nextDue && currentDue && nextDue !== currentDue ? revisionReasons[key] || "" : "",
          is_overdue: item.is_overdue,
          original_due_date: item.original_due_date
        };
      };
      const typedDraft = (item) => {
        const match = (myTasks ?? []).find((t) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
        if (match && structuredTaskIds.has(match.id)) return null;
        if (match && completedViaPlanIds.has(match.id)) return null;
        if (structuredTitles.has(item.title.trim().toLowerCase())) return null;
        const key = `cw-new:${item.title.trim().toLowerCase()}`;
        const nextDue = dueDates[key] || item.dueDate || "";
        const currentDue = match ? toDateInput(match.due_date) : "";
        return {
          key: `cw-new-${item.title}`,
          task_id: match?.id ?? null,
          title: item.title,
          description: "",
          estimated_hours: item.estimatedHours != null ? String(item.estimatedHours) : "",
          due_date: nextDue,
          commitment_type: match ? "existing" : "new",
          revision_reason: match && currentDue && nextDue && nextDue !== currentDue ? revisionReasons[key] || "" : ""
        };
      };
      const plan = [
        ...carried.map((item) => trackerDraft(item, "carried_forward", "cf")),
        ...dueCurrentWeek.map((item) => trackerDraft(item, "existing", "cw")),
        ...openPlanItems.map((item) => typedDraft(item)).filter((item) => item != null)
      ].filter((item) => item != null);
      for (const item of plan) {
        if (!item.title.trim()) continue;
        if (!item.due_date) throw new Error(`Add a due date for \u201C${item.title}\u201D`);
        const hours = Number(item.estimated_hours);
        if (!hours || hours <= 0) throw new Error(`Add time required for \u201C${item.title}\u201D`);
        const source = item.commitment_type === "carried_forward" ? carried.find((c) => c.task_id === item.task_id) : dueCurrentWeek.find((c) => c.task_id === item.task_id) ?? (myTasks ?? []).find((t) => t.id === item.task_id) ?? existing?.commitments.find((c) => c.task_id === item.task_id || c.title.trim().toLowerCase() === item.title.trim().toLowerCase());
        const previousDue = item.commitment_type === "carried_forward" ? toDateInput(carried.find((c) => c.task_id === item.task_id)?.due_date) : toDateInput(
          dueCurrentWeek.find((c) => c.task_id === item.task_id)?.due_date ?? (myTasks ?? []).find((t) => t.id === item.task_id)?.due_date ?? existing?.commitments.find((c) => c.title.trim().toLowerCase() === item.title.trim().toLowerCase())?.due_date
        );
        if (previousDue && item.due_date !== previousDue && isDueDateLocked(source) && !item.revision_reason.trim()) {
          throw new Error(`Add a reason for changing the due date of \u201C${item.title}\u201D`);
        }
      }
      const mentionSource = [currentPlanText, ...completions.map((c) => c.title), ...plan.map((c) => c.title)].join("\n");
      return weeklyUpdatesApi.upsert({
        period_start: periodStart,
        mentioned_user_ids: extractMentionedUserIds(mentionSource, mentionUsers),
        completions: completions.map((c) => ({
          task_id: c.task_id ?? null,
          title: c.title.trim(),
          completion_date: c.completion_date || null,
          estimated_hours: c.estimated_hours ?? null,
          source: c.source,
          included: c.included
        })),
        commitments: plan.filter((c) => c.title.trim()).map((c) => ({
          task_id: c.task_id ?? null,
          title: c.title.trim(),
          description: c.description.trim() || null,
          estimated_hours: Number(c.estimated_hours),
          due_date: formatDueNoonForApi(c.due_date),
          commitment_type: c.commitment_type,
          revision_reason: c.revision_reason.trim() || null
        }))
      });
    },
    onSuccess: (res) => {
      const errors = res.data.data?.create_errors ?? [];
      if (errors.length) {
        toast.error(`Saved, but ${errors.length} task${errors.length === 1 ? "" : "s"} failed to create. Retry to finish those only.`);
      } else {
        toast.success("Weekly update submitted");
      }
      qc.invalidateQueries({ queryKey: ["weekly-updates"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (err) => {
      const detail = err?.response?.data;
      toast.error(
        typeof detail?.detail === "string" && detail.detail || detail?.message || err.message || "Could not submit weekly update"
      );
    }
  });
  const visibleCarried = carried.filter((item) => !(item.task_id && completedViaPlanIds.has(item.task_id)));
  const visibleDueCurrent = dueCurrentWeek.filter((item) => !(item.task_id && completedViaPlanIds.has(item.task_id)));
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxs("header", { className: "flex items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-medium text-text-primary", children: "Write weekly update" }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-text-muted mt-0.5", children: [
          "Week of ",
          carry?.period_start && carry?.period_end ? `${format(parseISO(carry.period_start), "d MMM")} \u2013 ${format(parseISO(carry.period_end), "d MMM yyyy")}` : format(parseISO(periodStart), "d MMM yyyy"),
          " \xB7 Type @ to tag someone"
        ] })
      ] }),
      /* @__PURE__ */ jsx("button", { type: "button", onClick: onClose, className: "text-sm text-text-muted hover:text-text-secondary", children: "Cancel" })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "space-y-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h3", { className: "text-sm font-medium text-text-primary", children: "Weekly Tasks" }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-text-muted mt-0.5", children: [
          "Incomplete tasks due this working week, including carried-forward work. Add new ones below \u2014 they are saved in the Task Tracker. Add ",
          /* @__PURE__ */ jsx("span", { className: "text-text-secondary", children: "*completed" }),
          " on a line to move it to Completed Tasks (uses today's date). Yellow means carried forward from an earlier week."
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-dark-border px-3 py-2 space-y-2", children: [
        visibleCarried.length === 0 && visibleDueCurrent.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted", children: "No tasks yet" }) : null,
        visibleCarried.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-3", children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-amber-400", children: "Carried forward" }),
          /* @__PURE__ */ jsxs("p", { className: "text-2xs text-text-muted", children: [
            /* @__PURE__ */ jsx("span", { className: "text-amber-400", children: "Yellow" }),
            " = carried forward"
          ] })
        ] }),
        visibleCarried.map((item) => {
          const key = `cf-${item.task_id}`;
          const currentDue = toDateInput(item.due_date);
          const nextDue = dueDates[key] || currentDue;
          const dateChanged = Boolean(nextDue && currentDue && nextDue !== currentDue);
          const locked = isDueDateLocked(item);
          const needsRevision = dateChanged && locked;
          return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxs("div", { className: "grid sm:grid-cols-[1fr_140px] gap-2 items-center", children: [
              /* @__PURE__ */ jsxs("p", { className: "text-sm text-amber-400", children: [
                item.title,
                item.is_overdue && /* @__PURE__ */ jsx("span", { className: "ml-2 text-2xs text-accent-danger", children: "Overdue" })
              ] }),
              /* @__PURE__ */ jsx(
                Input,
                {
                  label: needsRevision ? "Revised due date" : void 0,
                  type: "date",
                  value: nextDue,
                  onChange: (e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value })),
                  error: !nextDue ? "Required" : void 0
                }
              )
            ] }),
            needsRevision && /* @__PURE__ */ jsx(
              Input,
              {
                label: "Reason for changing",
                value: revisionReasons[key] || "",
                onChange: (e) => setRevisionReasons((prev) => ({ ...prev, [key]: e.target.value })),
                placeholder: "Why is the due date changing?",
                error: !revisionReasons[key]?.trim() ? "Required when changing the due date" : void 0
              }
            )
          ] }, `cf-${item.task_id ?? item.title}`);
        }),
        visibleDueCurrent.length > 0 && /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-text-secondary pt-1", children: "Due this week" }),
        visibleDueCurrent.map((item) => {
          const key = `cw-${item.task_id}`;
          const currentDue = toDateInput(item.due_date);
          const nextDue = dueDates[key] || currentDue;
          const dateChanged = Boolean(nextDue && currentDue && nextDue !== currentDue);
          const locked = isDueDateLocked(item);
          const needsRevision = dateChanged && locked;
          return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxs("div", { className: "grid sm:grid-cols-[1fr_auto_140px] gap-2 items-center", children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm text-text-primary", children: item.title }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted", children: item.estimated_hours != null ? formatHoursLabel(item.estimated_hours) : "Add time required" }),
              /* @__PURE__ */ jsx(
                Input,
                {
                  label: needsRevision ? "Revised due date" : void 0,
                  type: "date",
                  value: nextDue,
                  onChange: (e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value })),
                  error: !nextDue ? "Required" : void 0
                }
              )
            ] }),
            item.estimated_hours == null && /* @__PURE__ */ jsx("p", { className: "text-2xs text-accent-danger", children: "Add time required on this task" }),
            needsRevision && /* @__PURE__ */ jsx(
              Input,
              {
                label: "Reason for changing",
                value: revisionReasons[key] || "",
                onChange: (e) => setRevisionReasons((prev) => ({ ...prev, [key]: e.target.value })),
                placeholder: "Why is the due date changing?",
                error: !revisionReasons[key]?.trim() ? "Required when changing the due date" : void 0
              }
            )
          ] }, `cw-${item.task_id ?? item.title}`);
        })
      ] }),
      /* @__PURE__ */ jsx(
        DailyUpdateEditor,
        {
          value: currentPlanText,
          onChange: setCurrentPlanText,
          users: mentionUsers,
          showExtras: false,
          numberedList: true,
          placeholder: "Finish onboarding flow /friday #3h\nShip docs #2h *completed"
        }
      ),
      completedPlanItems.length > 0 && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-xs font-medium text-text-secondary", children: [
          completedPlanItems.length,
          " item",
          completedPlanItems.length === 1 ? "" : "s",
          " marked *completed \u2014 will move to Completed Tasks with today's date."
        ] }),
        completedPlanItems.map((item) => /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm text-text-primary", children: item.title }),
            item.missingEffort && /* @__PURE__ */ jsx("p", { className: "text-2xs text-accent-danger", children: "Add time taken, e.g. #3h or #3hr" })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "shrink-0 text-xs tabular-nums text-text-muted pt-0.5", children: [item.timeLabel, item.completionDate ? format(parseISO(item.completionDate), "d MMM") : null].filter(Boolean).join(" \xB7 ") })
        ] }, item.rawLine))
      ] }),
      openPlanItems.length > 0 && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-text-secondary", children: "Review due dates" }),
        openPlanItems.map((item) => {
          const key = `cw-new:${item.title.trim().toLowerCase()}`;
          const due = dueDates[key] || item.dueDate || "";
          const match = (myTasks ?? []).find((t) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
          const existingItem = existing?.commitments.find((c) => c.title.trim().toLowerCase() === item.title.trim().toLowerCase());
          const currentDue = toDateInput(match?.due_date || existingItem?.due_date);
          const dateChanged = Boolean((match || existingItem) && currentDue && due && due !== currentDue);
          const locked = isDueDateLocked(match ?? existingItem);
          const needsRevision = dateChanged && locked;
          return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxs("div", { className: "grid sm:grid-cols-[1fr_auto_140px] gap-2 items-start", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm text-text-primary", children: item.title }),
                item.missingEffort && /* @__PURE__ */ jsx("p", { className: "text-2xs text-accent-danger", children: "Add time required in the list, e.g. #3h or (4hrs)" })
              ] }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-text-muted pt-2", children: item.timeLabel || formatHoursLabel(item.estimatedHours) }),
              /* @__PURE__ */ jsx(
                Input,
                {
                  label: needsRevision ? "Revised due date" : void 0,
                  type: "date",
                  value: due,
                  onChange: (e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value })),
                  error: !due ? "Required" : void 0
                }
              )
            ] }),
            needsRevision && /* @__PURE__ */ jsx(
              Input,
              {
                label: "Reason for changing",
                value: revisionReasons[key] || "",
                onChange: (e) => setRevisionReasons((prev) => ({ ...prev, [key]: e.target.value })),
                placeholder: "Why is the due date changing?",
                error: !revisionReasons[key]?.trim() ? "Required when changing the due date" : void 0
              }
            )
          ] }, key);
        })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "space-y-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h3", { className: "text-sm font-medium text-text-primary", children: "Completed Tasks" }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-text-muted mt-0.5", children: [
          "Tasks completed this week (view only). Mark new completions in Weekly Tasks with ",
          /* @__PURE__ */ jsx("span", { className: "text-text-secondary", children: "*completed" }),
          "."
        ] })
      ] }),
      completedTasks.length > 0 ? /* @__PURE__ */ jsx("ol", { className: "space-y-1", children: completedTasks.map((task, i) => {
        const timeLabel = task.estimated_hours != null ? formatHoursLabel(task.estimated_hours) : null;
        const doneLabel = task.completion_date ? format(parseISO(task.completion_date), "d MMM") : null;
        const delayed = Boolean(task.is_delayed || task.is_carried_forward);
        return /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2", children: [
          /* @__PURE__ */ jsxs("span", { className: "text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5", children: [
            i + 1,
            "."
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 flex items-start justify-between gap-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[15px] leading-relaxed text-text-primary", children: task.title }),
            timeLabel || doneLabel ? /* @__PURE__ */ jsxs("p", { className: "shrink-0 text-xs tabular-nums pt-1 text-right text-text-muted", children: [
              timeLabel,
              timeLabel && doneLabel ? " \xB7 " : null,
              doneLabel ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx("span", { className: delayed ? "text-amber-400" : void 0, children: "Completed" }),
                " ",
                doneLabel
              ] }) : null
            ] }) : null
          ] })
        ] }, task.key);
      }) }) : /* @__PURE__ */ jsx("p", { className: "text-sm text-text-muted", children: "No tasks yet" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex justify-end gap-2", children: [
      /* @__PURE__ */ jsx(Button, { type: "button", variant: "ghost", onClick: onClose, children: "Cancel" }),
      /* @__PURE__ */ jsx(Button, { type: "button", loading: mutation.isPending, onClick: () => mutation.mutate(), children: "Submit weekly update" })
    ] })
  ] });
}
export {
  SubmitWeeklyUpdateForm
};
