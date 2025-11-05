"use client";

import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/api";
import { useState } from "react";
import { type GenericId as Id } from "convex/values";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type DisputeOutcome = "won" | "lost" | "canceled";
type DisputeStatus = "open" | "won" | "lost" | "canceled";

export default function DisputeDetailsPage() {
  const { user } = useUser();
  const params = useParams();
  const disputeIdParam = params?.id as string | undefined;

  const disputeDetails = useQuery(
    api.disputes.getDisputeById,
    disputeIdParam ? { userId: user?.id || "", disputeId: disputeIdParam as unknown as Id<"disputes"> } : "skip"
  );

  const transaction = useQuery(
    api.transactions.getByTransactionId,
    disputeDetails?.dispute?.transactionId ? { transactionId: disputeDetails.dispute.transactionId } : "skip"
  );

  const ticketsByTx = useQuery(
    api.tickets.getTicketsByTransactionId,
    disputeDetails?.dispute?.transactionId ? { transactionId: disputeDetails.dispute.transactionId } : "skip"
  );

  const userInfo = useQuery(
    api.users.getUserById,
    transaction?.userId ? { userId: transaction.userId } : "skip"
  );

  const resolveDispute = useMutation(api.disputes.resolveDispute);
  const [resolutionOutcome, setResolutionOutcome] = useState<DisputeOutcome>("canceled");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDateTime = (timestamp?: number) =>
    timestamp
      ? new Date(timestamp).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

  const statusBadgeColor = (s: DisputeStatus) => {
    switch (s) {
      case "open":
        return "bg-orange-500";
      case "won":
        return "bg-green-600";
      case "lost":
        return "bg-red-600";
      case "canceled":
        return "bg-gray-600";
      default:
        return "bg-gray-600";
    }
  };

  const handleResolve = async () => {
    if (!disputeIdParam || !user?.id) return;
    try {
      await resolveDispute({
        userId: user.id,
        disputeId: disputeIdParam as unknown as Id<"disputes">,
        outcome: resolutionOutcome,
        resolutionNotes: resolutionNotes || undefined,
      });
      toast.success("Disputa resolvida com sucesso.");
    } catch (err: any) {
      console.error("Erro ao resolver disputa:", err);
      toast.error("Falha ao resolver disputa.");
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Detalhes da Disputa</h1>
          <p className="text-[#A3A3A3] mt-2">Visualização completa com todos os dados disponíveis.</p>
        </div>
        <Badge className={statusBadgeColor(disputeDetails?.dispute?.status || "open")}>
          {disputeDetails?.dispute?.status || "open"}
        </Badge>
      </div>

      {!disputeDetails ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E65CFF]" />
        </div>
      ) : !disputeDetails.dispute ? (
        <div className="text-[#A3A3A3]">Disputa não encontrada.</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-white">Identificadores</CardTitle>
              <CardDescription className="text-[#A3A3A3]">IDs principais e relacionamento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><span className="text-[#A3A3A3]">Dispute ID:</span> <span className="font-mono text-white">{String(disputeDetails.dispute._id)}</span></div>
                <div><span className="text-[#A3A3A3]">Event ID:</span> <span className="font-mono text-white">{String(disputeDetails.dispute.eventId)}</span></div>
                <div><span className="text-[#A3A3A3]">Transaction ID:</span> <span className="font-mono text-white">{disputeDetails.dispute.transactionId}</span></div>
                <div><span className="text-[#A3A3A3]">Provider:</span> <span className="text-white">{disputeDetails.dispute.provider || "-"}</span></div>
                <div><span className="text-[#A3A3A3]">Provider Event Type:</span> <span className="text-white">{disputeDetails.dispute.providerEventType || "-"}</span></div>
                <div><span className="text-[#A3A3A3]">Event Name:</span> <span className="text-white">{disputeDetails.eventName || "-"}</span></div>
                <div><span className="text-[#A3A3A3]">Transaction Status:</span> <span className="text-white uppercase">{disputeDetails.transactionStatus || "-"}</span></div>
                <div><span className="text-[#A3A3A3]">Charge ID:</span> <span className="font-mono text-white">{disputeDetails.dispute.providerData?.order?.charges?.[0]?.id || "-"}</span></div>
                <div><span className="text-[#A3A3A3]">Last Transaction ID (provider):</span> <span className="font-mono text-white">{disputeDetails.dispute.providerData?.order?.charges?.[0]?.last_transaction?.id || "-"}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white">Disputa</CardTitle>
              <CardDescription className="text-[#A3A3A3]">Campos e metadados da disputa</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-[#A3A3A3]">Status:</span> <Badge className={statusBadgeColor(disputeDetails.dispute.status)}>{disputeDetails.dispute.status}</Badge></div>
                <div><span className="text-[#A3A3A3]">Valor:</span> <span className="text-white">{formatCurrency(disputeDetails.dispute.amount || 0)}</span></div>
                <div><span className="text-[#A3A3A3]">Método:</span> <span className="text-white uppercase">{disputeDetails.dispute.paymentMethod || "-"}</span></div>
                <div><span className="text-[#A3A3A3]">Aberta em:</span> <span className="text-white">{formatDateTime(disputeDetails.dispute.openedAt)}</span></div>
                <div><span className="text-[#A3A3A3]">Resolvida em:</span> <span className="text-white">{formatDateTime(disputeDetails.dispute.resolvedAt)}</span></div>
                <div><span className="text-[#A3A3A3]">Outcome:</span> <span className="text-white">{disputeDetails.dispute.outcome || "-"}</span></div>
              </div>
              <div className="mt-4">
                <span className="text-[#A3A3A3] text-sm">Resolution Notes:</span>
                <div className="text-white text-sm whitespace-pre-wrap">{disputeDetails.dispute.resolutionNotes || "-"}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white">Transação</CardTitle>
              <CardDescription className="text-[#A3A3A3]">Dados completos da transação</CardDescription>
            </CardHeader>
            <CardContent>
              {!transaction ? (
                <div className="text-[#A3A3A3] text-sm">Carregando transação...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div><span className="text-[#A3A3A3]">Status:</span> <span className="text-white uppercase">{transaction.status || "-"}</span></div>
                  <div><span className="text-[#A3A3A3]">Amount:</span> <span className="text-white">{formatCurrency(transaction.amount || 0)}</span></div>
                  <div><span className="text-[#A3A3A3]">Payment Method:</span> <span className="text-white uppercase">{transaction.paymentMethod || "-"}</span></div>
                  <div><span className="text-[#A3A3A3]">User ID:</span> <span className="font-mono text-white">{transaction.userId || "-"}</span></div>
                  <div><span className="text-[#A3A3A3]">Customer ID:</span> <span className="font-mono text-white">{transaction.customerId || "-"}</span></div>
                  <div><span className="text-[#A3A3A3]">Event ID:</span> <span className="font-mono text-white">{String(transaction.eventId || "-")}</span></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white">Usuário</CardTitle>
              <CardDescription className="text-[#A3A3A3]">Informações do usuário vinculadas</CardDescription>
            </CardHeader>
            <CardContent>
              {!userInfo ? (
                <div className="text-[#A3A3A3] text-sm">Carregando usuário...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div><span className="text-[#A3A3A3]">User ID:</span> <span className="font-mono text-white">{userInfo?._id ? String(userInfo._id) : "-"}</span></div>
                  <div><span className="text-[#A3A3A3]">Name:</span> <span className="text-white">{userInfo?.name || "-"}</span></div>
                  <div><span className="text-[#A3A3A3]">Email:</span> <span className="text-white">{userInfo?.email || "-"}</span></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white">Ingressos</CardTitle>
              <CardDescription className="text-[#A3A3A3]">Itens vinculados à transação</CardDescription>
            </CardHeader>
            <CardContent>
              {!ticketsByTx ? (
                <div className="text-[#A3A3A3] text-sm">Carregando ingressos...</div>
              ) : (ticketsByTx?.length || 0) === 0 ? (
                <div className="text-[#A3A3A3] text-sm">Nenhum ingresso vinculado.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket ID</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Preço Unitário</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticketsByTx.map((t: any, idx: number) => (
                      <TableRow key={`${String(t._id)}-${idx}`}>
                        <TableCell className="font-mono">{String(t._id)}</TableCell>
                        <TableCell>{t.quantity ?? t.qtd ?? 1}</TableCell>
                        <TableCell>{formatCurrency(t.unitPrice || t.price || 0)}</TableCell>
                        <TableCell className="uppercase">{t.status || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white">Provider Payload</CardTitle>
              <CardDescription className="text-[#A3A3A3]">Dados brutos recebidos do provedor</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-zinc-900 text-zinc-100 p-4 rounded border border-zinc-800 overflow-auto text-xs">
                {JSON.stringify(disputeDetails.dispute.providerData ?? disputeDetails.dispute.providerPayload ?? {}, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white">Objeto de Disputa (raw)</CardTitle>
              <CardDescription className="text-[#A3A3A3]">Dump do documento completo</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-zinc-900 text-zinc-100 p-4 rounded border border-zinc-800 overflow-auto text-xs">
                {JSON.stringify(disputeDetails.dispute, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-white">Resolução</CardTitle>
              <CardDescription className="text-[#A3A3A3]">Defina o resultado e adicione notas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-[#A3A3A3] mb-2 block">Resultado</label>
                  <Select value={resolutionOutcome} onValueChange={(v) => setResolutionOutcome(v as DisputeOutcome)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o resultado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="won">Ganha</SelectItem>
                      <SelectItem value="lost">Perdida</SelectItem>
                      <SelectItem value="canceled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-[#A3A3A3] mb-2 block">Notas</label>
                  <Textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Descreva o contexto..."
                    className="bg-zinc-800 border-zinc-700 text-white placeholder-[#A3A3A3]"
                    rows={4}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={handleResolve}>Resolver disputa</Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}