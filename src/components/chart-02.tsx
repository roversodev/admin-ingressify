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

// Dados de fallback para quando os dados reais não estiverem disponíveis
const fallbackMonthlyData = [
  { month: "Jan 2025", actual: 0, projected: 500 },
  { month: "Fev 2025", actual: 0, projected: 600 },
  { month: "Mar 2025", actual: 0, projected: 720 },
  { month: "Abr 2025", actual: 0, projected: 864 },
  { month: "Mai 2025", actual: 0, projected: 1037 },
  { month: "Jun 2025", actual: 0, projected: 1244 },
  { month: "Jul 2025", actual: 0, projected: 1493 },
  { month: "Ago 2025", actual: 0, projected: 1792 },
  { month: "Set 2025", actual: 0, projected: 2150 },
  { month: "Out 2025", actual: 0, projected: 2580 },
  { month: "Nov 2025", actual: 0, projected: 3096 },
  { month: "Dez 2025", actual: 0, projected: 3715 },
];

const fallbackYearlyData = [
  { month: "2020", actual: 0, projected: 6000 },
  { month: "2021", actual: 0, projected: 8100 },
  { month: "2022", actual: 0, projected: 10935 },
  { month: "2023", actual: 0, projected: 14762 },
  { month: "2024", actual: 0, projected: 19929 },
  { month: "2025", actual: 0, projected: 26904 },
];

const chartConfig = {
  actual: {
    label: "Realizado",
    color: "var(--chart-1)",
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

export function Chart02() {
  const id = useId();
  const [selectedValue, setSelectedValue] = useState("off");
  const { user } = useUser();
  
  // Buscar dados reais do Convex
  const ticketSalesData = useQuery(api.admin.getTicketSalesData, { 
    userId: user?.id || ""
  });

  // Usar dados reais ou fallback
  const chartData = selectedValue === "on" 
    ? ticketSalesData?.yearly || fallbackYearlyData 
    : ticketSalesData?.monthly || fallbackMonthlyData;

  // Encontrar o valor mais recente não-zero para o total de ingressos
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
  const totalTickets = findLastNonZeroValue(chartData);
  const previousTickets = findPreviousNonZeroValue(chartData);
  const growthPercentage = previousTickets > 0 
    ? ((totalTickets - previousTickets) / previousTickets * 100).toFixed(1) 
    : "0.0";

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle>Ingressos Vendidos</CardTitle>
            <div className="flex items-start gap-2">
              <div className="font-semibold text-2xl">{totalTickets.toLocaleString()}</div>
              <Badge className="mt-1.5 bg-emerald-500/24 text-emerald-500 border-none">
                +{growthPercentage}%
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-xs bg-chart-1"
              ></div>
              <div className="text-[13px]/3 text-muted-foreground/50">
                Realizado
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
          className="aspect-auto h-60 w-full [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-(--chart-1)/15 [&_.recharts-rectangle.recharts-tooltip-inner-cursor]:fill-white/20"
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: -12, right: 12, top: 12 }}
          >
            <defs>
              <linearGradient id={`${id}-gradient`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--chart-2)" />
                <stop offset="100%" stopColor="var(--chart-1)" />
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
                if (value === 0) return "0";
                return `${(value / 1000).toFixed(1)}k`;
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
                    actual: "var(--chart-1)",
                    projected: "var(--chart-3)",
                  }}
                  labelMap={{
                    actual: "Realizado",
                    projected: "Projetado",
                  }}
                  dataKeys={["actual", "projected"]}
                  valueFormatter={(value) => value.toLocaleString()}
                />
              }
              cursor={<CustomCursor fill="var(--chart-1)" />}
            />
            <Line
              type="linear"
              dataKey="actual"
              stroke={`url(#${id}-gradient)`}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 5,
                fill: "var(--chart-1)",
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
