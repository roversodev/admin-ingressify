'use client';
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/api";
import { JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Skeleton } from "@/components/ui/skeleton";
import { useStorage } from "@/hooks/use-storage";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import Spinner from "@/components/Spinner";
import { GenericId as Id } from "convex/values";
import { useStorageUrl } from "@/lib/utils";
import { Search, Filter, DollarSign, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

// Componente para exibir o status do saque
const WithdrawalStatusBadge = ({ status }: { status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' }) => {
    const statusConfig = {
        pending: { label: "Pendente", variant: "outline", icon: Clock, color: "text-yellow-600" },
        processing: { label: "Em Processamento", variant: "secondary", icon: AlertCircle, color: "text-blue-600" },
        completed: { label: "Concluído", variant: "success", icon: CheckCircle, color: "text-green-600" },
        failed: { label: "Falhou", variant: "destructive", icon: XCircle, color: "text-red-600" },
        cancelled: { label: "Cancelado", variant: "destructive", icon: XCircle, color: "text-red-600" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline", icon: Clock, color: "text-gray-600" };
    const Icon = config.icon;

    return (
        <Badge variant={config.variant as "outline" | "secondary" | "destructive" | "default"} className="flex items-center gap-1">
            <Icon className="w-3 h-3" />
            {config.label}
        </Badge>
    );
};

// Componente para estatísticas rápidas
const QuickStats = ({ withdrawalsResult }: { withdrawalsResult: any }) => {
    if (!withdrawalsResult) return null;

    const totalAmount = withdrawalsResult.withdrawals.reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
    const count = withdrawalsResult.withdrawals.length;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-l-4 border-l-[#E65CFF] hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Total de Saques</p>
                            <p className="text-2xl font-bold">{count}</p>
                        </div>
                        <div className="p-2 bg-[#E65CFF]/10 rounded-lg">
                            <DollarSign className="w-6 h-6 text-destaque" />
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-[#E65CFF] hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Valor Total</p>
                            <p className="text-2xl font-bold">
                                {new Intl.NumberFormat('pt-BR', { 
                                    style: 'currency', 
                                    currency: 'BRL' 
                                }).format(totalAmount)}
                            </p>
                        </div>
                        <div className="p-2 bg-[#E65CFF]/10 rounded-lg">
                            <DollarSign className="w-6 h-6 text-destaque" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-[#E65CFF] hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Valor Médio</p>
                            <p className="text-2xl font-bold">
                                {count > 0 ? new Intl.NumberFormat('pt-BR', { 
                                    style: 'currency', 
                                    currency: 'BRL' 
                                }).format((totalAmount / count)) : 'R$ 0,00'}
                            </p>
                        </div>
                        <div className="p-2 bg-[#E65CFF]/10 rounded-lg">
                            <DollarSign className="w-6 h-6 text-destaque" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default function SaquesPage() {
    const { user } = useUser();
    const { uploadFile } = useStorage();
    const [selectedStatus, setSelectedStatus] = useState("pending");
    const [selectedWithdrawal, setSelectedWithdrawal] = useState<Id<"organizationWithdrawals"> | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isProcessingOpen, setIsProcessingOpen] = useState(false);
    const [processingAction, setProcessingAction] = useState("");
    const [processingNotes, setProcessingNotes] = useState("");
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");

    // Buscar saques
    const withdrawalsResult = useQuery(api.admin.listAllOrganizationWithdrawals, {
        userId: user?.id || "",
        status: selectedStatus as "pending" | "processing" | "completed" | "failed" | "cancelled",
        limit: 50,
        skip: 0,
    });

    // Buscar detalhes de um saque específico
    const withdrawalDetails = useQuery(
        api.admin.getWithdrawalDetails,
        selectedWithdrawal ? {
            userId: user?.id || "",
            withdrawalId: selectedWithdrawal as Id<"organizationWithdrawals">,
        } : "skip"
    );
    const receiptUrl = useStorageUrl(withdrawalDetails?.withdrawal?.receiptStorageId);

    // Mutation para processar saques
    const processWithdrawal = useMutation(api.admin.processWithdrawal);

    // Filtrar saques
    const filteredWithdrawals = withdrawalsResult?.withdrawals?.filter((withdrawal: any) => {
        const matchesSearch = !searchTerm || 
            withdrawal.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            withdrawal.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            withdrawal.userEmail?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const amount = withdrawal.amount || 0;
        const matchesMinAmount = !minAmount || amount >= (parseFloat(minAmount) * 100);
        const matchesMaxAmount = !maxAmount || amount <= (parseFloat(maxAmount) * 100);
        
        return matchesSearch && matchesMinAmount && matchesMaxAmount;
    }) || [];

    // Função para abrir o modal de detalhes
    const handleViewDetails = (withdrawalId: Id<"organizationWithdrawals">) => {
        setSelectedWithdrawal(withdrawalId);
        setIsDetailsOpen(true);
    };

    // Função para abrir o modal de processamento
    const handleOpenProcessing = (withdrawalId: Id<"organizationWithdrawals">, action: "approve" | "complete" | "reject" | "cancel") => {
        setSelectedWithdrawal(withdrawalId);
        setProcessingAction(action);
        setProcessingNotes("");
        setReceiptFile(null);
        setIsProcessingOpen(true);
    };

    // Função para processar o saque
    const handleProcessWithdrawal = async () => {
        if (!selectedWithdrawal || !processingAction) return;

        try {
            setIsUploading(true);

            let receiptStorageId = undefined;

            // Se for uma ação de conclusão e tiver um arquivo de comprovante, fazer upload
            if (processingAction === "complete" && receiptFile) {
                const uploadResult = await uploadFile(receiptFile);
                if (uploadResult.storageId) {
                    receiptStorageId = uploadResult.storageId;
                }
            }

            // Processar o saque
            await processWithdrawal({
                adminUserId: user?.id || "",
                withdrawalId: selectedWithdrawal,
                action: processingAction as "approve" | "complete" | "reject" | "cancel",
                receiptStorageId,
                notes: processingNotes,
            });

            // Fechar o modal e mostrar mensagem de sucesso
            setIsProcessingOpen(false);

            const actionMessages = {
                approve: "Saque aprovado com sucesso!",
                complete: "Saque concluído com sucesso!",
                reject: "Saque rejeitado com sucesso!",
                cancel: "Saque cancelado com sucesso!",
            };

            toast.success(actionMessages[processingAction as keyof typeof actionMessages] || "Saque processado com sucesso!");

        } catch (error) {
            console.error("Erro ao processar saque:", error);
            toast.error('Ocorreu um erro ao processar o saque.')
        } finally {
            setIsUploading(false);
        }
    };

    // Função para lidar com a seleção de arquivo
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setReceiptFile(file);
        }
    };

    if (!user) {
        return <Spinner />;
    }

    return (
        <div className="container mx-auto py-8 space-y-6">
            {/* Header com gradiente */}
            <div>
                <h1 className="text-3xl font-bold mb-2">Gerenciamento de Saques</h1>
                <p className="text-muted-foreground">Gerencie e processe saques de organizações de forma eficiente</p>
            </div>

            {/* Estatísticas rápidas */}
            <QuickStats withdrawalsResult={withdrawalsResult} />

            {/* Filtros */}
            <Card className="border-[#E65CFF]/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destaque">
                        <Filter className="w-5 h-5" />
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                                placeholder="Buscar por organização, usuário ou email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Input
                            type="number"
                            placeholder="Valor mínimo (R$)"
                            value={minAmount}
                            onChange={(e) => setMinAmount(e.target.value)}
                        />
                        <Input
                            type="number"
                            placeholder="Valor máximo (R$)"
                            value={maxAmount}
                            onChange={(e) => setMaxAmount(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Tabs value={selectedStatus} onValueChange={setSelectedStatus} className="space-y-6">
                <TabsList className="w-full p-1 rounded-lg">
                    <TabsTrigger 
                        value="pending" 
                        className="data-[state=active]:bg-[#E65CFF] data-[state=active]:text-white font-medium"
                    >
                        Pendentes
                    </TabsTrigger>
                    <TabsTrigger 
                        value="processing"
                        className="data-[state=active]:bg-[#E65CFF] data-[state=active]:text-white font-medium"
                    >
                        Processando
                    </TabsTrigger>
                    <TabsTrigger 
                        value="completed"
                        className="data-[state=active]:bg-[#E65CFF] data-[state=active]:text-white font-medium"
                    >
                        Concluídos
                    </TabsTrigger>
                    <TabsTrigger 
                        value="failed"
                        className="data-[state=active]:bg-[#E65CFF] data-[state=active]:text-white font-medium"
                    >
                        Falhas
                    </TabsTrigger>
                    <TabsTrigger 
                        value="cancelled"
                        className="data-[state=active]:bg-[#E65CFF] data-[state=active]:text-white font-medium"
                    >
                        Cancelados
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={selectedStatus} className="space-y-4">
                    <Card className="border-[#E65CFF]/20 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="text-destaque">
                                    Saques {selectedStatus === "pending" ? "Pendentes" :
                                        selectedStatus === "processing" ? "Em Processamento" :
                                            selectedStatus === "completed" ? "Concluídos" :
                                                selectedStatus === "failed" ? "Falhos" :
                                                    "Cancelados"}
                                </span>
                                <Badge variant="outline" className="border-[#E65CFF] text-destaque">
                                    {filteredWithdrawals.length} {filteredWithdrawals.length === 1 ? 'saque' : 'saques'}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            {withdrawalsResult ? (
                                filteredWithdrawals.length > 0 ? (
                                    <div className="space-y-4">
                                        {filteredWithdrawals.map((withdrawal: any) => (
                                            <Card key={withdrawal._id} className="hover:border-[#E65CFF]/50 hover:shadow-md transition-all duration-200">
                                                <CardContent className="p-4">
                                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                        <div className="flex-1 space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-semibold text-lg text-destaque">{withdrawal.organizationName}</h3>
                                                                <WithdrawalStatusBadge status={withdrawal.status} />
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-medium">👤 Responsável:</span>
                                                                    <span>{withdrawal.userName}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-medium">📧 Email:</span>
                                                                    <span>{withdrawal.userEmail}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col lg:flex-row items-center gap-4">
                                                            <div className="text-center lg:text-right">
                                                                <div className="text-2xl font-bold text-green-600">{withdrawal.formattedAmount}</div>
                                                                <div className="text-sm text-muted-foreground">{withdrawal.formattedDate}</div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-2">
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    onClick={() => handleViewDetails(withdrawal._id as Id<"organizationWithdrawals">)}
                                                                    className="border-[#E65CFF] text-destaque hover:bg-[#E65CFF] hover:text-white!"
                                                                >
                                                                    Detalhes
                                                                </Button>

                                                                {selectedStatus === "pending" && (
                                                                    <>
                                                                        <Button 
                                                                            variant="default" 
                                                                            size="sm" 
                                                                            onClick={() => handleOpenProcessing(withdrawal._id as Id<"organizationWithdrawals">, "approve")}
                                                                            className="bg-green-700 hover:bg-green-800 text-white"
                                                                        >
                                                                            Aprovar
                                                                        </Button>
                                                                        <Button 
                                                                            variant="destructive" 
                                                                            size="sm" 
                                                                            onClick={() => handleOpenProcessing(withdrawal._id as Id<"organizationWithdrawals">, "cancel")}
                                                                        >
                                                                            Cancelar
                                                                        </Button>
                                                                    </>
                                                                )}

                                                                {selectedStatus === "processing" && (
                                                                    <>
                                                                        <Button 
                                                                            variant="default" 
                                                                            size="sm" 
                                                                            onClick={() => handleOpenProcessing(withdrawal._id as Id<"organizationWithdrawals">, "complete")}
                                                                            className="bg-green-700 hover:bg-green-800 text-white"
                                                                        >
                                                                            Concluir
                                                                        </Button>
                                                                        <Button 
                                                                            variant="destructive" 
                                                                            size="sm" 
                                                                            onClick={() => handleOpenProcessing(withdrawal._id as Id<"organizationWithdrawals">, "reject")}
                                                                        >
                                                                            Rejeitar
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="text-6xl mb-4">🔍</div>
                                        <h3 className="text-lg font-medium text-muted-foreground mb-2">
                                            {searchTerm || minAmount || maxAmount ? 
                                                'Nenhum saque encontrado com os filtros aplicados' : 
                                                'Nenhum saque encontrado nesta categoria'
                                            }
                                        </h3>
                                        {(searchTerm || minAmount || maxAmount) && (
                                            <Button 
                                                variant="outline" 
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    setMinAmount('');
                                                    setMaxAmount('');
                                                }}
                                                className="border-[#E65CFF] text-destaque hover:bg-[#E65CFF] hover:text-white!"
                                            >
                                                Limpar filtros
                                            </Button>
                                        )}
                                    </div>
                                )
                            ) : (
                                <div className="space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <Card key={i} className="border border-gray-200">
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-2 flex-1">
                                                        <Skeleton className="h-6 w-48" />
                                                        <Skeleton className="h-4 w-32" />
                                                        <Skeleton className="h-4 w-40" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-8 w-24" />
                                                        <Skeleton className="h-4 w-20" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modal de Detalhes */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']  sm:max-w-3xl">
                    <DialogHeader className="pb-4">
                        <DialogTitle className="text-xl flex items-center gap-2">
                            Detalhes do Saque
                        </DialogTitle>
                    </DialogHeader>

                    {withdrawalDetails ? (
                        <div className="space-y-6 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="border-[#E65CFF]/20">
                                    <CardHeader>
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            Informações do Saque
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground font-medium">Valor:</span>
                                            <span className="font-bold text-lg text-green-600">{withdrawalDetails.withdrawal.formattedAmount}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground font-medium">Status:</span>
                                            <WithdrawalStatusBadge status={withdrawalDetails.withdrawal.status} />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground font-medium">Solicitado em:</span>
                                            <span className="font-medium">{withdrawalDetails.withdrawal.formattedRequestDate}</span>
                                        </div>
                                        {withdrawalDetails.withdrawal.processedAt && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground font-medium">Processado em:</span>
                                                <span className="font-medium">{withdrawalDetails.withdrawal.formattedProcessDate}</span>
                                            </div>
                                        )}
                                        {withdrawalDetails.withdrawal.failureReason && (
                                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <span className="text-red-700 font-medium block mb-1">Motivo da falha/cancelamento:</span>
                                                <p className="text-sm text-red-600">{withdrawalDetails.withdrawal.failureReason}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="border-[#E65CFF]/20">
                                    <CardHeader>
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            Informações da Chave PIX
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground font-medium">Tipo:</span>
                                            <Badge variant="outline" className="font-medium uppercase border-[#E65CFF] text-destaque">
                                                {withdrawalDetails.withdrawal.pixKey.keyType}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground font-medium">Chave:</span>
                                            <span className="font-mono text-sm bg-zinc-800 px-2 py-1 rounded">
                                                {withdrawalDetails.withdrawal.pixKey.key}
                                            </span>
                                        </div>
                                        {withdrawalDetails.withdrawal.pixKey.description && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground font-medium">Descrição:</span>
                                                <span className="font-medium">{withdrawalDetails.withdrawal.pixKey.description}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm">Informações da Organização</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {withdrawalDetails.organization ? (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Nome:</span>
                                                    <span className="font-medium">{withdrawalDetails.organization.name}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Responsável:</span>
                                                    <span>{withdrawalDetails.organization.responsibleName}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Documento:</span>
                                                    <span>{withdrawalDetails.organization.responsibleDocument}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-2 text-muted-foreground">
                                                Informações da organização não disponíveis
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm">Informações do Solicitante</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {withdrawalDetails.requester ? (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Nome:</span>
                                                    <span className="font-medium">{withdrawalDetails.requester.name}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Email:</span>
                                                    <span>{withdrawalDetails.requester.email}</span>
                                                </div>
                                                {withdrawalDetails.requester.phone && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Telefone:</span>
                                                        <span>{withdrawalDetails.requester.phone}</span>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center py-2 text-muted-foreground">
                                                Informações do solicitante não disponíveis
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {withdrawalDetails.withdrawal.receiptStorageId && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm">Comprovante de Pagamento</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex justify-center">
                                        <img
                                            src={receiptUrl}
                                            alt="Comprovante de pagamento"
                                            className="max-h-64 object-contain"
                                        />
                                    </CardContent>
                                </Card>
                            )}

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Histórico de Atividades</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {withdrawalDetails.activityLogs.length > 0 ? (
                                        <div className="space-y-3">
                                            {withdrawalDetails.activityLogs.map((log: { _id: Key | null | undefined; action: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; formattedDate: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; adminName: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; adminEmail: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; details: { notes: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; }; }) => (
                                                <div key={log._id} className="border-b pb-2 last:border-0">
                                                    <div className="flex justify-between">
                                                        <span className="font-medium">
                                                            {log.action === "withdrawal_approve" ? "Aprovação" :
                                                                log.action === "withdrawal_complete" ? "Conclusão" :
                                                                    log.action === "withdrawal_reject" ? "Rejeição" :
                                                                        log.action === "withdrawal_cancel" ? "Cancelamento" :
                                                                            log.action}
                                                        </span>
                                                        <span className="text-sm text-muted-foreground">{log.formattedDate}</span>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Por: {log.adminName} ({log.adminEmail})
                                                    </div>
                                                    {log.details?.notes && (
                                                        <div className="mt-1 text-sm border p-2 rounded bg-muted">
                                                            {log.details.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-2 text-muted-foreground">
                                            Nenhuma atividade registrada
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal de Processamento */}
            <Dialog open={isProcessingOpen} onOpenChange={setIsProcessingOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="border-b border-[#E65CFF]/20 pb-4">
                        <DialogTitle className="text-xl text-destaque flex items-center gap-2">
                            ⚙️ Processar Saque
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 pt-4">
                        <Textarea
                            placeholder="Observações (opcional)"
                            value={processingNotes}
                            onChange={(e) => setProcessingNotes(e.target.value)}
                        />

                        {processingAction === "complete" && (
                            <div className="space-y-2">
                                <Label className="block text-sm font-medium">Comprovante de Pagamento</Label>
                                <Input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleFileChange}
                                    className="w-full"
                                />
                                {receiptFile && (
                                    <div className="text-sm text-green-600">
                                        Arquivo selecionado: {(receiptFile as File).name}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsProcessingOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleProcessWithdrawal}
                            disabled={isUploading || (processingAction === "complete" && !receiptFile)}
                        >
                            {isUploading ? "Processando..." : "Confirmar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}