export const TASK_STATUSES = [
    'to_do',
    'in_progress',
    'blocked',
    'in_review',
    'approved',
    'testing',
    'bugs_found',
    'completed',
    'cancelled',
];
/** Display labels — includes legacy statuses so old records still render cleanly. */
export const STATUS_LABELS = {
    unassigned: 'Unassigned',
    backlog: 'Backlog',
    to_do: 'To Do',
    in_progress: 'In Progress',
    blocked: 'Blocked',
    ready_for_review: 'Review', // legacy → same as in_review
    in_review: 'Review',
    changes_requested: 'Changes Requested',
    approved: 'Approved',
    testing: 'Testing',
    bugs_found: 'Bugs Found',
    completed: 'Completed',
    cancelled: 'Cancelled',
};
/** Compact labels for dense task list / table chips. */
export const STATUS_SHORT_LABELS = {
    unassigned: 'UA',
    backlog: 'Backlog',
    to_do: 'To Do',
    in_progress: 'WIP',
    blocked: 'Blocked',
    ready_for_review: 'Review', // legacy
    in_review: 'Review',
    changes_requested: 'Changes',
    approved: 'Approved',
    testing: 'Testing',
    bugs_found: 'Bugs',
    completed: 'Done',
    cancelled: 'Cancel',
};
export const SELECTABLE_STATUS_OPTIONS = TASK_STATUSES.map((value) => ({
    value,
    label: STATUS_LABELS[value],
}));
/** Include the current status if it is a legacy value so selects don't blank out.
 *  Legacy ready_for_review is shown as Review and maps to in_review as the selectable value. */
export function statusSelectOptions(currentStatus) {
    const options = [...SELECTABLE_STATUS_OPTIONS];
    if (currentStatus
        && !TASK_STATUSES.includes(currentStatus)
        && currentStatus !== 'ready_for_review') {
        return [
            { value: currentStatus, label: STATUS_LABELS[currentStatus] || currentStatus },
            ...options,
        ];
    }
    return options;
}
export const PRIORITY_LABELS = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
};
export const HEALTH_LABELS = {
    healthy: 'Healthy',
    at_risk: 'At Risk',
    delayed: 'Delayed',
    completed: 'Completed',
};
export const USER_STATUSES = ['active', 'on_leave', 'inactive'];
export const USER_STATUS_LABELS = {
    active: 'Active',
    on_leave: 'On Leave',
    inactive: 'Inactive',
};
export const ATTENDANCE_STATUS_LABELS = {
    WFO: 'Work From Office',
    WFH: 'Work From Home',
    LEAVE: 'On Leave',
    HALF_DAY: 'Half Day',
    CAMP: 'Camp/Meeting',
};
export const ATTENDANCE_STATUS_SHORT = {
    WFO: 'WFO',
    WFH: 'WFH',
    LEAVE: 'Leave',
    HALF_DAY: 'Half Day',
    CAMP: 'Camp',
};
