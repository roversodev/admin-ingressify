'use client';

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DatePickerWithRange from "@/components/date-picker-with-range";
import { useState } from "react";
import { BarChart, LineChart, PieChart } from "@/components/charts";
import { Skeleton } from "@/components/ui/skeleton";
import Spinner from "@/components/Spinner";

export default function FinanceiroPage() {
    const { user } = useUser();
    const [dateRange, setDateRange] = useState({
        from: undefined,
        to: undefined,
    });

    // Converter datas para timestamps
    const startDate = dateRange.from ? new Date(dateRange.from).getTime() : undefined;
    const endDate = dateRange.to ? new Date(dateRange.to).getTime() : undefined;

    const financialMetrics = useQuery(api.admin.getPlatformFinancialMetrics, {
        userId: user?.id || "",
        startDate,
        endDate,
    });

    if (!user) {
        return <Spinner />;
    }

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6">Métricas Financeiras</h1>

            <div className="mb-6">
                <DatePickerWithRange
                    date={dateRange}
                    setDate={(date: any) => setDateRange(date || { from: undefined, to: undefined })}
                    className="w-full max-w-sm"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Receita da Plataforma</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {financialMetrics ? (
                            <div className="text-2xl font-bold">
                                {financialMetrics.summary.platformRevenue}
                            </div>
                        ) : (
                            <Skeleton className="h-8 w-28" />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Custos de Processamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {financialMetrics ? (
                            <div className="text-2xl font-bold">
                                {(parseFloat(financialMetrics.summary.pixCost.replace(/[^0-9,-]/g, '').replace(',', '.')) +
                                    parseFloat(financialMetrics.summary.cardCost.replace(/[^0-9,-]/g, '').replace(',', '.'))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                        ) : (
                            <Skeleton className="h-8 w-28" />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {financialMetrics ? (
                            <div className="text-2xl font-bold">
                                {financialMetrics.summary.netProfit}
                            </div>
                        ) : (
                            <Skeleton className="h-8 w-28" />
                        )}
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                    <TabsTrigger value="transactions">Transações</TabsTrigger>
                    <TabsTrigger value="payment-methods">Métodos de Pagamento</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Resumo Financeiro</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {financialMetrics ? (
                                <>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Valores</h3>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span>Volume Total:</span>
                                                <span className="font-medium">{financialMetrics.summary.totalAmount}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Valor para Produtores:</span>
                                                <span className="font-medium">{financialMetrics.summary.producerAmount}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Receita da Plataforma:</span>
                                                <span className="font-medium">{financialMetrics.summary.platformRevenue}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Custo PIX (1%):</span>
                                                <span className="font-medium">{financialMetrics.summary.pixCost}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Custo Cartão (4.49%):</span>
                                                <span className="font-medium">{financialMetrics.summary.cardCost}</span>
                                            </div>
                                            <div className="flex justify-between font-bold">
                                                <span>Lucro Líquido:</span>
                                                <span>{financialMetrics.summary.netProfit}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Estatísticas</h3>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span>Total de Transações:</span>
                                                <span className="font-medium">{financialMetrics.totalTransactions}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Transações PIX:</span>
                                                <span className="font-medium">{financialMetrics.pixTransactions}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Transações Cartão:</span>
                                                <span className="font-medium">{financialMetrics.cardTransactions}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Ticket Médio:</span>
                                                <span className="font-medium">
                                                    {financialMetrics.totalTransactions > 0
                                                        ? (financialMetrics.totalAmount / financialMetrics.totalTransactions).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                        : 'R$ 0,00'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Receita Média por Transação:</span>
                                                <span className="font-medium">
                                                    {financialMetrics.totalTransactions > 0
                                                        ? (financialMetrics.platformRevenue / financialMetrics.totalTransactions).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                        : 'R$ 0,00'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-2 space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Receita por Dia</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {financialMetrics ? (
                                <LineChart
                                    data={financialMetrics.transactionsByDay.map((day: { date: any; revenue: number; }) => ({
                                        name: day.date,
                                        Receita: day.revenue
                                    }))}
                                    categories={['Receita']}
                                    index="name"
                                    colors={['var(--chart-1)']}
                                    valueFormatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                    className="max-h-[50vh] w-full"
                                />
                            ) : (
                                <Skeleton className="h-[50vh] w-full" />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="transactions" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transações por Dia</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {financialMetrics ? (
                                <BarChart
                                    data={financialMetrics.transactionsByDay.map((day: { date: any; count: any; }) => ({
                                        name: day.date,
                                        Transações: day.count
                                    }))}
                                    categories={['Transações']}
                                    index="name"
                                    colors={['var(--chart-1)']}
                                    className="max-h-[50vh] w-full"
                                />
                            ) : (
                                <Skeleton className="h-[50vh] w-full" />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payment-methods" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Distribuição por Método de Pagamento</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {financialMetrics ? (
                                <>
                                    <div>
                                        <PieChart
                                            data={[
                                                { name: 'PIX', value: financialMetrics.pixTransactions },
                                                { name: 'Cartão', value: financialMetrics.cardTransactions },
                                            ]}
                                            index="name"
                                            category="value"
                                            colors={['green', 'blue']}
                                            className="aspect-square"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Detalhes por Método</h3>
                                        <div className="space-y-4">
                                            <div className="p-4 border rounded-lg">
                                                <h4 className="font-medium text-green-600 mb-2">PIX</h4>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between">
                                                        <span>Transações:</span>
                                                        <span>{financialMetrics.pixTransactions}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Volume:</span>
                                                        <span>{(financialMetrics.pixAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Custo (1%):</span>
                                                        <span>{financialMetrics.summary.pixCost}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 border rounded-lg">
                                                <h4 className="font-medium text-blue-600 mb-2">Cartão</h4>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between">
                                                        <span>Transações:</span>
                                                        <span>{financialMetrics.cardTransactions}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Volume:</span>
                                                        <span>{(financialMetrics.cardAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Custo (4.49%):</span>
                                                        <span>{financialMetrics.summary.cardCost}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-2">
                                    <Skeleton className="h-[300px] w-full" />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}