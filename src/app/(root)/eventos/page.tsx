"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/api";
import { JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Building2, Users, TrendingUp, Edit, Power, PowerOff, ChevronLeftIcon, ChevronRightIcon, Search, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { type GenericId as Id } from "convex/values";

export default function EventosPage() {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState("events");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterOrganization, setFilterOrganization] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    
    // Estados para paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Queries Convex
    const allEvents = useQuery(api.admin.listAllEvents, {
        userId: user?.id || "",
        searchTerm: searchTerm,
        skip: (currentPage - 1) * itemsPerPage,
        limit: itemsPerPage,
    });

    // Mutation para atualizar evento
    const updateEvent = useMutation(api.events.updateEvent);

    const formatCurrency = (value: number) => {
        if (Math.abs(value) < 0.01) {
            value = 0;
        }
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

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            active: { label: "Ativo", variant: "default" as const },
            inactive: { label: "Inativo", variant: "secondary" as const },
            draft: { label: "Rascunho", variant: "outline" as const },
            cancelled: { label: "Cancelado", variant: "destructive" as const },
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    // Função para alternar status do evento
    const handleToggleEventStatus = async (eventId: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === "active" ? "inactive" : "active";

            toast.success(`Evento ${newStatus === "active" ? "ativado" : "desativado"} com sucesso.`);
        } catch (error) {
            console.error("Erro ao atualizar status do evento:", error);
            toast.error("Ocorreu um erro ao atualizar o status do evento.");
        }
    };

    // Função para abrir modal de edição
    const handleEditEvent = (event: any) => {
        setSelectedEvent(event);
        setIsEditDialogOpen(true);
    };

    // Filtrar eventos
    const filteredEvents = allEvents?.events ? allEvents.events.filter((event: { organizationId: string; status: string; }) => {
        let matchesOrganization = true;
        let matchesStatus = true;

        if (filterOrganization !== "all") {
            matchesOrganization = event.organizationId === filterOrganization;
        }

        if (filterStatus !== "all") {
            matchesStatus = event.status === filterStatus;
        }

        return matchesOrganization && matchesStatus;
    }) : [];

    // Calcular estatísticas
    const eventStats = {
        total: filteredEvents.length,
        active: filteredEvents.filter((e: { status: string; }) => e.status === "active").length,
        inactive: filteredEvents.filter((e: { status: string; }) => e.status === "inactive").length,
        totalRevenue: filteredEvents.reduce((sum: any, e: { totalRevenue: any; }) => sum + (e.totalRevenue || 0), 0),
    };

    // Paginação
    const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
    const paginatedEvents = filteredEvents.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    // Reset página ao mudar filtros
    const handleFilterChange = (filterType: string, value: string) => {
        setCurrentPage(1);
        if (filterType === "organization") {
            setFilterOrganization(value);
        } else if (filterType === "status") {
            setFilterStatus(value);
        }
    };

    if (!user) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E65CFF]"></div>
                </div>
            </div>
        );
    }

    if (!allEvents) {
        return (
            <div className="container mx-auto py-8">
                <div className="mb-8">
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-20 mb-1" />
                                <Skeleton className="h-3 w-32" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Gerenciar Eventos</h1>
                    <p className="text-[#A3A3A3] mt-2">
                        Visualize e gerencie todos os eventos da plataforma
                    </p>
                </div>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Total de Eventos</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {eventStats.total}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Eventos cadastrados
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Eventos Ativos</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Power className="h-4 w-4 text-green-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {eventStats.active}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Em funcionamento
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Eventos Inativos</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <PowerOff className="h-4 w-4 text-red-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {eventStats.inactive}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Desativados
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white">Receita Total</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-[#E65CFF]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {formatCurrency(eventStats.totalRevenue)}
                        </div>
                        <p className="text-xs text-[#A3A3A3]">
                            Receita gerada
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabela de Eventos */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-zinc-800 border border-zinc-700">
                    <TabsTrigger value="events" className="data-[state=active]:bg-[#E65CFF] data-[state=active]:text-white">Eventos</TabsTrigger>
                    <TabsTrigger value="stats" className="data-[state=active]:bg-[#E65CFF] data-[state=active]:text-white">Estatísticas</TabsTrigger>
                </TabsList>

                <TabsContent value="events" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-white">Lista de Eventos</CardTitle>
                            <CardDescription className="text-[#A3A3A3]">
                                Gerencie todos os eventos da plataforma
                            </CardDescription>

                            {/* Filtros e Busca */}
                            <div className="flex flex-wrap gap-4 mt-4">
                                <div className="flex-1 min-w-[200px]">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#A3A3A3]" />
                                        <Input
                                            placeholder="Buscar eventos..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-[#A3A3A3] mb-1 block">Organização</label>
                                    <select
                                        value={filterOrganization}
                                        onChange={(e) => handleFilterChange("organization", e.target.value)}
                                        className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1 text-white text-sm"
                                    >
                                        <option value="all">Todas</option>
                                        {/* Adicionar opções de organizações dinamicamente */}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm text-[#A3A3A3] mb-1 block">Status</label>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => handleFilterChange("status", e.target.value)}
                                        className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1 text-white text-sm"
                                    >
                                        <option value="all">Todos</option>
                                        <option value="active">Ativo</option>
                                        <option value="inactive">Inativo</option>
                                        <option value="draft">Rascunho</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm text-[#A3A3A3] mb-1 block">Por página</label>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1 text-white text-sm"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {paginatedEvents.length > 0 ? (
                                <>
                                    <Table>
                                        <TableHeader className="bg-zinc-800">
                                            <TableRow className="border-zinc-700">
                                                <TableHead className="text-[#A3A3A3]">Nome do Evento</TableHead>
                                                <TableHead className="text-[#A3A3A3]">Organização</TableHead>
                                                <TableHead className="text-[#A3A3A3]">Data</TableHead>
                                                <TableHead className="text-[#A3A3A3]">Status</TableHead>
                                                <TableHead className="text-[#A3A3A3]">Ingressos Vendidos</TableHead>
                                                <TableHead className="text-[#A3A3A3]">Receita</TableHead>
                                                <TableHead className="text-[#A3A3A3]">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedEvents.map((event: { _id: Key | null | undefined; name: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; organizationName: any; startDate: number; status: string; ticketsSold: any; totalRevenue: any; }) => (
                                                <TableRow key={event._id} className="border-zinc-700 hover:bg-zinc-800">
                                                    <TableCell className="text-white font-medium">
                                                        {event.name}
                                                    </TableCell>
                                                    <TableCell className="text-white">
                                                        {event.organizationName || "N/A"}
                                                    </TableCell>
                                                    <TableCell className="text-white">
                                                        {formatDate(event.startDate)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {getStatusBadge(event.status)}
                                                    </TableCell>
                                                    <TableCell className="text-white">
                                                        {event.ticketsSold || 0}
                                                    </TableCell>
                                                    <TableCell className="text-white">
                                                        {formatCurrency(event.totalRevenue || 0)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleEditEvent(event)}
                                                                className="border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleToggleEventStatus(event._id as Id<"events">, event.status)}
                                                                className={`border-zinc-700 hover:bg-zinc-800 ${
                                                                    event.status === "active" 
                                                                        ? "text-red-500 hover:text-red-400" 
                                                                        : "text-green-500 hover:text-green-400"
                                                                }`}
                                                            >
                                                                {event.status === "active" ? (
                                                                    <PowerOff className="h-4 w-4" />
                                                                ) : (
                                                                    <Power className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>

                                    {/* Controles de Paginação */}
                                    <div className="flex items-center justify-between mt-4">
                                        <div className="text-sm text-[#A3A3A3]">
                                            Mostrando {Math.min(filteredEvents.length, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(filteredEvents.length, currentPage * itemsPerPage)} de {filteredEvents.length} eventos
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handlePrevPage}
                                                disabled={currentPage === 1}
                                                className="border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
                                            >
                                                <ChevronLeftIcon className="h-4 w-4" />
                                            </Button>
                                            <span className="text-white">{currentPage} de {totalPages}</span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleNextPage}
                                                disabled={currentPage === totalPages}
                                                className="border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
                                            >
                                                <ChevronRightIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-[#A3A3A3]">
                                    <Calendar className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
                                    <p>Nenhum evento encontrado.</p>
                                    <p className="text-sm">Ajuste os filtros ou aguarde novos eventos.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="stats" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-white">Resumo por Status</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                                    <span className="flex items-center gap-2 text-white">
                                        <Power className="w-4 h-4 text-green-500" />
                                        Eventos Ativos
                                    </span>
                                    <span className="font-bold text-lg text-white">{eventStats.active}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                                    <span className="flex items-center gap-2 text-white">
                                        <PowerOff className="w-4 h-4 text-red-500" />
                                        Eventos Inativos
                                    </span>
                                    <span className="font-bold text-lg text-white">{eventStats.inactive}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-white">Performance Financeira</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-zinc-800 rounded-lg border border-zinc-700 bg-gradient-to-r from-zinc-800 to-zinc-700">
                                    <span className="flex items-center gap-2 text-white font-medium">
                                        <TrendingUp className="w-4 h-4 text-[#E65CFF]" />
                                        Receita Total
                                    </span>
                                    <span className="font-bold text-lg text-[#E65CFF]">
                                        {formatCurrency(eventStats.totalRevenue)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Modal de Edição de Evento */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="bg-zinc-900 border border-zinc-700 text-white max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-white">Editar Evento</DialogTitle>
                        <DialogDescription className="text-[#A3A3A3]">
                            Edite as informações do evento selecionado.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEvent && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="eventName" className="text-white">Nome do Evento</Label>
                                    <Input
                                        id="eventName"
                                        defaultValue={selectedEvent.name}
                                        className="bg-zinc-800 border-zinc-700 text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="eventStatus" className="text-white">Status</Label>
                                    <select
                                        id="eventStatus"
                                        defaultValue={selectedEvent.status}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white"
                                    >
                                        <option value="active">Ativo</option>
                                        <option value="inactive">Inativo</option>
                                        <option value="draft">Rascunho</option>
                                        <option value="cancelled">Cancelado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="eventDescription" className="text-white">Descrição</Label>
                                <textarea
                                    id="eventDescription"
                                    defaultValue={selectedEvent.description}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white min-h-[100px]"
                                    placeholder="Descrição do evento..."
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => setIsEditDialogOpen(false)}
                            className="border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            className="bg-[#E65CFF] hover:bg-[#D24AEE] text-white"
                            onClick={() => {
                                // Implementar lógica de salvamento
                                setIsEditDialogOpen(false);
                                toast.success("As alterações foram salvas com sucesso.");
                            }}
                        >
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}