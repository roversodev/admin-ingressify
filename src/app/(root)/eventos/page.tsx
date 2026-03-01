"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/api";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Calendar,
    TrendingUp,
    CreditCard,
    Search,
    DollarSign,
    X,
    Clock,
    Smartphone,
    Wallet,
} from "lucide-react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { PaginationState } from "@tanstack/react-table";

// Hook para debounce
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export default function EventsPage() {
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = useState("");
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Debounce do termo de busca
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Resetar paginação ao buscar
    useEffect(() => {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }, [debouncedSearchTerm]);

    // Buscar eventos paginados com estatísticas (Otimizado)
    const eventsData = useQuery(
        api.admin.getEventsPageData,
        user?.id ? {
            userId: user.id,
            skip: pagination.pageIndex * pagination.pageSize,
            limit: pagination.pageSize,
            searchTerm: debouncedSearchTerm
        } : "skip"
    );

    // Buscar estatísticas globais (Otimizado)
    const globalStats = useQuery(
        api.admin.getGlobalEventStats,
        user?.id ? { userId: user.id } : "skip"
    );

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    useEffect(() => {
        const handleViewEvent = (e: any) => {
            setSelectedEvent(e.detail);
            setIsDrawerOpen(true);
        };

        document.addEventListener('view-event-details', handleViewEvent);
        return () => {
            document.removeEventListener('view-event-details', handleViewEvent);
        };
    }, []);

    const closeEventDrawer = () => {
        setIsDrawerOpen(false);
        setSelectedEvent(null);
    };

    const events = eventsData?.events || [];
    const totalCount = eventsData?.totalEvents || 0;
    const pageCount = Math.ceil(totalCount / pagination.pageSize);

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Eventos</h1>
                <p className="text-[#A3A3A3] mt-2">
                    Gerencie todos os eventos da plataforma com cálculos financeiros precisos
                </p>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Total de Eventos</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {!globalStats ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E65CFF]"></div>
                            ) : (
                                globalStats.totalEvents
                            )}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Total de eventos na plataforma
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Eventos Ativos</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {!globalStats ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E65CFF]"></div>
                            ) : (
                                globalStats.activeEvents
                            )}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Eventos em andamento ou futuros
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Saldo Disponível</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Wallet className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {!globalStats ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E65CFF]"></div>
                            ) : (
                                formatCurrency(globalStats.totalAvailableBalance)
                            )}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Disponível para saque
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros e Tabela */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div>
                            <CardTitle className="text-white">Lista de Eventos</CardTitle>
                            <CardDescription className="text-[#A3A3A3]">
                                Visualize e gerencie todos os eventos com informações financeiras precisas
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#A3A3A3] h-4 w-4" />
                                <Input
                                    placeholder="Buscar eventos..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder-[#A3A3A3] w-full sm:w-64"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {!eventsData ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E65CFF] mx-auto"></div>
                            <p className="text-[#A3A3A3] mt-2">Carregando eventos...</p>
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-8">
                            <Calendar className="h-12 w-12 text-[#A3A3A3] mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">Nenhum evento encontrado</h3>
                            <p className="text-[#A3A3A3]">
                                {searchTerm ? 'Tente ajustar os filtros de busca.' : 'Não há eventos cadastrados ainda.'}
                            </p>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={events}
                            pageCount={pageCount}
                            pagination={pagination}
                            onPaginationChange={setPagination}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Drawer de Detalhes do Evento */}
            {isDrawerOpen && selectedEvent && (
                <div className="fixed inset-0 z-50 bg-black/50" onClick={closeEventDrawer}>
                    <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-zinc-900 shadow-xl border-l border-zinc-800" onClick={(e) => e.stopPropagation()}>
                        <div className="flex h-full flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">{selectedEvent.name}</h2>
                                    <p className="text-[#A3A3A3] mt-1 text-sm">
                                        {formatDate(selectedEvent.eventStartDate)} • {selectedEvent.location || "Local não informado"}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={closeEventDrawer}
                                    className="text-[#A3A3A3] hover:text-white"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
                                {/* Resumo Financeiro */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <Card className="bg-zinc-900 border-zinc-800">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-white">Faturamento Bruto</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-white">
                                                {formatCurrency(selectedEvent.revenue || 0)}
                                            </div>
                                            <p className="text-xs text-[#A3A3A3]">
                                                {selectedEvent.transactionCount || 0} transações
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-zinc-900 border-zinc-800">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-white">Valor ao Produtor</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-green-400">
                                                {formatCurrency(selectedEvent.producerAmount || 0)}
                                            </div>
                                            <p className="text-xs text-[#A3A3A3]">
                                                Após descontos e taxas
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-zinc-900 border-zinc-800">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-white">Saldo Disponível</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-blue-400">
                                                {formatCurrency((selectedEvent.pixAvailable || 0) + (selectedEvent.cardAvailable || 0))}
                                            </div>
                                            <p className="text-xs text-[#A3A3A3]">
                                                Para saque
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Faturamento por Método de Pagamento */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <Card className="bg-zinc-900 border-zinc-800">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-white flex items-center">
                                                <Smartphone className="h-4 w-4 mr-2" />
                                                Faturamento PIX
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-green-400">
                                                {formatCurrency(selectedEvent.pixRevenue || 0)}
                                            </div>
                                            <p className="text-xs text-[#A3A3A3]">
                                                {selectedEvent.pixTransactionCount || 0} transações via PIX
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-zinc-900 border-zinc-800">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-white flex items-center">
                                                <CreditCard className="h-4 w-4 mr-2" />
                                                Faturamento Cartão
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-blue-400">
                                                {formatCurrency(selectedEvent.cardRevenue || 0)}
                                            </div>
                                            <p className="text-xs text-[#A3A3A3]">
                                                {selectedEvent.cardTransactionCount || 0} transações via cartão
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Detalhamento de Saldos */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <Card className="bg-zinc-900 border-zinc-800">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-white flex items-center">
                                                <Smartphone className="h-4 w-4 mr-2" />
                                                PIX (Disponível)
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-xl font-bold text-green-400">
                                                {formatCurrency(selectedEvent.pixAvailable || 0)}
                                            </div>
                                            <p className="text-xs text-[#A3A3A3]">
                                                Liberado imediatamente
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-zinc-900 border-zinc-800">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-white flex items-center">
                                                <CreditCard className="h-4 w-4 mr-2" />
                                                Cartão (Disponível)
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-xl font-bold text-green-400">
                                                {formatCurrency(selectedEvent.cardAvailable || 0)}
                                            </div>
                                            <p className="text-xs text-[#A3A3A3]">
                                                Liberado imediatamente
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
