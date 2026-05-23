import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="flex h-[80vh] w-full items-center justify-center animate-in fade-in duration-300">
      <Card className="w-[280px] shadow-lg border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="relative flex items-center justify-center">
            {/* Logo o elemento visual */}
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <Loader2 className="h-10 w-10 text-primary animate-spin relative z-10" />
          </div>
          <div className="space-y-1 text-center">
            <h3 className="font-medium text-sm">Cargando datos</h3>
            <p className="text-xs text-muted-foreground">Por favor espera un momento...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
