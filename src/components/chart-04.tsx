"use client";

import { useId, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Rectangle,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery } from "convex/react";
import { api } from "@/api";
import { useUser } from "@clerk/nextjs";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { CustomTooltipContent } from "@/components/charts-extra";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Dados de fallback caso os dados reais não estejam disponíveis
const monthlyData = [
  { month: "Jan 2025", actual: 1000, projected: 500 },
  { month: "Feb 2025", actual: 3500, projected: 2000 },
  { month: "Mar 2025", actual: 10000, projected: 3500 },
  { month: "Apr 2025", actual: 9000, projected: 5000 },
  { month: "May 2025", actual: 15000, projected: 7000 },
  { month: "Jun 2025", actual: 17000, projected: 8000 },
  { month: "Jul 2025", actual: 16000, projected: 10000 },
  { month: "Aug 2025", actual: 18000, projected: 11000 },
  { month: "Sep 2025", actual: 9000, projected: 12500 },
  { month: "Oct 2025", actual: 16000, projected: 8000 },
  { month: "Nov 2025", actual: 22000, projected: 9000 },
  { month: "Dec 2025", actual: 15000, projected: 14000 },
];

// Dados de fallback para reembolsos anuais
const yearlyData = [
  { month: "2020", actual: 12000, projected: 6000 },
  { month: "2021", actual: 42000, projected: 24000 },
  { month: "2022", actual: 120000, projected: 42000 },
  { month: "2023", actual: 108000, projected: 60000 },
  { month: "2024", actual: 180000, projected: 84000 },
  { month: "2025", actual: 204000, projected: 96000 },
];

const chartConfig = {
  actual: {
    label: "Realizado",
    color: "var(--chart-4)",
  },
  projected: {
    label: "Projetado",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

interface CustomCursorProps {
  fill?: string;
  pointerEvents?: string;
  height?: number;
  points?: Array<{ x: number; y: number }>;
  className?: string;
}

function CustomCursor(props: CustomCursorProps) {
  const { fill, pointerEvents, height, points, className } = props;

  if (!points || points.length === 0) {
    return null;
  }

  const { x, y } = points[0]!;
  return (
    <>
      <Rectangle
        x={x - 12}
        y={y}
        fill={fill}
        pointerEvents={pointerEvents}
        width={24}
        height={height}
        className={className}
        type="linear"
      />
      <Rectangle
        x={x - 1}
        y={y}
        fill={fill}
        pointerEvents={pointerEvents}
        width={1}
        height={height}
        className="recharts-tooltip-inner-cursor"
        type="linear"
      />
    </>
  );
}

export function Chart04() {
  const id = useId();
  const [selectedValue, setSelectedValue] = useState("off");
  const { user } = useUser();
  
  // Buscar dados reais do Convex
  const refundsData = useQuery(api.admin.getRefundsData, { 
    userId: user?.id || ""
  });

  // Usar dados reais ou fallback
  const chartData = selectedValue === "on" 
    ? refundsData?.yearly || yearlyData 
    : refundsData?.monthly || monthlyData;

  // Encontrar o valor mais recente não-zero para o total de reembolsos
  const findLastNonZeroValue = (data: any[]) => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].actual > 0) {
        return data[i].actual;
      }
    }
    return 0;
  };

  // Encontrar o valor não-zero anterior ao último valor não-zero
  const findPreviousNonZeroValue = (data: any[]) => {
    let foundFirst = false;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].actual > 0) {
        if (foundFirst) {
          return data[i].actual;
        }
        foundFirst = true;
      }
    }
    return 0;
  };

  // Calcular o valor total e a porcentagem de crescimento para exibição dinâmica
  const totalRefunds = findLastNonZeroValue(chartData);
  const previousRefunds = findPreviousNonZeroValue(chartData);
  const growthPercentage = previousRefunds > 0 
    ? ((totalRefunds - previousRefunds) / previousRefunds * 100).toFixed(1) 
    : "0.0";

  // Formatar o valor total para exibição
  const formattedTotalRefunds = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(totalRefunds);

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle>Reembolsos</CardTitle>
            <div className="flex items-start gap-2">
              <div className="font-semibold text-2xl">{formattedTotalRefunds}</div>
              <Badge className="mt-1.5 bg-rose-500/24 text-rose-500 border-none">
                +{growthPercentage}%
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-xs bg-chart-4"
              ></div>
              <div className="text-[13px]/3 text-muted-foreground/50">
                Atual
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-xs bg-chart-3"
              ></div>
              <div className="text-[13px]/3 text-muted-foreground/50">
                Projetado
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-60 w-full [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-(--chart-4)/10 [&_.recharts-rectangle.recharts-tooltip-inner-cursor]:fill-white/20"
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: -12, right: 12, top: 12 }}
          >
            <defs>
              <linearGradient id={`${id}-gradient`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--chart-5)" />
                <stop offset="100%" stopColor="var(--chart-4)" />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="2 2"
              stroke="var(--border)"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={12}
              tickFormatter={(value) => value.slice(0, 3)}
              stroke="var(--border)"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                if (value === 0) return "R$0";
                return `R$${value / 1000}k`;
              }}
              interval="preserveStartEnd"
            />
            <Line
              type="linear"
              dataKey="projected"
              stroke="var(--color-projected)"
              strokeWidth={2}
              dot={false}
              activeDot={false}
            />
            <ChartTooltip
              content={
                <CustomTooltipContent
                  colorMap={{
                    actual: "var(--chart-4)",
                    projected: "var(--chart-3)",
                  }}
                  labelMap={{
                    actual: "Realizado",
                    projected: "Projetado",
                  }}
                  dataKeys={["actual", "projected"]}
                  valueFormatter={(value) => `R$${value.toLocaleString()}`}
                />
              }
              cursor={<CustomCursor fill="var(--chart-4)" />}
            />
            <Line
              type="linear"
              dataKey="actual"
              stroke={`url(#${id}-gradient)`}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 5,
                fill: "var(--chart-4)",
                stroke: "var(--background)",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
