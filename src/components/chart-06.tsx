"use client";

import { useId, useState } from "react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useQuery } from "convex/react";
import { api } from "@/api";
import { useUser } from "@clerk/nextjs";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card-charts";
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
  { month: "Jan 2025", actual: 50, projected: 20 },
  { month: "Fev 2025", actual: 70, projected: 30 },
  { month: "Mar 2025", actual: 90, projected: 40 },
  { month: "Abr 2025", actual: 120, projected: 50 },
  { month: "Mai 2025", actual: 150, projected: 60 },
  { month: "Jun 2025", actual: 200, projected: 70 },
  { month: "Jul 2025", actual: 250, projected: 80 },
  { month: "Ago 2025", actual: 300, projected: 90 },
  { month: "Set 2025", actual: 350, projected: 100 },
  { month: "Out 2025", actual: 400, projected: 110 },
  { month: "Nov 2025", actual: 450, projected: 120 },
  { month: "Dez 2025", actual: 500, projected: 130 },
];

// Dados de fallback para usuários anuais
const yearlyData = [
  { month: "2020", actual: 200, projected: 100 },
  { month: "2021", actual: 500, projected: 300 },
  { month: "2022", actual: 1000, projected: 600 },
  { month: "2023", actual: 2000, projected: 1200 },
  { month: "2024", actual: 3500, projected: 2000 },
  { month: "2025", actual: 6000, projected: 3000 },
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

export function Chart06() {
  const id = useId();
  const [selectedValue, setSelectedValue] = useState("off");
  const { user } = useUser();
  
  // Buscar dados reais do Convex
  const userData = useQuery(api.admin.getUserGrowthData, { 
    userId: user?.id || ""
  });

  // Usar dados reais ou fallback
  const chartData = selectedValue === "on" 
    ? userData?.yearly || yearlyData 
    : userData?.monthly || monthlyData;

  const firstMonth = chartData[0]?.month as string;
  const lastMonth = chartData[chartData.length - 1]?.month as string;

  // Encontrar o valor mais recente não-zero para o total de usuários
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
  const totalUsers = findLastNonZeroValue(chartData);
  const previousUsers = findPreviousNonZeroValue(chartData);
  const growthPercentage = previousUsers > 0 
    ? ((totalUsers - previousUsers) / previousUsers * 100).toFixed(1) 
    : "0.0";

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <CardTitle>Novos Usuários</CardTitle>
            <div className="flex items-start gap-2">
              <div className="font-semibold text-2xl">
                {totalUsers.toLocaleString()}
              </div>
              <Badge className="mt-1.5 bg-emerald-500/24 text-emerald-500 border-none">
                +{growthPercentage}%
              </Badge>
            </div>
          </div>
          <div className="bg-black/50 inline-flex h-7 rounded-lg p-0.5 shrink-0">
            <RadioGroup
              value={selectedValue}
              onValueChange={setSelectedValue}
              className="group text-xs after:border after:border-border after:bg-background has-focus-visible:after:border-ring has-focus-visible:after:ring-ring/50 relative inline-grid grid-cols-[1fr_1fr] items-center gap-0 font-medium after:absolute after:inset-y-0 after:w-1/2 after:rounded-md after:shadow-xs after:transition-[translate,box-shadow] after:duration-300 after:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)] has-focus-visible:after:ring-[3px] data-[state=off]:after:translate-x-0 data-[state=on]:after:translate-x-full"
              data-state={selectedValue}
            >
              <label className="group-data-[state=on]:text-muted-foreground/50 relative z-10 inline-flex h-full min-w-8 cursor-pointer items-center justify-center px-2 whitespace-nowrap transition-colors select-none">
                Mensal
                <RadioGroupItem
                  id={`${id}-1`}
                  value="off"
                  className="sr-only"
                />
              </label>
              <label className="group-data-[state=off]:text-muted-foreground/50 relative z-10 inline-flex h-full min-w-8 cursor-pointer items-center justify-center px-2 whitespace-nowrap transition-colors select-none">
                Anual
                <RadioGroupItem id={`${id}-2`} value="on" className="sr-only" />
              </label>
            </RadioGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-60 w-full [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-[var(--chart-1)]/15"
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: -12, right: 12, top: 12 }}
          >
            <defs>
              <linearGradient id={`${id}-gradient`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" />
                <stop offset="100%" stopColor="var(--chart-2)" />
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
              ticks={[firstMonth, lastMonth]}
              stroke="var(--border)"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                value === 0 ? "0" : `${value}`
              }
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
                  valueFormatter={(value) => `${value.toLocaleString()}`}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke={`url(#${id}-gradient)`}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                style: { fill: "var(--chart-1)", opacity: 1 },
              }}
            />
            <Line
              type="monotone"
              dataKey="projected"
              stroke="var(--chart-3)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{
                r: 4,
                style: { fill: "var(--chart-3)", opacity: 1 },
              }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
