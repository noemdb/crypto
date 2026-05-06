"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetMonitoringData } from "@/lib/actions/scanner.actions";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";

export function DangerZone() {
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const handleReset = async () => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setIsPending(true);
    try {
      const result = await resetMonitoringData();
      if (result.success) {
        toast.success("Todos los datos de monitoreo han sido eliminados.");
        setIsConfirming(false);
      } else {
        toast.error(`Error: ${result.error}`);
      }
    } catch (error) {
      toast.error("Ocurrió un error inesperado al reiniciar los datos.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Zona de Peligro
        </CardTitle>
        <CardDescription>
          Acciones irreversibles sobre los datos del sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-medium">Reiniciar datos de monitoreo</h4>
            <p className="text-xs text-muted-foreground">
              Elimina todos los snapshots, oportunidades y alertas registradas.
            </p>
          </div>
          <Button
            variant={isConfirming ? "destructive" : "outline"}
            size="sm"
            onClick={handleReset}
            disabled={isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? "Procesando..." : isConfirming ? "Confirmar Eliminación" : "Reiniciar Datos"}
          </Button>
        </div>
        
        {isConfirming && (
          <div className="flex items-center gap-2 text-xs text-destructive animate-in fade-in slide-in-from-top-1">
            <AlertTriangle className="h-3 w-3" />
            Esta acción no se puede deshacer. Haz clic de nuevo para confirmar.
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
