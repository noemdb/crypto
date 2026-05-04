"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";

type DistData = {
  name: string;
  EXECUTABLE: number;
  MARGINAL: number;
  INVALID: number;
};

const CHART_CONFIG = {
  EXECUTABLE: { label: "Ejecutable", color: "var(--color-success)" },
  MARGINAL: { label: "Marginal", color: "var(--color-warning)" },
  INVALID: { label: "Inválido", color: "var(--color-muted-foreground)" },
};

export function ClassificationDistChart({ data }: { data: DistData[] }) {
  if (data.length === 0) return null;

  return (
    <ChartContainer config={CHART_CONFIG} className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar
            dataKey="EXECUTABLE"
            fill="var(--color-success)"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="MARGINAL"
            fill="var(--color-warning)"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="INVALID"
            fill="var(--color-muted-foreground)"
            opacity={0.4}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
