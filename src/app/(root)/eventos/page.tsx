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
    DollarSign,
    Eye,
    X,
    Clock,
    MapPin,
    Ticket,
    Smartphone,
    Wallet,
    PiggyBank
} from "lucide-react";
import { toast } from 'sonner';
import { type GenericId as Id } from "convex/values";
import { feeCalculations, CustomFeeSettings } from "@/lib/fees";

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

// Função para calcular valores corretos de uma transação
const calculateTransactionAmounts = (transaction: any, eventFeeSettings?: CustomFeeSettings | null) => {
    const totalAmount = transaction.amount;
    const discountAmount = transaction.metadata?.discountAmount || 0;
    const paymentMethod = transaction.paymentMethod === 'pix' ? 'PIX' : 'CARD';
    
    // Usar as funções de cálculo de taxas com configurações personalizadas
    const producerAmount = feeCalculations.calculateProducerAmount(
        totalAmount,
        discountAmount,
        paymentMethod,
        eventFeeSettings || undefined
    );
    
    // Taxa da plataforma é a diferença entre o total e o valor do produtor
    const platformFee = totalAmount - producerAmount;
    
    // Valor original (antes de descontos)
    const originalAmount = totalAmount + discountAmount;

    return {
        totalAmount,
        producerAmount,
        platformFee,
        originalAmount
    };
};

// Função para verificar se transação de cartão foi liberada (D+15)
const isCardTransactionReleased = (transaction: any): boolean => {
    if (transaction.paymentMethod === 'pix') return true;
    if (!transaction.paidAt && !transaction.createdAt) return false;
    
    const paidDate = new Date(transaction.paidAt || transaction.createdAt);
    const releaseDate = new Date(paidDate);
    releaseDate.setDate(releaseDate.getDate());
    
    return new Date() >= releaseDate;
};

