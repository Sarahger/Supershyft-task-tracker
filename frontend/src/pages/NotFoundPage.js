import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
export default function NotFoundPage() {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center min-h-[60vh] text-center", children: [_jsx("h1", { className: "text-6xl font-semibold text-text-muted", children: "404" }), _jsx("p", { className: "text-lg text-text-secondary mt-4", children: "Page not found" }), _jsx(Link, { to: "/", className: "mt-6", children: _jsx(Button, { children: "Go to Dashboard" }) })] }));
}
