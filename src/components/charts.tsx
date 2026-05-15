"use client";
import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { formatBRL } from "@/lib/utils";

const FALLBACK_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#f97316",
  "#facc15",
  "#a855f7",
  "#ef4444",
  "#84cc16",
  "#06b6d4",
  "#ec4899",
  "#94a3b8",
];

interface SliceData {
  nome: string;
  valor: number;
  cor?: string | null;
}

export function GraficoCategorias({ data }: { data: SliceData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
        Sem dados neste mês
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="valor"
          nameKey="nome"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.cor || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatBRL(Number(value) || 0)}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function GraficoComparacao({
  data,
}: {
  data: { nome: string; valor: number; cor: string }[];
}) {
  if (data.every((d) => d.valor === 0)) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
        Sem dados neste mês
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="nome"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={(v) =>
            new Intl.NumberFormat("pt-BR", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(v as number)
          }
        />
        <Tooltip
          formatter={(value) => formatBRL(Number(value) || 0)}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
          }}
        />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.cor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoEvolucaoMes({
  data,
}: {
  data: { dia: string; acumulado: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
        Sem dados
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="dia"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={(v) =>
            new Intl.NumberFormat("pt-BR", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(v as number)
          }
        />
        <Tooltip
          formatter={(value) => formatBRL(Number(value) || 0)}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
          }}
        />
        <Line
          type="monotone"
          dataKey="acumulado"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
