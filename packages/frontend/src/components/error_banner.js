import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Banner de error inline con opción de cerrar
export const ErrorBanner = ({ message, onDismiss }) => {
    return (_jsxs("div", { className: "error-banner", role: "alert", "aria-live": "assertive", children: [_jsx("span", { className: "error-banner__icon", "aria-hidden": "true", children: "\u26A0\uFE0F" }), _jsx("p", { className: "error-banner__message", children: message }), onDismiss && (_jsx("button", { className: "error-banner__dismiss", onClick: onDismiss, "aria-label": "Cerrar error", children: "\u2715" }))] }));
};
