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
import Spinner from "@/components/Spinner";
import { GenericId as Id } from "convex/values";
import { useStorageUrl } from "@/lib/utils";

// Componente para exibir o status do saque
const WithdrawalStatusBadge = ({ status }: { status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' }) => {
    const statusConfig = {
        pending: { label: "Pendente", variant: "outline" },
        processing: { label: "Em Processamento", variant: "secondary" },
        completed: { label: "Concluído", variant: "success" },
        failed: { label: "Falhou", variant: "destructive" },
        cancelled: { label: "Cancelado", variant: "destructive" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };

    return (
        <Badge variant={config.variant as "outline" | "secondary" | "destructive" | "default"}>{config.label}</Badge>
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
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6">Gerenciamento de Saques</h1>

            <Tabs value={selectedStatus} onValueChange={setSelectedStatus} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="pending">Pendentes</TabsTrigger>
                    <TabsTrigger value="processing">Em Processamento</TabsTrigger>
                    <TabsTrigger value="completed">Concluídos</TabsTrigger>
                    <TabsTrigger value="failed">Falhas</TabsTrigger>
                    <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
                </TabsList>

                <TabsContent value={selectedStatus} className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Saques {selectedStatus === "pending" ? "Pendentes" :
                                selectedStatus === "processing" ? "Em Processamento" :
                                    selectedStatus === "completed" ? "Concluídos" :
                                        selectedStatus === "failed" ? "Falhos" :
                                            "Cancelados"}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {withdrawalsResult ? (
                                withdrawalsResult.withdrawals.length > 0 ? (
                                    <div className="space-y-4">
                                        {withdrawalsResult.withdrawals.map((withdrawal: { _id: Key | null | undefined; organizationName: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; userName: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; userEmail: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; formattedAmount: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; formattedDate: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; }) => (
                                            <div key={withdrawal._id} className="p-4 border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="font-medium">{withdrawal.organizationName}</div>
                                                    <div className="text-sm text-muted-foreground">{withdrawal.userName}</div>
                                                    <div className="text-sm text-muted-foreground">{withdrawal.userEmail}</div>
                                                </div>

                                                <div className="text-center">
                                                    <div className="font-bold text-lg">{withdrawal.formattedAmount}</div>
                                                    <div className="text-sm text-muted-foreground">{withdrawal.formattedDate}</div>
                                                </div>

                                                <div className="flex flex-col md:flex-row gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(withdrawal._id as Id<"organizationWithdrawals">)}>
                                                        Detalhes
                                                    </Button>

                                                    {selectedStatus === "pending" && (
                                                        <>
                                                            <Button variant="default" size="sm" onClick={() => handleOpenProcessing(withdrawal._id as Id<"organizationWithdrawals">, "approve")}>
                                                                Aprovar
                                                            </Button>
                                                            <Button variant="destructive" size="sm" onClick={() => handleOpenProcessing(withdrawal._id as Id<"organizationWithdrawals">, "cancel")}>
                                                                Cancelar
                                                            </Button>
                                                        </>
                                                    )}

                                                    {selectedStatus === "processing" && (
                                                        <>
                                                            <Button variant="default" size="sm" onClick={() => handleOpenProcessing(withdrawal._id as Id<"organizationWithdrawals">, "complete")}>
                                                                Concluir
                                                            </Button>
                                                            <Button variant="destructive" size="sm" onClick={() => handleOpenProcessing(withdrawal._id as Id<"organizationWithdrawals">, "reject")}>
                                                                Rejeitar
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        Nenhum saque encontrado nesta categoria.
                                    </div>
                                )
                            ) : (
                                <div className="space-y-4">
                                    <Skeleton className="h-20 w-full" />
                                    <Skeleton className="h-20 w-full" />
                                    <Skeleton className="h-20 w-full" />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modal de Detalhes */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Saque</DialogTitle>
                    </DialogHeader>

                    {withdrawalDetails ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm">Informações do Saque</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Valor:</span>
                                            <span className="font-medium">{withdrawalDetails.withdrawal.formattedAmount}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Status:</span>
                                            <WithdrawalStatusBadge status={withdrawalDetails.withdrawal.status} />
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Solicitado em:</span>
                                            <span>{withdrawalDetails.withdrawal.formattedRequestDate}</span>
                                        </div>
                                        {withdrawalDetails.withdrawal.processedAt && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Processado em:</span>
                                                <span>{withdrawalDetails.withdrawal.formattedProcessDate}</span>
                                            </div>
                                        )}
                                        {withdrawalDetails.withdrawal.failureReason && (
                                            <div className="mt-2">
                                                <span className="text-muted-foreground">Motivo da falha/cancelamento:</span>
                                                <p className="mt-1 text-sm border p-2 rounded">{withdrawalDetails.withdrawal.failureReason}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm">Informações da Chave PIX</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tipo:</span>
                                            <span className="font-medium uppercase">{withdrawalDetails.withdrawal.pixKey.keyType}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Chave:</span>
                                            <span className="font-medium">{withdrawalDetails.withdrawal.pixKey.key}</span>
                                        </div>
                                        {withdrawalDetails.withdrawal.pixKey.description && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Descrição:</span>
                                                <span>{withdrawalDetails.withdrawal.pixKey.description}</span>
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
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {processingAction === "approve" ? "Aprovar Saque" :
                                processingAction === "complete" ? "Concluir Saque" :
                                    processingAction === "reject" ? "Rejeitar Saque" :
                                        processingAction === "cancel" ? "Cancelar Saque" :
                                            "Processar Saque"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Textarea
                            placeholder="Observações (opcional)"
                            value={processingNotes}
                            onChange={(e) => setProcessingNotes(e.target.value)}
                        />

                        {processingAction === "complete" && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium">Comprovante de Pagamento</label>
                                <input
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