"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/api";
import Spinner from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { type GenericId as Id } from "convex/values";

type UserRow = { _id: string; userId: string; name?: string; email?: string };
type EventRow = any;

function pctToDecimal(p?: number) {
    return typeof p === "number" ? Math.max(0, Math.min(1, p / 100)) : undefined;
}

export default function ComissionadosPage() {
    const { user, isLoaded } = useUser();
    const adminUserId = user?.id || "";

    const [emailCreate, setEmailCreate] = useState("");
    const checkCreateExists = useQuery(
        api.users.checkUserExistsByEmail,
        emailCreate ? { email: emailCreate } : "skip"
    );
    const userInfoCreate = useQuery(
        api.users.getUserInfoByEmail,
        emailCreate ? { email: emailCreate } : "skip"
    );

    const [emailAssign, setEmailAssign] = useState("");
    const checkAssignExists = useQuery(
        api.users.checkUserExistsByEmail,
        emailAssign ? { email: emailAssign } : "skip"
    );
    const userInfoAssign = useQuery(
        api.users.getUserInfoByEmail,
        emailAssign ? { email: emailAssign } : "skip"
    );

    useEffect(() => {
        setCheckRepUserId(userInfoAssign?.userId || null);
    }, [userInfoAssign?.userId]);

    // Busca de usuários para criar/vincular representantes
    const [userSearch, setUserSearch] = useState("");
    const [userSkip, setUserSkip] = useState(0);
    const [userLimit, setUserLimit] = useState(10);
    const usersResult = useQuery(api.admin.listAllUsers, {
        userId: adminUserId,
        skip: userSkip,
        limit: userLimit,
        searchTerm: userSearch,
    });

    // Busca de eventos para vincular representantes e ver resumo/payouts
    const [eventSearch, setEventSearch] = useState("");
    const [eventSkip, setEventSkip] = useState(0);
    const [eventLimit, setEventLimit] = useState(20);
    const eventsResult = useQuery(api.admin.listAllEvents, {
        userId: adminUserId,
        skip: eventSkip,
        limit: eventLimit,
        searchTerm: eventSearch,
    });

    // Mutations admin
    const createRep = useMutation(api.admin.adminCreateRepresentative);
    const updateRep = useMutation(api.admin.adminUpdateRepresentative);
    const assignRep = useMutation(api.admin.adminAssignRepresentativeToEvent);
    const removeRepFromEvent = useMutation(api.admin.adminRemoveRepresentativeFromEvent);
    const recordPayout = useMutation(api.admin.adminRecordRepresentativePayout);
    const updatePayoutStatus = useMutation(api.admin.adminUpdateRepresentativePayoutStatus);

    // Public query util (ver se já existe representante para um user)
    const [checkRepUserId, setCheckRepUserId] = useState<string | null>(null);
    const repByUser = useQuery(api.representatives.getRepresentativeByUser, checkRepUserId ? { userId: checkRepUserId } : "skip");

    // Modais
    const [modalCreateOpen, setModalCreateOpen] = useState(false);
    const [modalAssignOpen, setModalAssignOpen] = useState(false);
    const [modalEventRepsOpen, setModalEventRepsOpen] = useState(false);
    const [modalSummaryOpen, setModalSummaryOpen] = useState(false);
    const [modalPayoutOpen, setModalPayoutOpen] = useState(false);

    // Estados auxiliares
    const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
    const [defaultCommissionPct, setDefaultCommissionPct] = useState<number | undefined>();
    const [assignCommissionPct, setAssignCommissionPct] = useState<number | undefined>();
    const [payoutAmount, setPayoutAmount] = useState<number | undefined>(undefined);
    const [payoutNotes, setPayoutNotes] = useState<string>("");
    const [payoutMarkPaid, setPayoutMarkPaid] = useState<boolean>(false);
    const [selectedRepIdForPayout, setSelectedRepIdForPayout] = useState<string | null>(null);

    // Dados dinâmicos por evento
    const eventRepresentatives = useQuery(
        api.admin.adminGetEventRepresentatives,
        modalEventRepsOpen && selectedEvent
            ? { adminUserId, eventId: selectedEvent._id as Id<"events"> }
            : "skip"
    );
    const eventCommissionSummary = useQuery(
        api.admin.adminGetEventCommissionSummary,
        modalSummaryOpen && selectedEvent
            ? { adminUserId, eventId: selectedEvent._id as Id<"events"> }
            : "skip"
    );
    const eventPayouts = useQuery(
        api.admin.adminGetRepresentativePayoutsByEvent,
        modalPayoutOpen && selectedEvent
            ? { adminUserId, eventId: selectedEvent._id as Id<"events"> }
            : "skip"
    );

    useEffect(() => {
        if (!modalCreateOpen) {
            setSelectedUser(null);
            setDefaultCommissionPct(undefined);
        }
    }, [modalCreateOpen]);

    useEffect(() => {
        if (!modalAssignOpen) {
            setSelectedUser(null);
            setAssignCommissionPct(undefined);
            setCheckRepUserId(null);
        }
    }, [modalAssignOpen]);

    useEffect(() => {
        if (!modalPayoutOpen) {
            setSelectedRepIdForPayout(null);
            setPayoutAmount(undefined);
            setPayoutNotes("");
            setPayoutMarkPaid(false);
        }
    }, [modalPayoutOpen]);

    const formatDate = (ts?: number) => {
        if (!ts) return "-";
        try {
            return new Date(ts).toLocaleDateString("pt-BR");
        } catch {
            return "-";
        }
    };

    const onCreateRepresentative = async () => {
        if (!emailCreate) {
            toast.error("Informe um e-mail");
            return;
        }
        if (!checkCreateExists?.exists) {
            toast.error("Usuário não cadastrado");
            return;
        }
        const uid = userInfoCreate?.userId;
        if (!uid) {
            toast.error("Não foi possível obter o usuário pelo e-mail");
            return;
        }
        try {
            const res = await createRep({
                adminUserId,
                name: userInfoCreate?.name || "",
                email: emailCreate,
                phone: undefined,
                userId: uid,
                defaultCommissionRate: pctToDecimal(defaultCommissionPct),
            });
            res?.success ? toast.success(res.message) : toast.error(res?.message || "Erro ao criar");
            if (res?.success) setModalCreateOpen(false);
        } catch (e: any) {
            toast.error(e?.message || "Erro ao criar representante");
        }
    };

    const onAssignRepresentativeToEvent = async () => {
        if (!selectedEvent) {
            toast.error("Selecione um evento");
            return;
        }
        if (!emailAssign) {
            toast.error("Informe o e-mail do usuário");
            return;
        }
        if (!checkAssignExists?.exists) {
            toast.error("Usuário não cadastrado");
            return;
        }
        // repByUser é alimentado pelo useEffect que seta checkRepUserId quando emailAssign muda
        const rep = repByUser as any;
        const representativeId = rep?._id;
        if (!representativeId) {
            toast.error("Usuário não é representante. Crie primeiro em 'Criar representante'.");
            return;
        }
        try {
            const res = await assignRep({
                adminUserId,
                eventId: selectedEvent._id as Id<"events">,
                representativeId: representativeId as Id<"representatives">,
                commissionRate: pctToDecimal(assignCommissionPct) || 0,
            });
            res?.success ? toast.success(res.message) : toast.error(res?.message || "Erro ao vincular");
            if (res?.success) setModalAssignOpen(false);
        } catch (e: any) {
            toast.error(e?.message || "Erro ao vincular representante");
        }
    };

    const onRemoveRepFromEvent = async (representativeId: string) => {
        if (!selectedEvent) return;
        try {
            const res = await removeRepFromEvent({
                adminUserId,
                eventId: selectedEvent._id as Id<"events">,
                representativeId: representativeId as Id<"representatives">,
            });
            res?.success ? toast.success(res.message) : toast.error(res?.message || "Erro ao remover");
        } catch (e: any) {
            toast.error(e?.message || "Erro ao remover representante do evento");
        }
    };

    const onRecordPayout = async () => {
        if (!selectedEvent || !selectedRepIdForPayout || !payoutAmount || payoutAmount <= 0) {
            toast.error("Preencha representante e valor válido");
            return;
        }
        try {
            const res = await recordPayout({
                adminUserId,
                eventId: selectedEvent._id as Id<"events">,
                representativeId: selectedRepIdForPayout as Id<"representatives">,
                amount: payoutAmount,
                markPaid: payoutMarkPaid,
                notes: payoutNotes || undefined,
            });
            res?.success ? toast.success(res.message) : toast.error(res?.message || "Erro ao registrar baixa");
            if (res?.success) {
                setPayoutAmount(undefined);
                setPayoutNotes("");
                setPayoutMarkPaid(false);
            }
        } catch (e: any) {
            toast.error(e?.message || "Erro ao registrar baixa");
        }
    };

    const onUpdatePayoutStatus = async (payoutId: string, status: "pending" | "paid") => {
        try {
            const res = await updatePayoutStatus({ adminUserId, payoutId: payoutId as Id<"representativePayouts">, status });
            res?.success ? toast.success(res.message) : toast.error(res?.message || "Erro ao atualizar status");
        } catch (e: any) {
            toast.error(e?.message || "Erro ao atualizar status");
        }
    };

    if (!isLoaded || !user) {
        return <Spinner />;
    }

    return (
        <div className="container mx-auto py-10 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Comissionados</h1>
                <Badge variant="outline">Admin</Badge>
            </div>

            {/* Substituir o painel de usuários por apenas botão para abrir modal de criação */}
            <Card>
                <CardHeader>
                    <CardTitle>Representantes — Criar</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Crie um representante informando o e-mail do usuário.
                    </p>
                    <Button variant="default" onClick={() => setModalCreateOpen(true)}>
                        Criar representante
                    </Button>
                </CardContent>
            </Card>

            {/* Painel de eventos / vínculos / resumo / baixas */}
            <Card>
                <CardHeader>
                    <CardTitle>Eventos — Vínculos e Comissões</CardTitle>
                </CardHeader>
                <CardContent className="flex items-end gap-4">
                    <div className="w-full max-w-md">
                        <Label className="mb-2 block">Pesquisar eventos</Label>
                        <Input
                            placeholder="nome, descrição, local"
                            value={eventSearch}
                            onChange={(e) => setEventSearch(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="mb-2 block">Itens</Label>
                        <Input
                            type="number"
                            min={1}
                            max={100}
                            className="w-24"
                            value={eventLimit}
                            onChange={(e) => setEventLimit(parseInt(e.target.value || "20", 10))}
                        />
                    </div>
                    <div className="ml-auto flex gap-2">
                        <Button variant="outline" onClick={() => setEventSkip(Math.max(0, eventSkip - eventLimit))}>
                            Anterior
                        </Button>
                        <Button variant="default" onClick={() => setEventSkip(eventSkip + eventLimit)} disabled={!eventsResult?.hasMore}>
                            Próxima
                        </Button>
                    </div>
                </CardContent>

                <CardContent>
                    {!eventsResult?.events ? (
                        <Spinner />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Período</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {eventsResult.events.map((ev: any) => (
                                    <TableRow key={ev._id}>
                                        <TableCell className="font-medium">{ev.name}</TableCell>
                                        <TableCell>{formatDate(ev.eventStartDate)} — {formatDate(ev.eventEndDate)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="default"
                                                    onClick={() => {
                                                        setSelectedEvent(ev);
                                                        setModalAssignOpen(true);
                                                    }}
                                                >
                                                    Vincular representante
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedEvent(ev);
                                                        setModalEventRepsOpen(true);
                                                    }}
                                                >
                                                    Representantes
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedEvent(ev);
                                                        setModalSummaryOpen(true);
                                                    }}
                                                >
                                                    Resumo
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedEvent(ev);
                                                        setModalPayoutOpen(true);
                                                    }}
                                                >
                                                    Baixas
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Modal: Criar representante */}
            <Dialog open={modalCreateOpen} onOpenChange={setModalCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Criar representante</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2 block" htmlFor="email-create">E-mail do usuário</Label>
                            <Input
                                id="email-create"
                                type="email"
                                value={emailCreate}
                                onChange={(e) => setEmailCreate(e.target.value)}
                                placeholder="exemplo@email.com"
                                required
                                className="text-white placeholder:text-secondaryCustom"
                            />
                            {emailCreate && checkCreateExists !== undefined && (
                                <p
                                    className={`text-sm ${checkCreateExists.exists ? "text-green-400" : "text-red-400"
                                        }`}
                                >
                                    {checkCreateExists.exists
                                        ? "✓ Usuário encontrado"
                                        : "✗ Usuário não cadastrado"}
                                </p>
                            )}
                        </div>
                        <div>
                            <Label className="mb-2 block">Taxa padrão (%)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                placeholder="ex: 10"
                                value={defaultCommissionPct ?? ""}
                                onChange={(e) => {
                                    const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                                    setDefaultCommissionPct(v);
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalCreateOpen(false)}>Cancelar</Button>
                        <Button variant="default" onClick={onCreateRepresentative}>Criar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Vincular representante ao evento */}
            <Dialog open={modalAssignOpen} onOpenChange={setModalAssignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Vincular representante ao evento: {selectedEvent?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2 block" htmlFor="email-assign">E-mail do usuário (já representante)</Label>
                            <Input
                                id="email-assign"
                                type="email"
                                value={emailAssign}
                                onChange={(e) => setEmailAssign(e.target.value)}
                                placeholder="exemplo@email.com"
                                required
                            />
                            {emailAssign && checkAssignExists !== undefined && (
                                <p
                                    className={`text-sm ${checkAssignExists.exists ? "text-green-400" : "text-red-400"
                                        }`}
                                >
                                    {checkAssignExists.exists
                                        ? "✓ Usuário encontrado"
                                        : "✗ Usuário não cadastrado"}
                                </p>
                            )}
                        </div>
                        <div>
                            <Label className="mb-2 block">Comissão (%)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                placeholder="ex: 10"
                                value={assignCommissionPct ?? ""}
                                onChange={(e) => {
                                    const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                                    setAssignCommissionPct(v);
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalAssignOpen(false)}>Cancelar</Button>
                        <Button variant="default" onClick={onAssignRepresentativeToEvent}>Vincular</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Representantes do evento */}
            <Dialog open={modalEventRepsOpen} onOpenChange={setModalEventRepsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Representantes — {selectedEvent?.name}</DialogTitle>
                    </DialogHeader>
                    {!eventRepresentatives ? (
                        <Spinner />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Taxa (%)</TableHead>
                                    <TableHead>Ativo</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {eventRepresentatives.map((l: any) => (
                                    <TableRow key={l._id}>
                                        <TableCell className="font-medium">{l.representative?.name || "-"}</TableCell>
                                        <TableCell>{(l.commissionRate * 100).toFixed(2)}</TableCell>
                                        <TableCell>
                                            {l.isActive !== false ? <Badge variant="default">Sim</Badge> : <Badge variant="outline">Não</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" onClick={() => onRemoveRepFromEvent(l.representativeId)}>
                                                Remover
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalEventRepsOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Resumo de comissão */}
            <Dialog open={modalSummaryOpen} onOpenChange={setModalSummaryOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Resumo — {selectedEvent?.name}</DialogTitle>
                    </DialogHeader>
                    {!eventCommissionSummary ? (
                        <Spinner />
                    ) : eventCommissionSummary.success === false ? (
                        <div>{eventCommissionSummary.message || "Sem acesso"}</div>
                    ) : (
                        <>
                            <div className="mb-4">Taxa da plataforma total: R$ {eventCommissionSummary.platformFeeTotal.toFixed(2)}</div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Representante</TableHead>
                                        <TableHead>Taxa (%)</TableHead>
                                        <TableHead>Comissão</TableHead>
                                        <TableHead>Pago</TableHead>
                                        <TableHead>Pendente</TableHead>
                                        <TableHead>Em aberto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {eventCommissionSummary.representatives.map((r: any) => (
                                        <TableRow key={r.representativeId}>
                                            <TableCell className="font-medium">{r.name || "-"}</TableCell>
                                            <TableCell>{(r.commissionRate * 100).toFixed(2)}</TableCell>
                                            <TableCell>R$ {r.commission.toFixed(2)}</TableCell>
                                            <TableCell>R$ {r.paid.toFixed(2)}</TableCell>
                                            <TableCell>R$ {r.pending.toFixed(2)}</TableCell>
                                            <TableCell>R$ {r.outstanding.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalSummaryOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Baixas do evento */}
            <Dialog open={modalPayoutOpen} onOpenChange={setModalPayoutOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Baixas — {selectedEvent?.name}</DialogTitle>
                    </DialogHeader>

                    {/* Registrar nova baixa */}
                    <div className="space-y-4 mb-6">
                        <div>
                            <Label className="mb-2 block">Representante (ID)</Label>
                            <Input
                                placeholder="cole o representativeId ou selecione no modal de representantes"
                                value={selectedRepIdForPayout || ""}
                                onChange={(e) => setSelectedRepIdForPayout(e.target.value || null)}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label className="mb-2 block">Valor (R$)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    placeholder="ex: 1200"
                                    value={payoutAmount ?? ""}
                                    onChange={(e) => {
                                        const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                                        setPayoutAmount(v);
                                    }}
                                />
                            </div>
                            <div className="col-span-2">
                                <Label className="mb-2 block">Notas</Label>
                                <Input
                                    placeholder="observações"
                                    value={payoutNotes}
                                    onChange={(e) => setPayoutNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={payoutMarkPaid}
                                onChange={(e) => setPayoutMarkPaid(e.target.checked)}
                            />
                            <span>Marcar como pago</span>
                        </div>
                        <div className="flex justify-end">
                            <Button variant="default" onClick={onRecordPayout}>Registrar baixa</Button>
                        </div>
                    </div>

                    {/* Lista de baixas */}
                    {!eventPayouts ? (
                        <Spinner />
                    ) : eventPayouts.success === false ? (
                        <div>{eventPayouts.message || "Sem acesso"}</div>
                    ) : (
                        <>
                            <div className="mb-2 text-sm text-muted-foreground">
                                Totais — Pago: R$ {eventPayouts.totals.totalPaid.toFixed(2)} • Pendente: R$ {eventPayouts.totals.totalPending.toFixed(2)}
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Representante</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {eventPayouts.payouts.map((p: any) => (
                                        <TableRow key={p._id}>
                                            <TableCell className="font-medium">{p._id}</TableCell>
                                            <TableCell>{p.representativeId}</TableCell>
                                            <TableCell>R$ {p.amount.toFixed(2)}</TableCell>
                                            <TableCell>
                                                {p.status === "paid" ? <Badge variant="default">Pago</Badge> : <Badge variant="outline">Pendente</Badge>}
                                            </TableCell>
                                            <TableCell>{formatDate(p.createdAt)}{p.paidAt ? ` • ${formatDate(p.paidAt)}` : ""}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" onClick={() => onUpdatePayoutStatus(p._id, p.status === "paid" ? "pending" : "paid")}>
                                                        {p.status === "paid" ? "Marcar pendente" : "Marcar pago"}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalPayoutOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}