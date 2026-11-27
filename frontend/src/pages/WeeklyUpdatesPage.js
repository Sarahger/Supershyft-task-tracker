import { jsx as _jsx } from "react/jsx-runtime";
import { WeeklyUpdatesPanel } from '../components/weekly-updates/WeeklyUpdatesPanel';
export default function WeeklyUpdatesPage() {
    return (_jsx("div", { className: "w-full h-[calc(100dvh-5.25rem)] overflow-hidden max-md:h-auto max-md:overflow-visible max-md:pb-12", children: _jsx(WeeklyUpdatesPanel, {}) }));
}
