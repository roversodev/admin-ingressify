"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Spinner from "@/components/Spinner";
import { DataTable } from "./data-table";
import { columns, Transaction } from "./columns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeBlock } from "@/components/ui/code-block";
import { type GenericId as Id } from "convex/values";

export default function TransacoesPage() {
    const { user, isLoaded } = useUser();
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState<"email" | "cpf" | "transaction">("email");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
    const [transactionDetails, setTransactionDetails] = useState<any>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("all");
    const [events, setEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Buscar eventos ativos usando useQuery
    const eventsData = useQuery(
        api.admin.listAllEvents,
        isLoaded && user?.id ? {
            userId: user.id,
            limit: 100,
            skip: 0
        } : "skip"
    );
    
    // Declarar os hooks useQuery para transações no nível superior
    const organizationTransactions = useQuery(
        api.admin.getOrganizationTransactions,
        isLoaded && user?.id && selectedEventId && selectedEventId !== "all" ? {
            organizationId: events.find(e => e._id === selectedEventId)?.organizationId || selectedEventId,
            userId: user.id,
            eventId: selectedEventId as unknown as Id<"events"> // Conversão mais segura
        } : "skip"
    );

    // Mutações para buscar transações e tickets
    const getByTransactionIdMutation = useMutation(api.admin.getByTransactionIdMutation);
    const getTicketsByTransactionIdMutation = useMutation(api.admin.getTicketsByTransactionIdMutation);
    const getTicketsByEmailMutation = useMutation(api.admin.getTicketsByEmailMutation);
    const getTicketsByCpfMutation = useMutation(api.admin.getTicketsByCpfMutation);
    const getOrganizationTransactionsMutation = useMutation(api.admin.getOrganizationTransactionsMutation);

    // Atualizar o estado de eventos quando os dados forem carregados
    useEffect(() => {
        if (eventsData) {
            setEvents(eventsData.events ? eventsData.events : []);
        }
    }, [eventsData]);

    // Atualizar transações quando os dados da query forem carregados
    useEffect(() => {
        if (isLoaded && user?.id && selectedEventId && selectedEventId !== "all") {
            setIsLoading(true);
            
            if (organizationTransactions) {
                // Verificar se as transações já têm eventName, caso contrário, adicionar
                const transactionsWithEventInfo = organizationTransactions.map((transaction: any) => {
                    // Se a transação já tem eventName, usar o existente
                    if (transaction.eventName) {
                        return transaction;
                    }
                    
                    // Caso contrário, adicionar o nome do evento
                    const event = events.find(e => e._id === selectedEventId);
                    return {
                        ...transaction,
                        eventName: event?.name || "Evento desconhecido",
                        eventStartDate: event?.eventStartDate
                    };
                });
                
                setTransactions(transactionsWithEventInfo);
                setIsLoading(false);
            } else {
                setTransactions([]);
                setIsLoading(false);
            }
        }
    }, [organizationTransactions, selectedEventId, events, isLoaded, user]);

    // Buscar transações de múltiplos eventos quando "all" é selecionado
    useEffect(() => {
        const fetchAllTransactions = async () => {
            if (selectedEventId === "all" && events.length > 0 && isLoaded && user?.id) {
                setIsLoading(true);
                let allTransactions: any[] = [];
                
                // Limitar a 10 eventos para não sobrecarregar
                const eventsToProcess = events.slice(0, 10);
                const transactionsMap = new Map(); // Usar um Map para evitar duplicações
                
                for (const event of eventsToProcess) {
                    try {
                        const organizationId = event.organizationId || event._id;
                        // Aqui usamos a mutação em vez de useQuery
                        const result = await getOrganizationTransactionsMutation({
                            organizationId,
                            userId: user.id
                        });
                        
                        if (result && result.length > 0) {
                            // Adicionar ao Map usando transactionId como chave para evitar duplicações
                            result.forEach((transaction: any) => {
                                if (!transactionsMap.has(transaction.transactionId)) {
                                    transactionsMap.set(transaction.transactionId, transaction);
                                }
                            });
                        }
                    } catch (err) {
                        console.error(`Erro ao buscar transações do evento ${event.name}:`, err);
                    }
                }
                
                // Converter o Map para array
                allTransactions = Array.from(transactionsMap.values());
                
                // Ordenar transações por data (mais recentes primeiro)
                allTransactions.sort((a, b) => b.createdAt - a.createdAt);
                setTransactions(allTransactions);
                setIsLoading(false);
            }
        };
        
        if (selectedEventId === "all") {
            fetchAllTransactions();
        }
    }, [selectedEventId, events, isLoaded, user]);

    // Função para buscar transações por termo de pesquisa
    const handleSearch = async () => {
        if (!searchTerm) {
            toast.error("Digite um termo para pesquisar");
            return;
        }

        setIsSearching(true);
        setSearchResults([]);
        setSelectedTransaction(null);
        setTransactionDetails(null);

        try {
            let results;

            if (searchType === "email") {
                // Buscar por email usando a nova mutação
                results = await getTicketsByEmailMutation({ email: searchTerm });
            } else if (searchType === "cpf") {
                // Buscar por CPF usando a nova mutação
                results = await getTicketsByCpfMutation({ cpf: searchTerm });
            } else {
                // Buscar por ID da transação usando as novas mutações
                const transaction = await getByTransactionIdMutation({ transactionId: searchTerm }); 
                if (transaction) {
                    const tickets = await getTicketsByTransactionIdMutation({ transactionId: searchTerm });
                    if (tickets) {
                        results = tickets;
                        setSelectedTransaction(transaction);
                    }
                }
            }

            if (results && results.length > 0) {
                setSearchResults(results);
                toast.success(`${results.length} resultado(s) encontrado(s)`);
            } else {
                toast.error("Nenhum resultado encontrado");
            }
        } catch (error) {
            console.error("Erro ao buscar:", error);
            toast.error("Erro ao realizar a busca");
        } finally {
            setIsSearching(false);
        }
    };

    // Função para ver detalhes de uma transação
    const handleViewDetails = async (transactionId: string) => {
        try {
            const transaction = await getByTransactionIdMutation({ transactionId });
            const tickets = await getTicketsByTransactionIdMutation({ transactionId });

            if (transaction && tickets) {
                setSelectedTransaction(transaction);
                setTransactionDetails({
                    transaction,
                    tickets,
                    eventName: transaction.eventName,
                    eventStartDate: transaction.eventStartDate
                });
            }
        } catch (error) {
            console.error("Erro ao buscar detalhes:", error);
            toast.error("Erro ao buscar detalhes da transação");
        }
    };

    // Adicionar event listener para o evento personalizado
    useEffect(() => {
        const handleViewTransactionDetails = (event: CustomEvent) => {
            handleViewDetails(event.detail);
        };

        document.addEventListener('view-transaction-details', handleViewTransactionDetails as EventListener);

        return () => {
            document.removeEventListener('view-transaction-details', handleViewTransactionDetails as EventListener);
        };
    }, []);

    // Verificar se uma transação é elegível para reembolso
    const checkRefundEligibility = (transaction: any, eventStartDate: number) => {
        if (!transaction || !eventStartDate) {
            return { eligible: false, reason: "Informações insuficientes" };
        }

        const now = Date.now();
        const purchaseDate = transaction.createdAt;
        const sevenDaysAfterPurchase = purchaseDate + 7 * 24 * 60 * 60 * 1000; // 7 dias em ms
        const fortyEightHoursBeforeEvent = eventStartDate - 48 * 60 * 60 * 1000; // 48 horas em ms

        // Verificar se faltam menos de 48 horas para o evento
        if (now > fortyEightHoursBeforeEvent) {
            return { eligible: false, reason: "Faltam menos de 48 horas para o evento" };
        }

        // Verificar se está dentro do período de 7 dias após a compra
        if (now <= sevenDaysAfterPurchase) {
            return { eligible: true, reason: "Dentro do período de 7 dias após a compra" };
        }

        return { eligible: false, reason: "Mais de 7 dias após a compra" };
    };

    // Funções de formatação
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('pt-BR');
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    if (!isLoaded) {
        return <Spinner />;
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Gerenciamento de Transações</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Pesquisar Transações</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder={searchType === "email" ? "Email do cliente" : searchType === "cpf" ? "CPF do cliente" : "ID da transação"}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select
                                value={searchType}
                                onValueChange={(value) => setSearchType(value as "email" | "cpf" | "transaction")}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="cpf">CPF</SelectItem>
                                    <SelectItem value="transaction">ID da Transação</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleSearch} disabled={isSearching}>
                                {isSearching ? "Buscando..." : "Buscar"}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Todas as Transações</CardTitle>
                    <div className="flex flex-col md:flex-row gap-4 mt-2">
                        <Select
                            value={selectedEventId}
                            onValueChange={setSelectedEventId}
                        >
                            <SelectTrigger className="w-[250px]">
                                <SelectValue placeholder="Selecione um evento" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os eventos</SelectItem>
                                {events && events.length > 0 && events.map((event) => (
                                    <SelectItem key={event._id} value={event._id}>
                                        {event.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isLoading}
                        >
                            {isLoading ? "Carregando..." : "Atualizar"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="p-8 text-center">
                            <Spinner />
                            <p className="mt-2 text-muted-foreground">Carregando transações...</p>
                        </div>
                    ) : (
                        <DataTable columns={columns} data={transactions} />
                    )}
                </CardContent>
            </Card>

            {searchResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Resultados da Pesquisa</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {searchResults.map((ticket: any) => (
                                <div key={ticket._id} className="border rounded p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold">Ingresso: {ticket._id}</h3>
                                            <p>Transação: {ticket.transactionId}</p>
                                            <p>Evento: {ticket.eventName || "Carregando..."}</p>
                                            <p>Valor: {formatCurrency(ticket.totalAmount)}</p>
                                            <p>Status: <Badge className={ticket.status === "valid" ? "bg-green-500" : ticket.status === "used" ? "bg-blue-500" : "bg-red-500"}>{ticket.status}</Badge></p>
                                        </div>
                                        <Button size="sm" onClick={() => handleViewDetails(ticket.transactionId)}>
                                            Ver Detalhes
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {selectedTransaction && (
                <Card>
                    <CardHeader>
                        <CardTitle>Detalhes da Transação</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h3 className="font-semibold text-lg mb-2">Informações da Transação</h3>
                                    <p><strong>ID:</strong> {selectedTransaction.transactionId}</p>
                                    <p><strong>Data:</strong> {formatDate(selectedTransaction.createdAt)}</p>
                                    <p><strong>Valor:</strong> {formatCurrency(selectedTransaction.amount)}</p>
                                    <p><strong>Status:</strong> <Badge className={selectedTransaction.status === "paid" ? "bg-green-500" : selectedTransaction.status === "pending" ? "bg-yellow-500" : "bg-red-500"}>{selectedTransaction.status}</Badge></p>
                                    <p><strong>Método de Pagamento:</strong> {selectedTransaction.paymentMethod}</p>
                                </div>

                                <div>
                                    <h3 className="font-semibold text-lg mb-2">Informações do Evento</h3>
                                    <p><strong>Nome:</strong> {transactionDetails?.eventName || selectedTransaction.eventName || "Carregando..."}</p>
                                    <p><strong>Data do Evento:</strong> {(transactionDetails?.eventStartDate || selectedTransaction.eventStartDate) ? formatDate(transactionDetails?.eventStartDate || selectedTransaction.eventStartDate) : "Carregando..."}</p>

                                    {(transactionDetails?.eventStartDate || selectedTransaction.eventStartDate) && (
                                        <div className="mt-4">
                                            <h4 className="font-semibold">Status de Reembolso</h4>
                                            {(() => {
                                                const refundStatus = checkRefundEligibility(selectedTransaction, transactionDetails?.eventStartDate || selectedTransaction.eventStartDate);
                                                return (
                                                    <div className="mt-2">
                                                        <Badge className={refundStatus.eligible ? "bg-green-500" : "bg-red-500"}>
                                                            {refundStatus.eligible ? "Elegível para reembolso" : "Não elegível para reembolso"}
                                                        </Badge>
                                                        <p className="text-sm mt-1">{refundStatus.reason}</p>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {transactionDetails?.tickets && (
                                <div className="mt-6">
                                    <h3 className="font-semibold text-lg mb-2">Ingressos</h3>
                                    <div className="space-y-2">
                                        {transactionDetails.tickets.map((ticket: any) => (
                                            <div key={ticket._id} className="border rounded p-3">
                                                <p><strong>ID:</strong> {ticket._id}</p>
                                                <p><strong>Tipo:</strong> {ticket.ticketTypeName || "Carregando..."}</p>
                                                <p><strong>Quantidade:</strong> {ticket.quantity}</p>
                                                <p><strong>Valor Unitário:</strong> {formatCurrency(ticket.unitPrice)}</p>
                                                <p><strong>Status:</strong> <Badge className={ticket.status === "valid" ? "bg-green-500" : ticket.status === "used" ? "bg-blue-500" : "bg-red-500"}>{ticket.status}</Badge></p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-6">
                                <h3 className="font-semibold text-lg mb-2">Informações do Cliente</h3>
                                <p><strong>ID do Usuário:</strong> {selectedTransaction.userId}</p>
                                <p className="my-2"><strong>Metadados:</strong></p>
                                <CodeBlock
                                language="json"
                                filename="metadata.json"
                                code={JSON.stringify(selectedTransaction.metadata, null, 2)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}