export default function EventsPage() {
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedOrganization, setSelectedOrganization] = useState("all");
    const [currentPage, setCurrentPage] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [eventsWithRevenue, setEventsWithRevenue] = useState<any[]>([]);
    const [isLoadingRevenue, setIsLoadingRevenue] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    
    // Estados para estatísticas globais dos cards
    const [globalStats, setGlobalStats] = useState({
        totalEvents: 0,
        activeEvents: 0,
        totalRevenue: 0,
        totalProducerAmount: 0,
        totalTransactions: 0,
        totalPixAvailable: 0,
        totalCardInRelease: 0,
        totalCardAvailable: 0,
        totalAvailableBalance: 0
    });
    const [isLoadingGlobalStats, setIsLoadingGlobalStats] = useState(false);

    // Debounce do termo de busca
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Buscar eventos paginados para a tabela
    const eventsData = useQuery(
        api.admin.listAllEvents,
        {
            userId: user?.id || "",
            skip: currentPage * itemsPerPage,
            limit: itemsPerPage,
            searchTerm: debouncedSearchTerm
        }
    );

    // Buscar TODOS os eventos para calcular estatísticas globais dos cards
    const allEventsData = useQuery(
        api.admin.listAllEvents,
        {
            userId: user?.id || "",
            skip: 0,
            limit: 1000, // Limite alto para pegar todos os eventos
            searchTerm: "" // Sem filtro de busca para estatísticas globais
        }
    );

    // Mutação para buscar transações
    const getEventTransactionsMutation = useMutation(api.admin.getEventTransactionsMutation);
    
    // Nova query para buscar saques completados
    const getOrganizationCompletedWithdrawals = useMutation(api.admin.getOrganizationCompletedWithdrawals);

    // Função para calcular faturamento de um evento
    const calculateEventRevenue = async (event: any) => {
        try {
            // Buscar transações diretamente do evento
            const eventTransactions = await getEventTransactionsMutation({
                eventId: event._id,
                userId: user?.id || ""
            });

            // Buscar saques completados ESPECÍFICOS DESTE EVENTO
            const withdrawalsData = await getOrganizationCompletedWithdrawals({
                organizationId: event.organizationId || event._id,
                eventId: event._id // Filtrar saques por evento específico
            });

            if (eventTransactions && eventTransactions.length > 0) {

                // Converter feeSettings para o formato esperado pela função de cálculo
                const customFeeSettings: CustomFeeSettings | null = event.feeSettings ? {
                    pixFeePercentage: event.feeSettings.pixFeePercentage,
                    cardFeePercentage: event.feeSettings.cardFeePercentage,
                    useCustomFees: true
                } : null;

                // Calcular valores corretos
                let totalRevenue = 0;
                let totalProducerAmount = 0;
                let totalPlatformFees = 0;
                let pixAvailable = 0;
                let cardInRelease = 0;
                let cardAvailable = 0;
                let pixRevenue = 0;
                let cardRevenue = 0;
                let pixTransactionCount = 0;
                let cardTransactionCount = 0;

                const paidTransactions = eventTransactions.filter((t: any) => t.status === 'paid' || t.status === 'completed');

                paidTransactions.forEach((transaction: any) => {
                    const amounts = calculateTransactionAmounts(transaction, customFeeSettings);
                    totalRevenue += amounts.totalAmount;
                    totalProducerAmount += amounts.producerAmount;
                    totalPlatformFees += amounts.platformFee;
                    
                    // Calcular faturamento e contagem por método de pagamento
                    if (transaction.paymentMethod === 'pix') {
                        pixRevenue += amounts.totalAmount;
                        pixAvailable += amounts.producerAmount;
                        pixTransactionCount++;
                    } else {
                        cardRevenue += amounts.totalAmount;
                        cardTransactionCount++;
                        if (isCardTransactionReleased(transaction)) {
                            cardAvailable += amounts.producerAmount;
                        } else {
                            cardInRelease += amounts.producerAmount;
                        }
                    }
                });

                // Descontar saques específicos deste evento
                const eventWithdrawals = withdrawalsData?.totalWithdrawn || 0;
                
                // Aplicar desconto dos saques nos saldos disponíveis
                // Distribuir proporcionalmente entre PIX e Cartão baseado nos valores disponíveis
                const totalAvailableBeforeWithdrawals = pixAvailable + cardAvailable;
                
                if (totalAvailableBeforeWithdrawals > 0 && eventWithdrawals > 0) {
                    const pixProportion = pixAvailable / totalAvailableBeforeWithdrawals;
                    const cardProportion = cardAvailable / totalAvailableBeforeWithdrawals;
                    
                    const pixWithdrawalDeduction = Math.min(pixAvailable, eventWithdrawals * pixProportion);
                    const cardWithdrawalDeduction = Math.min(cardAvailable, eventWithdrawals * cardProportion);
                    
                    pixAvailable = Math.max(0, pixAvailable - pixWithdrawalDeduction);
                    cardAvailable = Math.max(0, cardAvailable - cardWithdrawalDeduction);
                }

                return {
                    ...event,
                    revenue: totalRevenue,
                    producerAmount: totalProducerAmount,
                    platformFees: totalPlatformFees,
                    transactionCount: eventTransactions.length,
                    paidTransactionCount: paidTransactions.length,
                    pixAvailable,
                    cardInRelease,
                    cardAvailable,
                    pixRevenue,
                    cardRevenue,
                    pixTransactionCount,
                    cardTransactionCount,
                    totalWithdrawn: eventWithdrawals
                };
            }

            return {
                ...event,
                revenue: 0,
                producerAmount: 0,
                platformFees: 0,
                transactionCount: 0,
                paidTransactionCount: 0,
                pixAvailable: 0,
                cardInRelease: 0,
                cardAvailable: 0,
                pixRevenue: 0,
                cardRevenue: 0,
                pixTransactionCount: 0,
                cardTransactionCount: 0,
                totalWithdrawn: 0
            };
        } catch (error) {
            console.error(`Erro ao calcular faturamento do evento ${event.name}:`, error);
            return {
                ...event,
                revenue: 0,
                producerAmount: 0,
                platformFees: 0,
                transactionCount: 0,
                paidTransactionCount: 0,
                pixAvailable: 0,
                cardInRelease: 0,
                cardAvailable: 0,
                pixRevenue: 0,
                cardRevenue: 0,
                pixTransactionCount: 0,
                cardTransactionCount: 0,
                totalWithdrawn: 0
            };
        }
    };

    // Calcular faturamento para eventos da tabela (paginados)
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

    // Calcular estatísticas globais para os cards
    useEffect(() => {
        const loadGlobalStats = async () => {
            if (allEventsData?.events && user?.id) {
                setIsLoadingGlobalStats(true);

                try {
                    const allEventsWithRevenue = await Promise.all(
                        allEventsData.events.map(calculateEventRevenue)
                    );

                    // Calcular estatísticas globais
                    const totalEvents = allEventsWithRevenue.length;
                    const activeEvents = allEventsWithRevenue.filter((e: { eventEndDate: number; }) => e.eventEndDate > Date.now()).length;
                    const totalRevenue = allEventsWithRevenue.reduce((sum, event) => sum + (event.revenue || 0), 0);
                    const totalProducerAmount = allEventsWithRevenue.reduce((sum, event) => sum + (event.producerAmount || 0), 0);
                    const totalTransactions = allEventsWithRevenue.reduce((sum, event) => sum + (event.transactionCount || 0), 0);
                    const totalPixAvailable = allEventsWithRevenue.reduce((sum, event) => sum + (event.pixAvailable || 0), 0);
                    const totalCardInRelease = allEventsWithRevenue.reduce((sum, event) => sum + (event.cardInRelease || 0), 0);
                    const totalCardAvailable = allEventsWithRevenue.reduce((sum, event) => sum + (event.cardAvailable || 0), 0);
                    const totalAvailableBalance = totalPixAvailable + totalCardAvailable;

                    setGlobalStats({
                        totalEvents,
                        activeEvents,
                        totalRevenue,
                        totalProducerAmount,
                        totalTransactions,
                        totalPixAvailable,
                        totalCardInRelease,
                        totalCardAvailable,
                        totalAvailableBalance
                    });
                } catch (error) {
                    console.error('Erro ao calcular estatísticas globais:', error);
                } finally {
                    setIsLoadingGlobalStats(false);
                }
            }
        };

        loadGlobalStats();
    }, [allEventsData, user?.id]);

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

    const openEventDrawer = async (event: any) => {
        setSelectedEvent(event);
        setIsDrawerOpen(true);
    };

    const closeEventDrawer = () => {
        setIsDrawerOpen(false);
        setSelectedEvent(null);
    };

    // Loading state
    if (!eventsData || !allEventsData) {
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
                    Gerencie todos os eventos da plataforma com cálculos financeiros precisos
                </p>
            </div>

            {/* Cards de Resumo - Expandidos com Saldos */}
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
                            {isLoadingGlobalStats ? (
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
                            {isLoadingGlobalStats ? (
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
                            {isLoadingGlobalStats ? (
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

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">PIX Disponível</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Smartphone className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {isLoadingGlobalStats ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E65CFF]"></div>
                            ) : (
                                formatCurrency(globalStats.totalPixAvailable)
                            )}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Liberado imediatamente
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Cartão em Liberação</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-400">
                            {isLoadingGlobalStats ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E65CFF]"></div>
                            ) : (
                                formatCurrency(globalStats.totalCardInRelease)
                            )}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Aguardando D+15
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Faturamento Bruto</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {isLoadingGlobalStats ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E65CFF]"></div>
                            ) : (
                                formatCurrency(globalStats.totalRevenue)
                            )}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Receita total da plataforma
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
                            <p className="text-[#A3A3A3] mt-2 text-sm">Calculando valores financeiros...</p>
                        </div>
                    )}

                    {events.length > 0 ? (
                        <>
                            <Table>
                                <TableHeader className="bg-zinc-800">
                                    <TableRow className="border-zinc-700">
                                        <TableHead className="text-[#A3A3A3]">Evento</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Data</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Faturamento Bruto</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Valor ao Produtor</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Saldo Disponível</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Transações</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Status</TableHead>
                                        <TableHead className="text-[#A3A3A3]">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {events.map((event: any) => {
                                        const status = getEventStatus(event.eventStartDate, event.eventEndDate);
                                        const eventAvailableBalance = (event.pixAvailable || 0) + (event.cardAvailable || 0);

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
                                                    <div className="font-medium">
                                                        {formatCurrency(event.revenue || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    <div className="font-medium text-green-400">
                                                        {formatCurrency(event.producerAmount || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    <div className="font-medium text-blue-400">
                                                        {formatCurrency(eventAvailableBalance)}
                                                    </div>
                                                    <div className="text-xs text-[#A3A3A3]">
                                                        PIX: {formatCurrency(event.pixAvailable || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    <div className="flex items-center">
                                                        <Users className="h-4 w-4 mr-1 text-[#A3A3A3]" />
                                                        <span>{event.transactionCount || 0}</span>
                                                    </div>
                                                    <div className="text-xs text-[#A3A3A3]">
                                                        {event.paidTransactionCount || 0} pagas
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    <Badge
                                                        variant="outline"
                                                        className={status.color}
                                                    >
                                                        {status.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openEventDrawer(event)}
                                                        className="border-zinc-700 text-white hover:bg-zinc-800"
                                                    >
                                                        <Eye className="h-4 w-4 mr-1" />
                                                        Ver Detalhes
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            {/* Paginação */}
                            <div className="flex items-center justify-between space-x-2 py-4">
                                <div className="text-sm text-[#A3A3A3]">
                                    Mostrando {currentPage * itemsPerPage + 1} a {Math.min((currentPage + 1) * itemsPerPage, events.length)} de {events.length} eventos
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
                                        disabled={currentPage === 0}
                                        className="border-zinc-700 text-white hover:bg-zinc-800"
                                    >
                                        <ChevronLeftIcon className="h-4 w-4" />
                                        Anterior
                                    </Button>
                                    <div className="text-sm text-white">
                                        Página {currentPage + 1} de {totalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))}
                                        disabled={currentPage >= totalPages - 1}
                                        className="border-zinc-700 text-white hover:bg-zinc-800"
                                    >
                                        Próximo
                                        <ChevronRightIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <Calendar className="h-12 w-12 text-[#A3A3A3] mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">Nenhum evento encontrado</h3>
                            <p className="text-[#A3A3A3]">
                                {searchTerm ? 'Tente ajustar os filtros de busca.' : 'Não há eventos cadastrados ainda.'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Drawer de Detalhes do Evento */}
            {isDrawerOpen && selectedEvent && (
                <div className="fixed inset-0 z-50 bg-black/50" onClick={closeEventDrawer}>
                    <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-zinc-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex h-full flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">{selectedEvent.name}</h2>
                                    <p className="text-[#A3A3A3] mt-1">
                                        {formatDate(selectedEvent.eventStartDate)} • {selectedEvent.location}
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

                            <div className="flex-1 overflow-y-auto p-6">
                                {/* Resumo Financeiro */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <Card>
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

                                    <Card>
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

                                    <Card>
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
                                    <Card>
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

                                    <Card>
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
                                    <Card>
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

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-white flex items-center">
                                                <CreditCard className="h-4 w-4 mr-2" />
                                                Cartão
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-[#A3A3A3]">Disponível:</span>
                                                    <span className="font-medium text-green-400">
                                                        {formatCurrency(selectedEvent.cardAvailable || 0)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-[#A3A3A3]">Em liberação (D+15):</span>
                                                    <span className="font-medium text-orange-400">
                                                        {formatCurrency(selectedEvent.cardInRelease || 0)}
                                                    </span>
                                                </div>
                                            </div>
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
