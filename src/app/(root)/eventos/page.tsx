"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/api";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Calendar,
    TrendingUp,
    CreditCard,
    Users,
    Building2,
    ChevronLeftIcon,
    ChevronRightIcon,
    Search,
    Filter,
    DollarSign
} from "lucide-react";
import { toast } from 'sonner';
import { type GenericId as Id } from "convex/values";

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
    const [selectedOrganization, setSelectedOrganization] = useState("all");
    const [currentPage, setCurrentPage] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [eventsWithRevenue, setEventsWithRevenue] = useState<any[]>([]);
    const [isLoadingRevenue, setIsLoadingRevenue] = useState(false);

    // Debounce do termo de busca
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Buscar eventos usando a função original
    const eventsData = useQuery(
        api.admin.listAllEvents,
        {
            userId: user?.id || "",
            skip: currentPage * itemsPerPage,
            limit: itemsPerPage,
            searchTerm: debouncedSearchTerm
        }
    );

    // Mutação para buscar transações
    const getOrganizationTransactionsMutation = useMutation(api.admin.getOrganizationTransactionsMutation);

    // Função para calcular faturamento de um evento
    const calculateEventRevenue = async (event: any) => {
        try {
            const organizationId = event.organizationId || event._id;
            const transactions = await getOrganizationTransactionsMutation({
                organizationId,
                userId: user?.id || ""
            });

            if (transactions && transactions.length > 0) {
                // Filtrar transações apenas deste evento específico
                const eventTransactions = transactions.filter((t: any) => t.eventId === event._id);
                
                // Calcular faturamento total (somar apenas transações com status 'paid' ou 'completed')
                const totalRevenue = eventTransactions
                    .filter((t: any) => t.status === 'paid' || t.status === 'completed')
                    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

                return {
                    ...event,
                    revenue: totalRevenue,
                    transactionCount: eventTransactions.length
                };
            }

            return {
                ...event,
                revenue: 0,
                transactionCount: 0
            };
        } catch (error) {
            console.error(`Erro ao calcular faturamento do evento ${event.name}:`, error);
            return {
                ...event,
                revenue: 0,
                transactionCount: 0
            };
        }
    };

    // Calcular faturamento para todos os eventos quando os dados mudarem
    useEffect(() => {
        const loadEventsWithRevenue = async () => {
            if (eventsData?.events && user?.id) {
                setIsLoadingRevenue(true);
                
                const eventsWithRevenueData = await Promise.all(
                    eventsData.events.map(calculateEventRevenue)
                );
                
                setEventsWithRevenue(eventsWithRevenueData);
                setIsLoadingRevenue(false);
            }
        };

        loadEventsWithRevenue();
    }, [eventsData, user?.id]);

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

    const formatDateOnly = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    const getEventStatus = (startDate: number, endDate: number) => {
        const now = Date.now();
        if (startDate > now) return { label: "Próximo", color: "border-blue-500 text-blue-500 bg-blue-500/10" };
        if (endDate < now) return { label: "Finalizado", color: "border-gray-500 text-gray-500 bg-gray-500/10" };
        return { label: "Em andamento", color: "bg-green-500" };
    };

    // Calcular estatísticas dos eventos com faturamento
    const totalRevenue = eventsWithRevenue.reduce((sum, event) => sum + (event.revenue || 0), 0);
    const totalTransactions = eventsWithRevenue.reduce((sum, event) => sum + (event.transactionCount || 0), 0);

    // Loading state
    if (!eventsData) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E65CFF]"></div>
                </div>
            </div>
        );
    }

    const events = eventsWithRevenue.length > 0 ? eventsWithRevenue : eventsData.events || [];
    const totalPages = Math.ceil((eventsData.hasMore ? (currentPage + 1) * itemsPerPage + 1 : events.length) / itemsPerPage);

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Eventos</h1>
                <p className="text-[#A3A3A3] mt-2">
                    Gerencie todos os eventos da plataforma
                </p>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Total de Eventos</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {events.length}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Eventos na página atual
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
                            {events.filter((e: { eventEndDate: number; }) => e.eventEndDate > Date.now()).length}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Eventos em andamento ou futuros
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Eventos Finalizados</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Users className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {events.filter((e: { eventEndDate: number; }) => e.eventEndDate < Date.now()).length}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Eventos já realizados
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Faturamento Total</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {formatCurrency(totalRevenue)}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Receita total dos eventos
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Total Transações</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {totalTransactions}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Transações realizadas
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
                                Visualize e gerencie todos os eventos com informações financeiras
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
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(0);
                                }}
                                className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm"
                            >
                                <option value={10}>10 por página</option>
                                <option value={25}>25 por página</option>
                                <option value={50}>50 por página</option>
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoadingRevenue && (
                        <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E65CFF] mx-auto"></div>
                            <p className="text-[#A3A3A3] mt-2 text-sm">Calculando faturamento...</p>
                        </div>
                    )}
                    
                    {events.length > 0 ? (
                        <>
                            <Table>
                                <TableHeader className="bg-zinc-800">
                                    <TableRow className="border-zinc-700">
                                        <TableHead className="text-[#A3A3A3]">Evento</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Data</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Local</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Faturamento</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Transações</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {events.map((event: any) => {
                                        const status = getEventStatus(event.eventStartDate, event.eventEndDate);

                                        return (
                                            <TableRow key={event._id} className="border-zinc-700 hover:bg-zinc-800">
                                                <TableCell className="text-white font-medium">
                                                    <div>
                                                        <div className="font-medium">{event.name}</div>
                                                        <div className="text-sm text-[#A3A3A3] truncate max-w-[200px]">
                                                            {event.description}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    <div>
                                                        <div className="text-sm">{formatDateOnly(event.eventStartDate)}</div>
                                                        <div className="text-xs text-[#A3A3A3]">
                                                            {new Date(event.eventStartDate).toLocaleTimeString('pt-BR', {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    <div className="max-w-[150px] truncate">
                                                        {event.location || 'Local não informado'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    <div className="font-medium text-green-400">
                                                        {formatCurrency(event.revenue || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    <div className="text-center">
                                                        <Badge variant="outline" className="border-zinc-600 text-white">
                                                            {event.transactionCount || 0}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant='outline' className={`border ${status.color}`}>
                                                        {status.label}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            {/* Paginação */}
                            <div className="flex items-center justify-between mt-4">
                                <div className="text-sm text-[#A3A3A3]">
                                    Página {currentPage + 1} de {totalPages}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                                        disabled={currentPage === 0}
                                        className="border-zinc-700 text-white hover:bg-zinc-800"
                                    >
                                        <ChevronLeftIcon className="h-4 w-4" />
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        disabled={!eventsData.hasMore}
                                        className="border-zinc-700 text-white hover:bg-zinc-800"
                                    >
                                        Próxima
                                        <ChevronRightIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <Calendar className="mx-auto h-12 w-12 text-[#A3A3A3] mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">Nenhum evento encontrado</h3>
                            <p className="text-[#A3A3A3]">
                                {searchTerm ? 'Tente ajustar os filtros de busca.' : 'Não há eventos cadastrados ainda.'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
