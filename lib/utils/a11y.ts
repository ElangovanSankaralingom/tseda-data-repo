/**
 * Dev-only accessibility audit via @axe-core/react.
 * Import this file from a client-side entrypoint (e.g., providers.tsx)
 * to get a11y violation warnings in the browser console during development.
 */
export function initAxeA11y() {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "development") return;

  void import("@axe-core/react").then((axe) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require("react");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactDOM = require("react-dom");
    axe.default(React, ReactDOM, 1000);
  });
}
