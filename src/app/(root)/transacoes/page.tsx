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
import { feeCalculations } from "@/lib/fees";
import DatePickerWithRange from "@/components/date-picker-with-range";
import { DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { processRefund } from "@/app/actions/refund";
import { checkTransactionStatusMP, sendPushNotification } from "@/app/actions/reprocess-transaction";
import { sendPurchaseEmail } from "@/app/actions/sendPurchaseEmail";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PaginationState } from "@tanstack/react-table";

export default function TransacoesPage() {
    const { user, isLoaded } = useUser();
    const { hasPermission, isLoading: permissionsLoading } = useAdminPermissions();
    const router = useRouter();
    
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState<"email" | "cpf" | "transaction">("email");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
    const [transactionDetails, setTransactionDetails] = useState<any>(null);
    
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    const [selectedEventId, setSelectedEventId] = useState<string>("all");
    const [events, setEvents] = useState<any[]>([]);
    
    // Reset page when event filter changes
    useEffect(() => {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }, [selectedEventId]);

    const [date, setDate] = useState<DateRange | undefined>();
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
    const [refundReason, setRefundReason] = useState("");
    const [isRefunding, setIsRefunding] = useState(false);
    const [isReprocessModalOpen, setIsReprocessModalOpen] = useState(false);
    const [isReprocessing, setIsReprocessing] = useState(false);
    const [reprocessTransactionId, setReprocessTransactionId] = useState("");
    const { isSuperAdmin } = useAdminPermissions();

    const openReprocessModal = (transactionId?: string) => {
        if (!isSuperAdmin) return;
        setReprocessTransactionId(transactionId || "");
        setIsReprocessModalOpen(true);
    };

    const handleReprocess = async () => {
        if (!reprocessTransactionId) return;
        
        setIsReprocessing(true);
        try {
            // 1. Verificar status no Mercado Pago
            const mpResult = await checkTransactionStatusMP(reprocessTransactionId);
            
            if (!mpResult.success) {
                toast.error(`Erro ao verificar MP: ${mpResult.error}`);
                setIsReprocessing(false);
                return;
            }

            
            if (mpResult.status !== 'approved' && mpResult.status !== 'authorized') {
                toast.error(`Transação não aprovada no Mercado Pago. Status: ${mpResult.status}`);
                setIsReprocessing(false);
                return;
            }

            toast.info("Transação aprovada no MP. Criando ingressos...");

            // 2. Criar ingressos (idempotente)
            let transaction = await getByTransactionIdMutation({ transactionId: reprocessTransactionId });
            
            if (!transaction) {
                // Se a transação não existir no banco, tentar criar com os dados do MP
                console.log("Transação não encontrada no banco. Tentando criar com dados do MP...");
                
                const paymentData = mpResult.paymentData;
                const metadata = paymentData.metadata || {};
                
                // Verificar se temos os dados mínimos necessários (eventId e userId)
                // O MP converte chaves para snake_case (eventId -> event_id)
                const eventId = metadata.event_id || metadata.eventId;
                const userId = metadata.user_id || metadata.userId;
                
                if (!eventId || !userId) {
                    toast.error("Transação não encontrada e metadados do MP incompletos (missing event_id/user_id).");
                    setIsReprocessing(false);
                    return;
                }

                try {
                    // Criar a transação
                    await createTransactionMutation({
                        transactionId: reprocessTransactionId,
                        eventId: eventId as Id<"events">,
                        userId: userId,
                        customerId: paymentData.payer?.email || "unknown",
                        amount: paymentData.transaction_amount,
                        status: paymentData.status,
                        paymentMethod: paymentData.payment_method_id || "unknown",
                        metadata: metadata
                    });
                    
                    toast.success("Transação recuperada e criada no banco!");
                    
                    // Buscar a transação recém-criada
                    transaction = await getByTransactionIdMutation({ transactionId: reprocessTransactionId });
                    
                    if (!transaction) {
                         throw new Error("Falha ao recuperar transação após criação.");
                    }
                } catch (err: any) {
                    console.error("Erro ao criar transação recuperada:", err);
                    toast.error(`Erro ao recuperar transação: ${err.message}`);
                    setIsReprocessing(false);
                    return;
                }
            }

            const createResult = await createTicketsFromTransaction({
                transactionId: reprocessTransactionId,
                customerName: transaction.metadata?.name || transaction.metadata?.customerName || transaction.metadata?.customer_name,
                customerEmail: transaction.metadata?.email || transaction.metadata?.customerEmail || transaction.metadata?.customer_email,
                customerCpf: transaction.metadata?.cpf || transaction.metadata?.customerCpf || transaction.metadata?.customer_cpf,
            });

            if (!createResult.success) {
                // Se falhar a criação, mas já existir, pode ser que o erro seja "Tickets already exist"
                // Nesse caso, continuamos para reenviar e-mail
                console.error("Erro/Aviso na criação de ingressos:", createResult.error);
                // Não retornamos aqui para tentar reenviar o email caso os ingressos já existam
            } else {
                toast.success("Ingressos processados com sucesso!");
            }

            // 3. Enviar E-mail e WhatsApp
            // Buscar ingressos criados para pegar os detalhes
            const tickets = await getTicketsByTransactionIdMutation({ transactionId: reprocessTransactionId });
            
            if (tickets && tickets.length > 0) {
                const firstTicket = tickets[0];
                const eventName = transaction.eventName || firstTicket.eventName || "Evento";
                const customerEmail = firstTicket.userEmail || transaction.metadata?.email;
                const customerPhone = firstTicket.userPhone || transaction.metadata?.phone;
                const customerName = firstTicket.userName || transaction.metadata?.name;

                // Buscar localização do evento
                const event = events.find(e => e._id === transaction.eventId);
                const eventLocation = event?.location || "Local a confirmar";

                // Enviar Email
                if (customerEmail) {
                    toast.loading("Enviando e-mail...");
                    const emailResult = await sendPurchaseEmail({
                        to: customerEmail,
                        customerName: customerName,
                        eventName: eventName,
                        eventDate: transaction.eventStartDate || Date.now(),
                        eventLocation: eventLocation,
                        tickets: tickets.map((t: any) => ({
                            type: t.ticketTypeName || "Ingresso",
                            quantity: t.quantity || 1,
                            unitPrice: t.unitPrice || 0,
                            ticketId: t._id
                        })),
                        totalAmount: transaction.amount || 0,
                        transactionId: reprocessTransactionId
                    });
                    
                    if (emailResult.success) {
                        toast.success("E-mail enviado!");
                    } else {
                        console.error("Erro ao enviar email:", emailResult.error);
                        toast.error("Erro ao enviar e-mail.");
                    }
                }

                // Enviar Push Notification
                if (customerEmail) {
                    toast.loading("Enviando Notificação para o cliente...");
                    try {
                        await sendPushNotification({
                            email: customerEmail,
                            eventName,
                            transactionId: reprocessTransactionId
                        });
                        toast.success("Push enviado!");
                    } catch (error) {
                        console.error("Erro ao enviar Push:", error);
                    }
                }
            }
            
            setIsReprocessModalOpen(false);
            setReprocessTransactionId("");
            
        } catch (error) {
            console.error("Erro no reprocessamento:", error);
            toast.error("Erro crítico ao reprocessar transação.");
        } finally {
            setIsReprocessing(false);
            toast.dismiss(); // Limpar toasts de loading
        }
    };

    useEffect(() => {
        if (!permissionsLoading && !hasPermission('view_finances')) {
             toast.error("Acesso negado");
             router.push("/");
        }
    }, [permissionsLoading, hasPermission, router]);

    const handleRefund = async () => {
        if (!selectedTransaction) return;
        
        const paymentId = selectedTransaction.transactionId || selectedTransaction.externalId || selectedTransaction.metadata?.payment_id || selectedTransaction.metadata?.id;
        
        if (!paymentId) {
            toast.error("ID de pagamento não encontrado para esta transação.");
            return;
        }

        setIsRefunding(true);
        try {
            const result = await processRefund(paymentId, refundReason);
            if (result.success) {
                toast.success("Reembolso realizado com sucesso!");
                setIsRefundModalOpen(false);
                setRefundReason("");
            } else {
                toast.error(`Erro ao reembolsar: ${result.error}`);
            }
        } catch (error) {
            toast.error("Erro ao processar reembolso.");
        } finally {
            setIsRefunding(false);
        }
    };
    
    const canManage = hasPermission('manage_finances');

    // Buscar eventos ativos usando useQuery
    const eventsData = useQuery(
        api.admin.listAllEvents,
        isLoaded && user?.id ? {
            userId: user.id,
            limit: 100,
            skip: 0
        } : "skip"
    );
    
    // Buscar transações paginadas
    const transactionsQuery = useQuery(
        api.admin.getAllTransactionsPaginated,
        isLoaded && user?.id ? {
            userId: user.id,
            eventId: selectedEventId === "all" ? undefined : selectedEventId as Id<"events">,
            page: pagination.pageIndex + 1,
            limit: pagination.pageSize
        } : "skip"
    );

    const transactions = transactionsQuery?.transactions || [];
    const pageCount = transactionsQuery?.totalPages || 0;
    const isLoading = !transactionsQuery;

    // Mutações para buscar transações e tickets
    const getByTransactionIdMutation = useMutation(api.admin.getByTransactionIdMutation);
    const createTransactionMutation = useMutation(api.transactions.create);
    const getTicketsByTransactionIdMutation = useMutation(api.admin.getTicketsByTransactionIdMutation);
    const getTicketsByEmailMutation = useMutation(api.admin.getTicketsByEmailMutation);
    const getTicketsByCpfMutation = useMutation(api.admin.getTicketsByCpfMutation);
    const getOrganizationTransactionsMutation = useMutation(api.admin.getOrganizationTransactionsMutation);
    const getEventTransactionsMutation = useMutation(api.admin.getEventTransactionsMutation);
    const createTicketsFromTransaction = useMutation(api.tickets.createTicketsFromTransaction);

    // Atualizar o estado de eventos quando os dados forem carregados
    useEffect(() => {
        if (eventsData) {
            setEvents(eventsData.events ? eventsData.events : []);
        }
    }, [eventsData]);

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

        const handleReprocessEvent = (e: CustomEvent) => {
            openReprocessModal(e.detail);
        };

        document.addEventListener('view-transaction-details', handleViewTransactionDetails as EventListener);
        document.addEventListener('reprocess-transaction', handleReprocessEvent as EventListener);

        return () => {
            document.removeEventListener('view-transaction-details', handleViewTransactionDetails as EventListener);
            document.removeEventListener('reprocess-transaction', handleReprocessEvent as EventListener);
        };
    }, [isSuperAdmin]);

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
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Utilitário para baixar CSV
    const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
        const escape = (val: string) => `"${(val ?? "").toString().replace(/"/g, '""')}"`;
        const csvContent = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportTransactions = async () => {
        try {
            if (!user?.id) {
                toast.error("Usuário não autenticado");
                return;
            }
            if (!date?.from || !date?.to) {
                toast.error("Selecione um período para exportar");
                return;
            }

            const startTs = new Date(date.from.setHours(0, 0, 0, 0)).getTime();
            const endTs = new Date(date.to.setHours(23, 59, 59, 999)).getTime();

            toast.loading("Coletando transações do período selecionado...");

            // Determinar eventos a processar
            const eventItems = selectedEventId === "all"
                ? (events || [])
                : (events || []).filter((e: any) => e._id === selectedEventId);

            // Buscar transações por evento e filtrar pelo período
            const allByEvent = await Promise.all(
                eventItems.map(async (ev: any) => {
                    try {
                        const txs = await getEventTransactionsMutation({ eventId: ev._id as Id<"events">, userId: user.id });
                        return (txs || []).map((t: any) => ({
                            ...t,
                            eventName: t.eventName || ev.name,
                            eventStartDate: t.eventStartDate || ev.eventStartDate,
                        }));
                    } catch {
                        return [];
                    }
                })
            );

            // Achatar, filtrar por período e remover duplicados por transactionId
            const merged = ([] as any[]).concat(...allByEvent)
                .filter((t: any) => typeof t.createdAt === "number" && t.createdAt >= startTs && t.createdAt <= endTs);
            const uniqueById = Array.from(new Map(merged.map(t => [t.transactionId, t])).values());

            if (uniqueById.length === 0) {
                toast.error("Nenhuma transação encontrada no período selecionado");
                toast.dismiss();
                return;
            }

            const headers = [
                "EVENTO",
                "CLIENTE",
                "CPF",
                "WHATSAPP",
                "E-MAIL",
                "DATA/HORA COMPRA",
                "FORMA DE PAGAMENTO",
                "STATUS",
                "PARCELAS",
                "TIPO",
                "VALOR INGRESSOS",
                "VALOR TAXA",
                "JUROS PARCELAMENTO",
                "DESCONTO",
                "VALOR PAGO",
                "VALOR LIQUIDO",
                "TAXA BANCO",
                "COMISSÃO",
                "CÓDIGO DA TRANSAÇÃO"
            ];

            const rows = await Promise.all(
                uniqueById.map(async (t: any) => {
                    try {
                        const allTickets = await getTicketsByTransactionIdMutation({ transactionId: t.transactionId });
                        // Filtrar ingressos transferidos para não contabilizar no valor total
                        const tickets = (allTickets || []).filter((tk: any) => tk.status !== 'transfered');

                        // Dados cliente via tickets, fallback para metadata
                        const firstTicket = tickets?.[0] || allTickets?.[0];
                        const meta = t?.metadata || {};
                        const cliente = firstTicket?.userName || meta?.name || meta?.customerName || "";
                        const cpf = firstTicket?.userCpf || meta?.cpf || meta?.customerCpf || "";
                        const whatsapp = firstTicket?.userPhone || meta?.phone || meta?.customerPhone || "";
                        const email = firstTicket?.userEmail || meta?.email || meta?.customerEmail || "";

                        const installments = meta?.installments || 1;
                        const interestAmount = Number(meta?.interestAmount || 0);

                        const tiposQuantidade = (tickets || []).map((tk: any) => {
                            const qty = tk.quantity ?? 1;
                            const type = tk.ticketTypeName || "Indefinido";
                            return `${type} x${qty}`;
                        }).join(" / ");

                        const subtotal = (tickets || []).reduce((sum: number, tk: any) => {
                            const qty = tk.quantity ?? 1;
                            const unit = tk.unitPrice ?? tk.amount ?? 0;
                            return sum + qty * unit;
                        }, 0);

                        const desconto = (tickets || []).reduce((sum: number, tk: any) => {
                            const d = tk.discountAmount ?? tk.couponDiscount ?? 0;
                            return sum + d;
                        }, 0);

                        const methodRaw: string = (t.paymentMethod || "").toString().toLowerCase();
                        const isOffline = methodRaw.includes("offline") || methodRaw.includes("adjustment");
                        const methodNorm = isOffline ? "OFFLINE" : (methodRaw.includes("card") ? "CARD" : "PIX");
                        const formaPagamento = isOffline ? "Ajuste Offline" : (methodNorm === "PIX" ? "PIX" : "Cartão");

                        // Priorizar o valor total cobrado do metadata se disponível, pois inclui juros
                        const totalPago = Number(t.amount ?? meta?.chargedAmount ?? (subtotal + feeCalculations.calculateFee(subtotal, methodNorm as any) - desconto)) || 0;
                        
                        // Lógica para separar juros de parcelamento do cálculo da plataforma
                        let valorLiquidoProdutor: number;
                        let taxaPlataformaBruta: number;
                        let taxaBanco: number;

                        if (subtotal > 0) {
                            // Se temos o valor dos ingressos, usamos como base para calcular o líquido do produtor
                            const expectedCashTotal = feeCalculations.calculateTotal(subtotal, methodNorm as any, desconto, undefined, t.metadata);
                            
                            valorLiquidoProdutor = feeCalculations.calculateProducerAmount(expectedCashTotal, desconto, methodNorm as any, undefined, t.metadata);
                            
                            // A taxa total (Valor Taxa) é a diferença entre o que o cliente pagou e o que o produtor recebe
                            taxaPlataformaBruta = totalPago - valorLiquidoProdutor;

                            // Taxa banco: Diferença entre o total pago e o recebido líquido (netReceivedAmount)
                            // Se netReceivedAmount não existir, assumimos que o valor recebido é o total pago menos os juros
                            const netReceived = t.netReceivedAmount 
                                ? Number(t.netReceivedAmount) 
                                : (totalPago - interestAmount);
                                
                            taxaBanco = Math.max(0, totalPago - netReceived);
                        } else {
                            // Fallback para lógica antiga se não tiver info de ingressos
                            valorLiquidoProdutor = feeCalculations.calculateProducerAmount(totalPago, desconto, methodNorm as any, undefined, t.metadata);
                            
                            taxaPlataformaBruta = totalPago - valorLiquidoProdutor;
                            
                            const netReceived = t.netReceivedAmount 
                                ? Number(t.netReceivedAmount) 
                                : (totalPago - interestAmount);
                                
                            taxaBanco = Math.max(0, totalPago - netReceived);
                        }

                        // Comissão líquida da plataforma: taxa total - taxa banco
                        const comissaoLiquidaPlataforma = Math.max(0, taxaPlataformaBruta - taxaBanco);

                        // Tradução do status
                        const statusMap: Record<string, string> = {
                            "paid": "Pago",
                            "pending": "Pendente",
                            "failed": "Falhou",
                            "refunded": "Reembolsado",
                            "canceled": "Cancelado",
                            "completed": "Pago"
                        };
                        const statusTraduzido = statusMap[t.status] || t.status || "";

                        return [
                            t.eventName || "",
                            cliente,
                            cpf,
                            whatsapp,
                            email,
                            formatDate(t.createdAt),
                            formaPagamento,
                            statusTraduzido,
                            installments.toString(),
                            tiposQuantidade,
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(subtotal),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(taxaPlataformaBruta),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(interestAmount),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(desconto),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPago),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorLiquidoProdutor),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(taxaBanco),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(comissaoLiquidaPlataforma),
                            t.transactionId || ""
                        ];
                    } catch {
                        // Fallback mínimo se enriquecimento falhar
                        const meta = t?.metadata || {};
                        const methodRaw: string = (t.paymentMethod || "").toString().toLowerCase();
                        const methodNorm = methodRaw.includes("card") ? "CARD" : "PIX";
                        
                        const installments = meta?.installments || 1;
                        const interestAmount = Number(meta?.interestAmount || 0);
                        
                        const totalPago = Number(t.amount ?? 0) || 0;
                        
                        // Fallback cálculo
                        const valorLiquidoProdutor = feeCalculations.calculateProducerAmount(totalPago, 0, methodNorm as any, undefined, t.metadata);
                        const taxaPlataformaBruta = totalPago - valorLiquidoProdutor;
                        
                        const netReceived = t.netReceivedAmount 
                            ? Number(t.netReceivedAmount) 
                            : (totalPago - interestAmount);
                            
                        const taxaBanco = Math.max(0, totalPago - netReceived);
                        const comissaoLiquidaPlataforma = Math.max(0, taxaPlataformaBruta - taxaBanco);

                        // Tradução do status
                        const statusMap: Record<string, string> = {
                            "paid": "Pago",
                            "pending": "Pendente",
                            "failed": "Falhou",
                            "refunded": "Reembolsado",
                            "canceled": "Cancelado",
                            "completed": "Pago"
                        };
                        const statusTraduzido = statusMap[t.status] || t.status || "";

                        return [
                            t.eventName || "",
                            "", "", "", "", // cliente/cpf/whats/email
                            formatDate(t.createdAt),
                            methodNorm === "PIX" ? "PIX" : "Cartão",
                            statusTraduzido,
                            installments.toString(),
                            "",
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(0),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(taxaPlataformaBruta),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(interestAmount),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(0),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPago),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorLiquidoProdutor),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(taxaBanco),
                            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(comissaoLiquidaPlataforma),
                            t.transactionId || ""
                        ];
                    }
                })
            );

            const filename = `transacoes_${selectedEventId === "all" ? "todos" : selectedEventId}_${new Date(startTs).toLocaleDateString("pt-BR")}_${new Date(endTs).toLocaleDateString("pt-BR")}.csv`;
            downloadCSV(filename, headers, rows);
            toast.success("CSV de transações exportado com sucesso!");
        } catch (error) {
            console.error("Erro ao exportar transações:", error);
            toast.error("Erro ao gerar o CSV de transações");
        } finally {
            toast.dismiss();
        }
    };

    if (!isLoaded || permissionsLoading) {
        return <Spinner />;
    }

    if (!hasPermission('view_finances')) {
        return null;
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Gerenciamento de Transações</h1>
                <div className="flex items-center gap-3">
                    <DatePickerWithRange date={date} setDate={setDate} />
                    <Button
                        onClick={handleExportTransactions}
                        variant="default"
                        size="sm"
                    >
                        Exportar CSV
                    </Button>
                </div>
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
                        <DataTable 
                            columns={columns} 
                            data={transactions} 
                            pageCount={pageCount}
                            pagination={pagination}
                            onPaginationChange={setPagination}
                        />
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

                            <div className="mt-8 border-t pt-6">
                                <h3 className="font-semibold text-lg mb-4 text-destructive">Ações de Risco</h3>
                                <div className="flex gap-4">
                                    <Button 
                                        variant="destructive" 
                                        className="flex-1" 
                                        onClick={() => setIsRefundModalOpen(true)}
                                        disabled={!canManage}
                                    >
                                        Reembolsar Transação
                                    </Button>
                                    {isSuperAdmin && (
                                        <Button 
                                            variant="outline"
                                            className="flex-1 text-amber-500 border-amber-500 hover:bg-amber-500/10"
                                            onClick={() => openReprocessModal(selectedTransaction.transactionId)}
                                        >
                                            Reprocessar Transação
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Modal de Reprocessamento */}
            <Dialog open={isReprocessModalOpen} onOpenChange={setIsReprocessModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reprocessar Transação</DialogTitle>
                        <DialogDescription>
                            Esta ação verificará o status no Mercado Pago e, se aprovado, recriará os ingressos e reenviará os e-mails.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="reprocessId">ID da Transação</Label>
                            <Input
                                id="reprocessId"
                                value={reprocessTransactionId}
                                onChange={(e) => setReprocessTransactionId(e.target.value)}
                                placeholder="Insira o ID da transação"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReprocessModalOpen(false)} disabled={isReprocessing}>
                            Cancelar
                        </Button>
                        <Button onClick={handleReprocess} disabled={isReprocessing || !reprocessTransactionId} className="bg-amber-500 hover:bg-amber-600">
                            {isReprocessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processando...
                                </>
                            ) : (
                                "Reprocessar"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRefundModalOpen} onOpenChange={setIsRefundModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Reembolso</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja reembolsar esta transação integralmente? Esta ação enviará uma solicitação de estorno para o processador de pagamento e não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="reason">Motivo do Reembolso</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRefundModalOpen(false)} disabled={isRefunding}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleRefund} disabled={isRefunding}>
                            {isRefunding ? "Processando..." : "Confirmar Reembolso"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}