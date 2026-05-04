"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportOpportunities } from "@/lib/actions/export.actions";
import { Download } from "lucide-react";

export function ExportButton({ classification }: { classification?: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  async function handleExport() {
    setStatus("loading");
    const result = await exportOpportunities(classification);

    if (result.success) {
      // Disparar descarga abriendo la URL de UploadThing
      window.open(result.downloadUrl, "_blank");
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      console.error("[export] error:", result.error);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={status === "loading"}
    >
      <Download className="w-3.5 h-3.5 mr-1.5" />
      {status === "loading"
        ? "Exportando..."
        : status === "done"
          ? "✓ Listo"
          : status === "error"
            ? "Error"
            : "Exportar CSV"}
    </Button>
  );
}
