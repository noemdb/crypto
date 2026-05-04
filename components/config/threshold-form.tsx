"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { UserConfigFormSchema } from "@/lib/schemas";
import type { UserConfigFormInput } from "@/lib/schemas";
import { updateUserConfig } from "@/lib/actions/config.actions";
import { useDashboardStore } from "@/lib/store/dashboard.store";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  initialConfig: UserConfigFormInput;
};

export function ThresholdForm({ initialConfig }: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const { addNotification } = useDashboardStore();

  const form = useForm<UserConfigFormInput>({
    resolver: zodResolver(UserConfigFormSchema) as any,
    defaultValues: initialConfig,
  });

  async function onSubmit(values: UserConfigFormInput) {
    setStatus("saving");
    const result = await updateUserConfig(values);

    if (result.success) {
      setStatus("saved");
      addNotification({ message: "Configuración guardada", type: "success" });
      form.reset(values);
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
      form.setError("root", { message: result.error });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            name="minROI"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ROI Mínimo (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Solo se alertan oportunidades con ROI ajustado ≥ este valor.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="capitalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capital (USD)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="100"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Monto base para calcular ROI y evaluar liquidez.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="minFillProbability"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fill Probability Mínima</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  0.0 – 1.0. Umbral de fill en P2P.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="alertDedupeWindowMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ventana de Deduplicación (min)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Evita alertas repetidas para la misma ruta en este tiempo.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={status === "saving"}
          >
            Resetear
          </Button>
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
