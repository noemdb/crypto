"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { UserConfigFormSchema } from "@/lib/schemas";
import type { UserConfigFormInput } from "@/lib/schemas";
import { updateUserConfig, testTelegramAlert } from "@/lib/actions/config.actions";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
} from "lucide-react";

// ─── Platform meta ────────────────────────────────────────────────────────────

type PlatformMeta = {
  id: string;
  label: string;
  tag: string;
  color: string;
};

const PLATFORMS: PlatformMeta[] = [
  { id: "binance_spot",    label: "Binance Spot",       tag: "SPOT",  color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  { id: "bybit_spot",      label: "Bybit Spot",         tag: "SPOT",  color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  { id: "mexc_spot",       label: "MEXC Spot (0%)",     tag: "SPOT",  color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { id: "okx_spot",        label: "OKX Spot",           tag: "SPOT",  color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { id: "binance_p2p_ves", label: "Binance P2P (VES)",  tag: "P2P",   color: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  { id: "bybit_p2p_ves",   label: "Bybit P2P (VES)",    tag: "P2P",   color: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  { id: "airtm",           label: "AirTM",              tag: "FIAT",  color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  { id: "kontigo",         label: "Kontigo",            tag: "FIAT",  color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
];

const ASSETS = ["USDT", "USDC", "BTC", "ETH"] as const;

// ─── Telegram test status ─────────────────────────────────────────────────────

type TgStatus = "idle" | "sending" | "ok" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

type Props = { initialConfig: UserConfigFormInput };

export function ThresholdForm({ initialConfig }: Props) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [tgStatus, setTgStatus] = useState<TgStatus>("idle");
  const [tgError, setTgError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { addNotification } = useDashboardStore();

  const form = useForm<UserConfigFormInput>({
    resolver: zodResolver(UserConfigFormSchema) as any,
    defaultValues: initialConfig,
  });

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function onSubmit(values: UserConfigFormInput) {
    setSaveStatus("saving");
    const result = await updateUserConfig(values);

    if (result.success) {
      setSaveStatus("saved");
      addNotification({ message: "Configuración guardada", type: "success" });
      form.reset(values);
      setTimeout(() => setSaveStatus("idle"), 2500);
    } else {
      setSaveStatus("error");
      form.setError("root", { message: result.error });
    }
  }

  // ── Telegram test ───────────────────────────────────────────────────────────

  async function handleTestTelegram() {
    const chatId = form.getValues("alertTelegram") ?? "";
    if (!chatId.trim()) {
      setTgError("Ingresa un Chat ID antes de probar.");
      setTgStatus("error");
      return;
    }

    setTgStatus("sending");
    setTgError(null);
    const result = await testTelegramAlert(chatId);

    if (result.success) {
      setTgStatus("ok");
      addNotification({ message: "Mensaje de prueba enviado a Telegram", type: "success" });
      setTimeout(() => setTgStatus("idle"), 4000);
    } else {
      setTgStatus("error");
      setTgError(result.error);
      setTimeout(() => setTgStatus("idle"), 6000);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const isDirty = form.formState.isDirty;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">
        {form.formState.errors.root && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            {form.formState.errors.root.message}
          </div>
        )}

        {/* ── Sección 1: Umbrales del motor ───────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Umbrales del Motor</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Parámetros que controlan la clasificación de oportunidades.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* ROI Mínimo */}
            <FormField
              name="minROI"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ROI Mínimo (%)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                          field.onChange(val);
                        }}
                        className="pr-8"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Solo se alertan oportunidades con ROI ajustado ≥ este valor.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Capital */}
            <FormField
              name="capitalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capital (USD)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="100"
                        min="0"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                          field.onChange(val);
                        }}
                        className="pl-6"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Monto base para calcular ROI y evaluar liquidez.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fill Probability */}
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
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                        field.onChange(val);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    0.0 – 1.0. Umbral de fill en P2P.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Max Slippage */}
            <FormField
              name="maxSlippage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slippage Máximo</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        max="0.1"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                          field.onChange(val);
                        }}
                        className="pr-8"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    0.000 – 0.100. Máximo deslizamiento tolerado por operación.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Scan Interval */}
            <FormField
              name="scanIntervalSeconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Intervalo de Escaneo</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="10"
                        min="10"
                        max="3600"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseInt(e.target.value);
                          field.onChange(val);
                        }}
                        className="pr-12"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        seg
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Tiempo de espera entre escaneos automáticos (Online).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Opportunities Limit */}
            <FormField
              name="opportunitiesLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Límite de Historial</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="5"
                        min="1"
                        max="200"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseInt(e.target.value);
                          field.onChange(val);
                        }}
                        className="pr-12"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        ítems
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Cantidad de oportunidades a mostrar en el historial.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <Separator />

        {/* ── Sección 2: Alertas ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Alertas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Canales de notificación para oportunidades EXECUTABLE.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Telegram Chat ID */}
            <FormField
              name="alertTelegram"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telegram Chat ID</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        placeholder="Ej: 123456789 o -1001234567890"
                        {...field}
                        value={field.value ?? ""}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 w-full"
                        onClick={handleTestTelegram}
                        disabled={tgStatus === "sending"}
                      >
                        {tgStatus === "sending" && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {tgStatus === "ok" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        )}
                        {tgStatus === "error" && (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                        {tgStatus === "idle" && (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {tgStatus === "sending"
                          ? "Enviando mensaje de prueba…"
                          : tgStatus === "ok"
                            ? "¡Mensaje enviado!"
                            : tgStatus === "error"
                              ? "Falló — reintentar"
                              : "Enviar mensaje de prueba"}
                      </Button>
                      {tgStatus === "error" && tgError && (
                        <p className="text-xs text-destructive">{tgError}</p>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    ID numérico o de grupo. Obtenlo de @userinfobot o getUpdates.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ventana de deduplicación */}
            <FormField
              name="alertDedupeWindowMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ventana de Deduplicación (min)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        min="1"
                        max="1440"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseInt(e.target.value);
                          field.onChange(val);
                        }}
                        className="pr-12"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        min
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Evita alertas repetidas para la misma ruta en este intervalo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              name="alertEmail"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    Email de Alertas{" "}
                    <span className="text-xs font-normal text-muted-foreground">(próximamente)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      {...field}
                      value={field.value ?? ""}
                      disabled
                      className="opacity-60"
                    />
                  </FormControl>
                  <FormDescription>
                    Notificaciones por correo — integración en desarrollo (Fase 2).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <Separator />

        {/* ── Sección 3: Plataformas y Assets ────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Plataformas y Assets</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define qué plataformas y pares monitorea el escáner.
            </p>
          </div>

          {/* Plataformas */}
          <FormField
            name="enabledPlatforms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plataformas Habilitadas</FormLabel>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PLATFORMS.map((p) => {
                    const checked = field.value.includes(p.id as any);
                    return (
                      <label
                        key={p.id}
                        className={[
                          "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                          checked
                            ? "border-primary/30 bg-primary/5"
                            : "border-border hover:bg-accent",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={checked}
                          onChange={(e) => {
                            const val = e.target.checked
                              ? [...field.value, p.id]
                              : field.value.filter((v: string) => v !== p.id);
                            field.onChange(val);
                          }}
                        />
                        <span className="flex-1 leading-tight">{p.label}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 font-medium ${p.color}`}
                        >
                          {p.tag}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Assets */}
          <FormField
            name="monitoredAssets"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assets Monitoreados</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {ASSETS.map((a) => {
                    const checked = field.value.includes(a as any);
                    return (
                      <label
                        key={a}
                        className={[
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                          checked
                            ? "border-primary/30 bg-primary/5"
                            : "border-border hover:bg-accent",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={checked}
                          onChange={(e) => {
                            const val = e.target.checked
                              ? [...field.value, a]
                              : field.value.filter((v: string) => v !== a);
                            field.onChange(val);
                          }}
                        />
                        {a}
                      </label>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* ── Sección 4: Avanzado (colapsable) ────────────────────────────── */}
        <section>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <span className="font-medium text-foreground">Opciones avanzadas</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-4 rounded-lg border border-dashed p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-xs text-muted-foreground">
                Ajustes de diagnóstico. Modifica solo si sabes lo que haces.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">maxSlippage actual</p>
                  <p className="font-mono text-muted-foreground">
                    {(form.watch("maxSlippage") * 100).toFixed(3)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Editable en el campo Slippage Máximo de la sección Umbrales.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">minFillProbability actual</p>
                  <p className="font-mono text-muted-foreground">
                    {(form.watch("minFillProbability") * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Sección 5: Monitor de Precio P2P ────────────────────────── */}
        <Separator />
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Monitor de Precio P2P</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Umbrales para el registro y alerta de cambios de precio en tiempo real.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Umbral de cambio para registrar */}
            <FormField
              name="priceChangeThresholdPct"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Umbral de cambio para registrar (%)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="50"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                          field.onChange(val);
                        }}
                        className="pr-8"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Solo se guarda un nuevo punto de precio si el cambio supera este %. Default: 1%.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Umbral de alerta Telegram */}
            <FormField
              name="priceAlertThresholdPct"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Umbral de alerta Telegram (%)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="100"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                          field.onChange(val);
                        }}
                        className="pr-8"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Se envía alerta Telegram cuando el precio cambia más de este %. Default: 2%.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Alertas de precio activas */}
          <FormField
            name="priceAlertEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <input
                    type="checkbox"
                    id="priceAlertEnabled"
                    checked={field.value}
                    onChange={field.onChange}
                    className="w-4 h-4 accent-primary"
                  />
                </FormControl>
                <div>
                  <FormLabel htmlFor="priceAlertEnabled" className="cursor-pointer">
                    Alertas de precio activas
                  </FormLabel>
                  <FormDescription>
                    Activa/desactiva las alertas Telegram de cambio de precio P2P.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </section>

        {/* ── Footer: acciones ────────────────────────────────────────────── */}

        <div className="flex items-center justify-between gap-3 border-t pt-6">
          <p className="text-xs text-muted-foreground">
            {isDirty ? (
              <span className="text-warning font-medium">Tienes cambios sin guardar.</span>
            ) : saveStatus === "saved" ? (
              <span className="flex items-center gap-1 text-success font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Cambios guardados
              </span>
            ) : (
              "Sin cambios pendientes."
            )}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => form.reset()}
              disabled={saveStatus === "saving" || !isDirty}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saveStatus === "saving" || !isDirty}
              className="gap-1.5"
            >
              {saveStatus === "saving" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saveStatus === "saving" ? "Guardando…" : "Guardar Cambios"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
