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
                <Card className="border-l-4 border-l-[#E65CFF] shadow-md hover:shadow-lg transition-shadow duration-300">
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

                <Card className="border-l-4 border-l-[#E65CFF] shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Custos de Processamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {financialMetrics ? (
                            <div className="text-2xl font-bold">
                                {financialMetrics.summary.processingCosts}
                            </div>
                        ) : (
                            <Skeleton className="h-8 w-28" />
                        )}
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-[#E65CFF] shadow-md hover:shadow-lg transition-shadow duration-300">
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
                <TabsList className="p-1">
                    <TabsTrigger value="overview" className="data-[state=active]:text-white">Visão Geral</TabsTrigger>
                    <TabsTrigger value="transactions" className="data-[state=active]:text-white">Transações</TabsTrigger>
                    <TabsTrigger value="payment-methods" className="data-[state=active]:text-white">Métodos de Pagamento</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                        <CardHeader className="border-b border-border/60">
                            <CardTitle>Resumo Financeiro</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                            {financialMetrics ? (
                                <>
                                    <div className="bg-secondary/10 p-5 rounded-lg">
                                        <h3 className="text-lg font-semibold mb-4">Valores</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center pb-2 border-b border-border/40">
                                                <span className="text-muted-foreground">Volume Total:</span>
                                                <span className="font-medium">{financialMetrics.summary.totalAmount}</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b border-border/40">
                                                <span className="text-muted-foreground">Valor para Produtores:</span>
                                                <span className="font-medium">{financialMetrics.summary.producerAmount}</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b border-border/40">
                                                <span className="text-muted-foreground">Receita da Plataforma:</span>
                                                <span className="font-medium">{financialMetrics.summary.platformRevenue}</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b border-border/40">
                                                <span className="text-muted-foreground">Custo PIX (0.69%):</span>
                                                <span className="font-medium">{financialMetrics.summary.pixCost}</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b border-border/40">
                                                <span className="text-muted-foreground">Custo Cartão (4.01%-19.40% + R$0,50):</span>
                                                <span className="font-medium">{financialMetrics.summary.cardCost}</span>
                                            </div>
                                            <div className="flex justify-between font-bold pt-1">
                                                <span className="text-destaque">Lucro Líquido:</span>
                                                <span>{financialMetrics.summary.netProfit}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-secondary/10 p-5 rounded-lg">
                                        <h3 className="text-lg font-semibold mb-4">Estatísticas</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center pb-2 border-b border-border/40">
                                                <span className="text-muted-foreground">Total de Transações:</span>
                                                <span className="font-medium">{financialMetrics.totalTransactions}</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b border-border/40">
                                                <span className="text-muted-foreground">Transações PIX:</span>
                                                <span className="font-medium">{financialMetrics.pixTransactions}</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b border-border/40">
                                                <span className="text-muted-foreground">Transações Cartão:</span>
                                                <span className="font-medium">{financialMetrics.cardTransactions}</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b border-border/40">
                                                <span className="text-muted-foreground">Ticket Médio:</span>
                                                <span className="font-medium">
                                                    {financialMetrics.totalTransactions > 0
                                                        ? (financialMetrics.totalAmount / financialMetrics.totalTransactions).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                        : 'R$ 0,00'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center pt-1">
                                                <span className="text-muted-foreground">Receita Média por Transação:</span>
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

                    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                        <CardHeader className="border-b border-border/60">
                            <CardTitle>Receita por Dia</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {financialMetrics ? (
                                <LineChart
                                    data={financialMetrics.transactionsByDay.map((day: { date: any; revenue: number; }) => ({
                                        name: day.date,
                                        Receita: day.revenue
                                    }))}
                                    categories={['Receita']}
                                    index="name"
                                    colors={['#E65CFF']}
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
                    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                        <CardHeader className="border-b border-border/60">
                            <CardTitle>Transações por Dia</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {financialMetrics ? (
                                <BarChart
                                    data={financialMetrics.transactionsByDay.map((day: { date: any; count: any; }) => ({
                                        name: day.date,
                                        Transações: day.count
                                    }))}
                                    categories={['Transações']}
                                    index="name"
                                    colors={['#E65CFF']}
                                    className="max-h-[50vh] w-full"
                                />
                            ) : (
                                <Skeleton className="h-[50vh] w-full" />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payment-methods" className="space-y-4">
                    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                        <CardHeader className="border-b border-border/60">
                            <CardTitle>Distribuição por Método de Pagamento</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
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
                                            colors={['#4ade80', '#E65CFF']}
                                            className="aspect-square"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4 text-destaque">Detalhes por Método</h3>
                                        <div className="space-y-4">
                                            <div className="p-4 border border-green-600/20 rounded-lg bg-green-600/5 shadow-sm">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <svg viewBox="0 0 39 39" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600">
                                                        <path d="M30.4124 29.8356C29.6599 29.8373 28.9146 29.69 28.2193 29.4021C27.5241 29.1143 26.8927 28.6916 26.3617 28.1585L20.5112 22.3081C20.3041 22.1114 20.0294 22.0017 19.7437 22.0017C19.4581 22.0017 19.1833 22.1114 18.9762 22.3081L13.1035 28.1808C12.5726 28.7141 11.9413 29.137 11.246 29.4248C10.5507 29.7127 9.8053 29.8599 9.05278 29.8579H7.89941L15.3099 37.2685C17.6223 39.5808 21.3749 39.5808 23.6872 37.2685L31.1172 29.8356H30.4124ZM9.05278 9.14188C10.585 9.14188 12.0226 9.73807 13.1035 10.819L18.9762 16.6917C19.0771 16.7928 19.197 16.873 19.3289 16.9277C19.4609 16.9824 19.6023 17.0106 19.7451 17.0106C19.888 17.0106 20.0294 16.9824 20.1613 16.9277C20.2933 16.873 20.4131 16.7928 20.514 16.6917L26.3644 10.8413C26.895 10.3083 27.5259 9.88566 28.2206 9.59781C28.9154 9.30995 29.6603 9.16257 30.4124 9.16417H31.1172L23.6872 1.73414C22.576 0.623749 21.0694 0 19.4986 0C17.9277 0 16.4211 0.623749 15.3099 1.73414L7.89941 9.14467L9.05278 9.14188Z" fill="currentColor"></path>
                                                        <path d="M37.2658 15.31L32.7749 10.8191C32.6741 10.8605 32.5663 10.8822 32.4573 10.8831H30.4152C29.3594 10.8831 28.3258 11.3122 27.5819 12.0588L21.7315 17.9092C21.4713 18.1708 21.162 18.3783 20.8214 18.5199C20.4807 18.6615 20.1155 18.7345 19.7466 18.7345C19.3776 18.7345 19.0124 18.6615 18.6717 18.5199C18.3311 18.3783 18.0218 18.1708 17.7616 17.9092L11.8889 12.0337C11.1354 11.2834 10.1162 10.8608 9.05283 10.8581H6.5455C6.44156 10.8572 6.33865 10.8374 6.24184 10.7996L1.73423 15.31C-0.578077 17.6223 -0.578077 21.3749 1.73423 23.69L6.24184 28.1976C6.33758 28.1591 6.43954 28.1383 6.54272 28.1363H9.05283C10.1115 28.1363 11.1423 27.7101 11.8889 26.9634L17.7588 21.0879C18.2944 20.578 19.0056 20.2936 19.7452 20.2936C20.4847 20.2936 21.1959 20.578 21.7315 21.0879L27.5819 26.9384C28.3258 27.685 29.3594 28.1112 30.4152 28.1112H32.4573C32.5687 28.1112 32.6774 28.1391 32.7749 28.1781L37.2658 23.6872C39.5781 21.3749 39.5781 17.6223 37.2658 15.31Z" fill="currentColor"></path>
                                                    </svg>
                                                    <h4 className="font-medium text-green-600">PIX</h4>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center pb-2 border-b border-green-600/10">
                                                        <span className="text-muted-foreground">Transações:</span>
                                                        <span className="font-medium">{financialMetrics.pixTransactions}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pb-2 border-b border-green-600/10">
                                                        <span className="text-muted-foreground">Volume:</span>
                                                        <span className="font-medium">{(financialMetrics.pixAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-muted-foreground">Custo (1%):</span>
                                                        <span className="font-medium">{financialMetrics.summary.pixCost}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 border border-[#E65CFF]/20 rounded-lg bg-[#E65CFF]/5 shadow-sm">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <svg viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-destaque">
                                                        <path d="M28 4.91406V3.4375C28 1.74612 26.6289 0.375 24.9375 0.375H3.0625C1.37112 0.375 0 1.74612 0 3.4375V4.91406C0 5.06505 0.122445 5.1875 0.273438 5.1875H27.7266C27.8776 5.1875 28 5.06505 28 4.91406Z" fill="currentColor"></path>
                                                        <path d="M0 7.21094V16.5625C0 18.2539 1.37112 19.625 3.0625 19.625H24.9375C26.6289 19.625 28 18.2539 28 16.5625V7.21094C28 7.05995 27.8776 6.9375 27.7266 6.9375H0.273438C0.122445 6.9375 0 7.05995 0 7.21094ZM7 14.375C7 14.8582 6.60822 15.25 6.125 15.25H5.25C4.76678 15.25 4.375 14.8582 4.375 14.375V13.5C4.375 13.0168 4.76678 12.625 5.25 12.625H6.125C6.60822 12.625 7 13.0168 7 13.5V14.375Z" fill="currentColor"></path>
                                                    </svg>
                                                    <h4 className="font-medium text-destaque">Cartão</h4>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center pb-2 border-b border-[#E65CFF]/10">
                                                        <span className="text-muted-foreground">Transações:</span>
                                                        <span className="font-medium">{financialMetrics.cardTransactions}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pb-2 border-b border-[#E65CFF]/10">
                                                        <span className="text-muted-foreground">Volume:</span>
                                                        <span className="font-medium">{(financialMetrics.cardAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-muted-foreground">Custo (4.49%):</span>
                                                        <span className="font-medium">{financialMetrics.summary.cardCost}</span>
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