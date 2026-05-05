"use client";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="bg-background text-foreground antialiased p-8">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Error Crítico del Sistema</h2>
          <p className="text-muted-foreground">{error.message || "Ha ocurrido un error inesperado."}</p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            Intentar nuevamente
          </button>
        </div>
      </body>
    </html>
  );
}
