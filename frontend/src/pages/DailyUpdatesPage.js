import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DailyUpdatesPanel } from '../components/daily-updates/DailyUpdatesPanel';
export default function DailyUpdatesPage() {
    return (_jsxs("div", { className: "w-full pb-12", children: [_jsxs("header", { className: "mb-8", children: [_jsx("h1", { className: "text-xl font-semibold text-text-primary", children: "Daily Updates" }), _jsx("p", { className: "text-sm text-text-muted mt-0.5", children: "Share what got done and browse everyone\u2019s updates. Editable until 10:30 AM the next morning." })] }), _jsx(DailyUpdatesPanel, { hideIntro: true })] }));
}
