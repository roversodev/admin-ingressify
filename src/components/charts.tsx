"use client";

import * as React from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip } from "./ui/chart";
import { CustomTooltipContent } from "./charts-extra";

interface ChartProps {
  data: any[];
  className?: string;
}

interface BarChartProps extends ChartProps {
  categories: string[];
  index: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
}

export function BarChart({
  data,
  categories,
  index,
  colors = ["blue"],
  valueFormatter = (value) => `${value}`,
  className,
}: BarChartProps) {
  const chartConfig = {
    ...categories.reduce(
      (acc, category, i) => ({
        ...acc,
        [category]: {
          color: colors[i % colors.length],
        },
      }),
      {}
    ),
  };

  return (
    <ChartContainer config={chartConfig} className={className}>
      <RechartsBarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 2" stroke="var(--border)" />
        <XAxis
          dataKey={index}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          stroke="var(--border)"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => valueFormatter(value)}
        />
        <ChartTooltip
          content={(
            <CustomTooltipContent
              valueFormatter={(value) => valueFormatter(value)}
            />
          )}
        />
        {categories.map((category, i) => (
          <Bar
            key={category}
            dataKey={category}
            fill={`var(--color-${category}, ${colors[i % colors.length]})`}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
  );
}

interface LineChartProps extends ChartProps {
  categories: string[];
  index: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
}

export function LineChart({
  data,
  categories,
  index,
  colors = ["blue"],
  valueFormatter = (value) => `${value}`,
  className,
}: LineChartProps) {
  const chartConfig = {
    ...categories.reduce(
      (acc, category, i) => ({
        ...acc,
        [category]: {
          color: colors[i % colors.length],
        },
      }),
      {}
    ),
  };

  return (
    <ChartContainer config={chartConfig} className={className}>
      <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 2" stroke="var(--border)" />
        <XAxis
          dataKey={index}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          stroke="var(--border)"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => valueFormatter(value)}
        />
        <ChartTooltip
          content={(
            <CustomTooltipContent
              valueFormatter={(value) => valueFormatter(value)}
            />
          )}
        />
        {categories.map((category, i) => (
          <Line
            key={category}
            type="monotone"
            dataKey={category}
            stroke={`var(--color-${category}, ${colors[i % colors.length]})`}
            strokeWidth={2}
            dot={{
              r: 4,
              fill: `var(--color-${category}, ${colors[i % colors.length]})`,
              strokeWidth: 0,
            }}
          />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  );
}

interface PieChartProps extends ChartProps {
  index: string;
  category: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
}

export function PieChart({
  data,
  index,
  category,
  colors = ["blue", "green", "red", "orange", "purple"],
  valueFormatter = (value) => `${value}`,
  className,
}: PieChartProps) {
  const chartConfig = {
    ...data.reduce(
      (acc, item, i) => ({
        ...acc,
        [item[index]]: {
          color: colors[i % colors.length],
        },
      }),
      {}
    ),
  };

  return (
    <ChartContainer config={chartConfig} className={className}>
      <RechartsPieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <Pie
          data={data}
          dataKey={category}
          nameKey={index}
          cx="50%"
          cy="50%"
          outerRadius="80%"
          innerRadius="40%"
          paddingAngle={2}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell
              key={`cell-${i}`}
              fill={`var(--color-${entry[index]}, ${colors[i % colors.length]})`}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [valueFormatter(value as number), ""]}
        />
        <Legend />
      </RechartsPieChart>
    </ChartContainer>
  );
}