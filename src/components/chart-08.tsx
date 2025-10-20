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

// Dados de fallback caso os dados reais não estejam disponíveis
const fallbackData = [
  { installments: "1x", count: 45, revenue: 12000, percentage: 45 },
  { installments: "2x", count: 20, revenue: 8000, percentage: 20 },
  { installments: "3x", count: 15, revenue: 6000, percentage: 15 },
  { installments: "4x", count: 10, revenue: 4000, percentage: 10 },
  { installments: "6x", count: 8, revenue: 3200, percentage: 8 },
  { installments: "12x", count: 2, revenue: 800, percentage: 2 },
];

const chartConfig = {
  count: {
    label: "Transações",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function Chart08() {
  const id = useId();
  const { user } = useUser();

  // Buscar dados de distribuição de parcelas
  const installmentDistribution = useQuery(
    api.admin.getInstallmentDistributionStats,
    user?.id ? { userId: user.id } : "skip"
  );

  // Preparar dados para o gráfico
  const chartData = installmentDistribution?.distribution || fallbackData;

  // Calcular totais
  const totalTransactions = installmentDistribution?.total.transactions || 100;
  const totalRevenue = installmentDistribution?.total.revenue || 34000;

  // Calcular a parcela mais popular
  const mostPopular = chartData.reduce((prev: { count: number; }, current: { count: number; }) => 
    (prev.count > current.count) ? prev : current
  );

  // Calcular crescimento (comparar 1x vs outras parcelas)
  const aVistaCount = chartData.find((item: { installments: string; }) => item.installments === "1x")?.count || 0;
  const parceladoCount = totalTransactions - aVistaCount;
  const parceladoPercentage = totalTransactions > 0 
    ? ((parceladoCount / totalTransactions) * 100).toFixed(1)
    : "0.0";

  // Função para formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2
    }).format(value);
  };

  // Get first and last installment options
  const firstInstallment = chartData[0]?.installments;
  const lastInstallment = chartData[chartData.length - 1]?.installments;

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle>Distribuição de Parcelas</CardTitle>
            <div className="flex items-start gap-2">
              <div className="font-semibold text-2xl">{totalTransactions}</div>
              <Badge className="mt-1.5 bg-blue-500/24 text-blue-500 border-none">
                {firstInstallment}-{lastInstallment} parcelas
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
                Transações
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
            maxBarSize={40}
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
              dataKey="installments"
              tickLine={false}
              tickMargin={12}
              ticks={[firstInstallment, lastInstallment]}
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
              cursor={false}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) {
                  return null;
                }

                const data = payload[0].payload;
                
                return (
                  <div className="bg-popover text-popover-foreground grid min-w-32 items-start gap-1.5 rounded-lg border px-3 py-1.5 text-xs">
                    <div className="font-medium">{label}</div>
                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2 rounded-xs"
                            style={{ backgroundColor: "var(--chart-1)" }}
                          />
                          <span className="text-muted-foreground">Transações</span>
                        </div>
                        <span className="text-foreground font-mono font-medium tabular-nums">
                          {data.count}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">
                          {data.percentage.toFixed(1)}% do total
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">
                          Receita: {formatCurrency(data.revenue)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Bar 
              dataKey="count" 
              fill={`url(#${id}-gradient)`}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}