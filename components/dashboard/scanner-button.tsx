"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play } from "lucide-react";
import { runManualScan } from "@/lib/actions/scanner.actions";
import { toast } from "sonner";

export function ScannerButton() {
  const [isPending, setIsPending] = React.useState(false);

  const handleScan = async () => {
    if (isPending) return;

    setIsPending(true);
    const toastId = toast.loading("Iniciando escaneo de mercados...");

    try {
      const result = await runManualScan();

      if (result.success) {
        toast.success(`Escaneo completado. Se procesaron ${result.data?.evaluatedPairs} pares en ${result.data?.durationMs}ms.`, {
          id: toastId,
        });
      } else {
        toast.error(`Error: ${result.error}`, { id: toastId });
      }
    } catch (error) {
      toast.error("Error inesperado al ejecutar el escaneo", { id: toastId });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      onClick={handleScan}
      disabled={isPending}
      variant="outline"
      size="sm"
      className="gap-2 bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary transition-all duration-300"
    >
      {isPending ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Play className="h-4 w-4 fill-current" />
      )}
      {isPending ? "Escaneando..." : "Ejecutar Escáner"}
    </Button>
  );
}
