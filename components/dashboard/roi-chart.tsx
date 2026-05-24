"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useTimezone } from "@/lib/hooks/use-timezone"

type DataPoint = {
  evaluatedAt: string;
  roiAdjusted: number;
  route: string;
};

const CHART_CONFIG = {
  roiAdjusted: {
    label: "ROI Ajustado (%)",
    color: "var(--color-brand-primary)",
  },
};

export function ROIChart({ data, range = "7d" }: { data: DataPoint[], range?: string }) {
  const isShortRange = range.endsWith("h") || range === "24h" || range === "12h";
  const { tz } = useTimezone()

  const chartData = data.map((d) => {
    const date = new Date(d.evaluatedAt);
    let timeLabel = "";

    if (isShortRange) {
      timeLabel = date.toLocaleTimeString("es-VE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      });
    } else {
      timeLabel = date.toLocaleDateString("es-VE", {
        day: "2-digit",
        month: "2-digit",
        timeZone: tz,
      });
    }

    return {
      time: timeLabel,
      roiAdjusted: parseFloat(d.roiAdjusted.toFixed(3)),
      route: d.route,
    };
  });

  if (chartData.length === 0) {
    const rangeLabel = range.replace("h", " horas").replace("d", " días").replace("m", " meses");
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos de ROI en los últimos {rangeLabel}
      </div>
    );
  }

  return (
    <ChartContainer config={CHART_CONFIG} className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<ChartTooltipContent />} />
          <ReferenceLine
            y={0}
            stroke="var(--color-muted-foreground)"
            strokeDasharray="3 3"
          />
          <Line
            type="monotone"
            dataKey="roiAdjusted"
            stroke="var(--color-brand-primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
