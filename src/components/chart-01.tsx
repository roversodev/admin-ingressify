"use client";

import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
const mrrData = [
  { month: "Jan 2025", actual: 300000, projected: 120000 },
  { month: "Fev 2025", actual: 420000, projected: 180000 },
  { month: "Mar 2025", actual: 500000, projected: 90000 },
  { month: "Abr 2025", actual: 630000, projected: 110000 },
  { month: "Mai 2025", actual: 710000, projected: 120000 },
  { month: "Jun 2025", actual: 800000, projected: 100000 },
  { month: "Jul 2025", actual: 900000, projected: 140000 },
  { month: "Ago 2025", actual: 1010000, projected: 120000 },
  { month: "Set 2025", actual: 1090000, projected: 130000 },
  { month: "Out 2025", actual: 1180000, projected: 110000 },
  { month: "Nov 2025", actual: 1280000, projected: 130000 },
  { month: "Dez 2025", actual: 1380000, projected: 100000 },
];

// Dados de fallback para receita anual por ano
const arrData = [
  { month: "2020", actual: 3600000, projected: 1440000 },
  { month: "2021", actual: 5200000, projected: 1800000 },
  { month: "2022", actual: 7000000, projected: 2100000 },
  { month: "2023", actual: 9300000, projected: 2500000 },
  { month: "2024", actual: 12100000, projected: 3200000 },
  { month: "2025", actual: 16560000, projected: 4200000 },
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

export function Chart01() {
  const id = useId();
  const [selectedValue, setSelectedValue] = useState("off");
  const { user, isLoaded } = useUser();
  
  // Buscar dados reais do Convex
  const revenueData = useQuery(
    api.admin.getRevenueData, 
    isLoaded && user?.id ? { userId: user.id } : "skip"
  );

  // Usar dados reais ou fallback
  const chartData = selectedValue === "on" 
    ? revenueData?.yearly || arrData 
    : revenueData?.monthly || mrrData;

  // Adicionar logs para depuração
  console.log("Chart Data:", chartData);

  const firstMonth = chartData[0]?.month as string;
  const lastMonth = chartData[chartData.length - 1]?.month as string;

  // Calcular o valor total e a porcentagem de crescimento para exibição dinâmica
  // Encontrar o valor mais recente que não seja zero
  let totalRevenue = 0;
  let previousRevenue = 0;
  
  // Percorrer o array de trás para frente para encontrar valores não-zero
  for (let i = chartData.length - 1; i >= 0; i--) {
    if (totalRevenue === 0 && chartData[i].actual > 0) {
      totalRevenue = chartData[i].actual;
    } else if (totalRevenue > 0 && previousRevenue === 0 && chartData[i].actual > 0) {
      previousRevenue = chartData[i].actual;
      break;
    }
  }
  
  // Se não encontrou valores não-zero, usar os valores originais
  if (totalRevenue === 0) {
    totalRevenue = chartData.length > 0 ? chartData[chartData.length - 1].actual : 0;
  }
  if (previousRevenue === 0) {
    previousRevenue = chartData.length > 1 ? chartData[chartData.length - 2].actual : 0;
  }

  console.log("Total Revenue (ajustado):", totalRevenue);
  console.log("Previous Revenue (ajustado):", previousRevenue);

  const growthPercentage = previousRevenue > 0 
    ? ((totalRevenue - previousRevenue) / previousRevenue * 100).toFixed(1) 
    : "0.0";

  // Formatar o valor total para exibição
  const formattedTotalRevenue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(totalRevenue);

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <CardTitle>Receita de Vendas</CardTitle>
            <div className="flex items-start gap-2">
              <div className="font-semibold text-2xl">
                {formattedTotalRevenue}
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
          <BarChart
            accessibilityLayer
            data={chartData}
            maxBarSize={20}
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
                value === 0 ? "R$0" : `R$${(value / 1000000).toFixed(1)}M`
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
                  valueFormatter={(value) => `R$${value.toLocaleString()}`}
                />
              }
            />
            <Bar dataKey="actual" fill={`url(#${id}-gradient)`} stackId="a" />
            <Bar
              dataKey="projected"
              fill="var(--color-projected)"
              stackId="a"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
