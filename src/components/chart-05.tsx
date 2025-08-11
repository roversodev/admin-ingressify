"use client";

import { useId } from "react";
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

// Dados de fallback caso os dados reais não estejam disponíveis
const fallbackData = [
  { location: "São Paulo", count: 15, ticketsSold: 2000, revenue: 100000 },
  { location: "Rio de Janeiro", count: 10, ticketsSold: 1500, revenue: 75000 },
  { location: "Belo Horizonte", count: 8, ticketsSold: 1200, revenue: 60000 },
  { location: "Brasília", count: 6, ticketsSold: 900, revenue: 45000 },
  { location: "Salvador", count: 5, ticketsSold: 750, revenue: 37500 },
  { location: "Recife", count: 4, ticketsSold: 600, revenue: 30000 },
  { location: "Fortaleza", count: 3, ticketsSold: 450, revenue: 22500 },
  { location: "Porto Alegre", count: 3, ticketsSold: 450, revenue: 22500 },
  { location: "Curitiba", count: 2, ticketsSold: 300, revenue: 15000 },
  { location: "Manaus", count: 2, ticketsSold: 300, revenue: 15000 },
];

const chartConfig = {
  count: {
    label: "Eventos",
    color: "var(--chart-4)",
  },
  ticketsSold: {
    label: "Ingressos",
    color: "var(--chart-1)",
  },
  revenue: {
    label: "Receita",
    color: "var(--chart-6)",
  },
} satisfies ChartConfig;

export function Chart05() {
  const id = useId();
  const { user } = useUser();
  
  // Buscar dados reais do Convex
  const locationData = useQuery(api.admin.getEventLocationStats, { 
    userId: user?.id || ""
  });

  // Usar dados reais ou fallback
  const chartData = locationData || fallbackData;

  // Calcular o total de eventos
  const totalEvents = chartData.reduce((sum: number, item: { count: number; }) => sum + item.count, 0);

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle>Distribuição de Eventos</CardTitle>
            <div className="flex items-start gap-2">
              <div className="font-semibold text-2xl">{totalEvents}</div>
              <Badge className="mt-1.5 bg-emerald-500/24 text-emerald-500 border-none">
                Top 10
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
                Eventos
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-xs bg-chart-1"
              ></div>
              <div className="text-[13px]/3 text-muted-foreground/50">Ingressos</div>
            </div>
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-xs bg-chart-6"
              ></div>
              <div className="text-[13px]/3 text-muted-foreground/50">
                Receita
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
              dataKey="location"
              tickLine={false}
              tickMargin={12}
              stroke="var(--border)"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              yAxisId="left"
              tickFormatter={(value) =>
                value === 0 ? "0" : `${value}`
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              orientation="right"
              yAxisId="right"
              tickFormatter={(value) =>
                value === 0 ? "0" : `R$ ${(value / 1000).toFixed(0)}K`
              }
            />
            <ChartTooltip
              content={
                <CustomTooltipContent
                  colorMap={{
                    count: "var(--chart-4)",
                    ticketsSold: "var(--chart-1)",
                    revenue: "var(--chart-6)",
                  }}
                  labelMap={{
                    count: "Eventos",
                    ticketsSold: "Ingressos",
                    revenue: "Receita",
                  }}
                  dataKeys={["count", "ticketsSold", "revenue"]}
                  valueFormatter={(value: { toLocaleString: () => any; }, dataKey?: string) => 
                    dataKey === "revenue" 
                      ? `R$ ${value.toLocaleString()}`
                      : value.toLocaleString()
                  }
                />
              }
            />
            <Bar dataKey="count" fill="var(--chart-4)" yAxisId="left" />
            <Bar dataKey="ticketsSold" fill={`url(#${id}-gradient)`} yAxisId="left" />
            <Bar dataKey="revenue" fill="var(--chart-6)" yAxisId="right" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
