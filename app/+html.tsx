/**
 * Web document shell (static export only).
 *
 * Loads the SQLite WebAssembly engine from /public before the app boots, so the
 * browser build runs the exact same SQL schema as Android.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#F7F6FB" />
        <meta
          name="description"
          content="Notely — an offline-first smart notebook and document editor."
        />
        <title>Notely</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
        <script src="/sql.js" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}

const GLOBAL_CSS = `
  html, body, #root { height: 100%; }
  body { background-color: #F7F6FB; overscroll-behavior-y: none; }
  /* Match the app's font while custom fonts are still loading. */
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  ::selection { background: rgba(124, 58, 237, 0.22); }
`;
