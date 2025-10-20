"use client";

import { useId } from "react";
import { PieChart, Pie, Cell } from "recharts";
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
  { name: "À Vista", value: 65, count: 130, revenue: 15000 },
  { name: "Parcelado", value: 35, count: 70, revenue: 8000 },
];

const chartConfig = {
  aVista: {
    label: "À Vista (1x)",
    color: "var(--chart-1)",
  },
  parcelado: {
    label: "Parcelado (2x+)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function Chart07() {
  const { user } = useUser();
  const id = useId();

  // Buscar dados de parcelamento
  const installmentStats = useQuery(
    api.admin.getCreditCardInstallmentStats,
    user?.id ? { userId: user.id } : "skip"
  );

  // Preparar dados para o gráfico
  const chartData = installmentStats ? [
    {
      name: "À Vista",
      value: installmentStats.aVista.percentage,
      count: installmentStats.aVista.count,
      revenue: installmentStats.aVista.revenue,
      fill: "var(--chart-1)",
    },
    {
      name: "Parcelado",
      value: installmentStats.parcelado.percentage,
      count: installmentStats.parcelado.count,
      revenue: installmentStats.parcelado.revenue,
      fill: "var(--chart-2)",
    },
  ] : fallbackData.map((item, index) => ({
    ...item,
    fill: index === 0 ? "var(--chart-1)" : "var(--chart-2)",
  }));

  // Calcular totais
  const totalTransactions = installmentStats?.total.transactions || 200;
  const totalRevenue = installmentStats?.total.revenue || 23000;

  // Calcular porcentagem de parcelado
  const parceladoPercentage = chartData.find(item => item.name === "Parcelado")?.value || 35;

  // Função para formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle>Vendas Cartão de Crédito</CardTitle>
            <div className="flex items-start gap-2">
              <div className="font-semibold text-2xl">{formatCurrency(totalRevenue)}</div>
              <Badge className="mt-1.5 bg-emerald-500/24 text-emerald-500 border-none">
                {parceladoPercentage.toFixed(1)}% parcelado
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
                À Vista
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-xs bg-chart-2"
              ></div>
              <div className="text-[13px]/3 text-muted-foreground/50">
                Parcelado
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-60 w-full"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor: data.fill,
                            }}
                          />
                          <span className="font-medium">{data.name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {data.value.toFixed(1)}% ({data.count} transações)
                        </div>
                        <div className="text-sm font-medium">
                          {formatCurrency(data.revenue)}
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              strokeWidth={5}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}