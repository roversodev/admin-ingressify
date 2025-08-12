"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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

// Dados de fallback para quando os dados reais não estiverem disponíveis
const fallbackData = [
  { month: "Jan 2025", revenues: 750000, churn: -150000 },
  { month: "Feb 2025", revenues: 900000, churn: -70000 },
  { month: "Mar 2025", revenues: 950000, churn: -220000 },
  { month: "Apr 2025", revenues: 1350000, churn: -180000 },
  { month: "May 2025", revenues: 650000, churn: -80000 },
  { month: "Jun 2025", revenues: 1450000, churn: -280000 },
  { month: "Jul 2025", revenues: 950000, churn: -150000 },
  { month: "Aug 2025", revenues: 500000, churn: -120000 },
  { month: "Sep 2025", revenues: 1300000, churn: -280000 },
  { month: "Oct 2025", revenues: 1050000, churn: -40000 },
  { month: "Nov 2025", revenues: 1550000, churn: -120000 },
  { month: "Dec 2025", revenues: 900000, churn: -200000 },
];

const chartConfig = {
  revenues: {
    label: "Receitas",
    color: "var(--chart-1)",
  },
  churn: {
    label: "Devoluções",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

export function Chart03() {
  const id = useId();
  const { user } = useUser();
  
  // Buscar dados reais do Convex
  const revenueChurnData = useQuery(api.admin.getRevenueChurnData, { 
    userId: user?.id || ""
  });

  // Usar dados reais ou fallback
  const chartData = revenueChurnData || fallbackData;

  // Get first and last month with type assertions
  const firstMonth = chartData[0]?.month as string;
  const lastMonth = chartData[chartData.length - 1]?.month as string;

  // Calcular o valor líquido (receitas + churn) e a porcentagem de crescimento
  const totalRevenue = chartData.reduce((sum: any, item: { revenues: any; churn: any; }) => sum + item.revenues + item.churn, 0);
  
  // Calcular a receita do mês atual e do mês anterior para a porcentagem de crescimento
  const currentMonthData = chartData[chartData.length - 1];
  const previousMonthData = chartData[chartData.length - 2];
  
  const currentMonthNet = currentMonthData ? (currentMonthData.revenues + currentMonthData.churn) : 0;
  const previousMonthNet = previousMonthData ? (previousMonthData.revenues + previousMonthData.churn) : 0;
  
  const growthPercentage = previousMonthNet > 0 
    ? ((currentMonthNet - previousMonthNet) / previousMonthNet * 100).toFixed(1) 
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle>Crescimento de Receita</CardTitle>
            <div className="flex items-start gap-2">
              <div className="font-semibold text-2xl">{formattedTotalRevenue}</div>
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
                Receitas
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-xs bg-chart-4"
              ></div>
              <div className="text-[13px]/3 text-muted-foreground/50">
                Devoluções
              </div>
            </div>
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
            stackOffset="sign"
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
                    revenues: "var(--chart-1)",
                    churn: "var(--chart-4)",
                  }}
                  labelMap={{
                    revenues: "Receitas",
                    churn: "Devoluções",
                  }}
                  dataKeys={["revenues", "churn"]}
                  valueFormatter={(value) => `R$${value.toLocaleString()}`}
                />
              }
            />
            <Bar dataKey="revenues" fill={`url(#${id}-gradient)`} stackId="a" />
            <Bar dataKey="churn" fill="var(--color-churn)" stackId="a" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
