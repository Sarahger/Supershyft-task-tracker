import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
export class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { error: null }
        });
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    render() {
        if (this.state.error) {
            return (_jsxs("div", { style: { padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 560 }, children: [_jsx("h1", { style: { fontSize: 18, marginBottom: 8 }, children: "Something went wrong" }), _jsx("p", { style: { color: '#666', marginBottom: 16 }, children: "The app crashed while loading. Try refreshing the page." }), _jsx("pre", { style: { background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12 }, children: this.state.error.message }), _jsx("button", { type: "button", onClick: () => window.location.reload(), style: { marginTop: 16, padding: '8px 16px', cursor: 'pointer' }, children: "Reload" })] }));
        }
        return this.props.children;
    }
}
