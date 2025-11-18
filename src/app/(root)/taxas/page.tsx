"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { type GenericId as Id } from "convex/values";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type EditValues = {
    useCustomFees: boolean;
    pixFeePercentage?: number;      // UI em porcentagem (0–100)
    cardFeePercentage?: number;     // UI em porcentagem (0–100)
};

export default function TaxasPage() {
    const { user, isLoaded } = useUser();

    const [searchTerm, setSearchTerm] = useState("");
    const [skip, setSkip] = useState(0);
    const [limit, setLimit] = useState(20);

    const eventsResult = useQuery(api.admin.listAllEvents, {
        userId: user?.id || "",
        skip,
        limit,
        searchTerm,
    });

    const upsertEventFeeSettings = useMutation(api.eventFeeSettings.upsertEventFeeSettings);
    const removeEventFeeSettings = useMutation(api.eventFeeSettings.removeEventFeeSettings);
    const [edits, setEdits] = useState<Record<string, EditValues>>({});

    // Remover edição inline e usar modal
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [form, setForm] = useState<EditValues>({ useCustomFees: false });

    const clampPercent = (n?: number) =>
        typeof n === "number" && !Number.isNaN(n) ? Math.max(0, Math.min(100, n)) : undefined;

    const toDecimal = (pct?: number) =>
        pct !== undefined ? pct / 100 : undefined;

    const formatDate = (ts?: number) => {
        if (!ts) return "-";
        try {
            return new Date(ts).toLocaleDateString("pt-BR");
        } catch {
            return "-";
        }
    };

    const openEditModal = (event: any) => {
        const s = event.feeSettings;
        setSelectedEvent(event);
        setForm({
            useCustomFees: !!s?.useCustomFees,
            pixFeePercentage: s?.pixFeePercentage !== undefined ? s.pixFeePercentage * 100 : undefined,
            cardFeePercentage: s?.cardFeePercentage !== undefined ? s.cardFeePercentage * 100 : undefined,
        });
        setModalOpen(true);
    };

    const saveModal = async () => {
        if (!selectedEvent) return;
        try {
            const pixPct = clampPercent(form.pixFeePercentage);
            const cardPct = clampPercent(form.cardFeePercentage);

            await upsertEventFeeSettings({
                eventId: selectedEvent._id as unknown as Id<"events">,
                pixFeePercentage: toDecimal(pixPct),
                cardFeePercentage: toDecimal(cardPct),
                useCustomFees: !!form.useCustomFees,
                userId: user?.id || "",
            });

            toast.success("Taxas atualizadas com sucesso");
            setModalOpen(false);
        } catch (err: any) {
            toast.error(err?.message || "Erro ao salvar taxas");
        }
    };

    const handleRemove = async (eventId: string) => {
        try {
            await removeEventFeeSettings({
                eventId: eventId as unknown as Id<"events">,
            });
            toast.success("Configurações customizadas removidas");
            setEdits(prev => ({
                ...prev,
                [eventId]: {
                    useCustomFees: false,
                    pixFeePercentage: undefined,
                    cardFeePercentage: undefined,
                },
            }));
        } catch (err: any) {
            toast.error(err?.message || "Erro ao remover configurações");
        }
    };

    if (!isLoaded || !user) {
        return <Spinner />;
    }

    return (
        <div className="container mx-auto py-10">
            {/* Busca e paginação */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold">Taxas por Evento</h1>
                <Badge variant="outline">Admin</Badge>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Busca de Eventos</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4 items-end">
                    <div className="w-full max-w-md">
                        <Label className="mb-2 block">Pesquisar (nome, descrição, local)</Label>
                        <Input
                            placeholder="Digite para buscar"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="mb-2 block">Itens por página</Label>
                        <Input
                            type="number"
                            min={1}
                            max={100}
                            value={limit}
                            onChange={(e) => setLimit(parseInt(e.target.value || "20", 10))}
                            className="w-24"
                        />
                    </div>
                    <div className="ml-auto flex gap-2">
                        <Button variant="outline" onClick={() => setSkip(Math.max(0, skip - limit))}>Anterior</Button>
                        <Button variant="default" onClick={() => setSkip(skip + limit)} disabled={!eventsResult?.hasMore}>Próxima</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Eventos e Configurações de Taxa</CardTitle>
                </CardHeader>
                <CardContent>
                    {!eventsResult?.events ? (
                        <Spinner />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Período</TableHead>
                                    <TableHead>Customizado?</TableHead>
                                    <TableHead>PIX (%)</TableHead>
                                    <TableHead>Cartão (%)</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {eventsResult.events.map((event: any) => {
                                    const s = event.feeSettings;
                                    const isCustom = !!s?.useCustomFees;
                                    const pixPct = s?.pixFeePercentage !== undefined ? (s.pixFeePercentage * 100).toFixed(2) : "-";
                                    const cardPct = s?.cardFeePercentage !== undefined ? (s.cardFeePercentage * 100).toFixed(2) : "-";

                                    return (
                                        <TableRow key={event._id}>
                                            <TableCell className="font-medium">{event.name}</TableCell>
                                            <TableCell>
                                                {formatDate(event.eventStartDate)} — {formatDate(event.eventEndDate)}
                                            </TableCell>
                                            <TableCell>
                                                {isCustom ? (
                                                    <Badge variant="default">Sim</Badge>
                                                ) : (
                                                    <Badge variant="outline">Não</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>{pixPct}</TableCell>
                                            <TableCell>{cardPct}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="default" onClick={() => openEditModal(event)}>
                                                        Editar
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => handleRemove(event._id)}
                                                        disabled={!isCustom}
                                                    >
                                                        Remover
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Modal de edição */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar taxas: {selectedEvent?.name}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.useCustomFees}
                                onChange={(ev) => setForm((f) => ({ ...f, useCustomFees: ev.target.checked }))}
                            />
                            <span>Usar taxas customizadas</span>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label className="mb-2 block">PIX (%)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={100}
                                    placeholder="ex: 10"
                                    value={form.pixFeePercentage ?? ""}
                                    onChange={(ev) => {
                                        const val = ev.target.value === "" ? undefined : parseFloat(ev.target.value);
                                        setForm((f) => ({ ...f, pixFeePercentage: val }));
                                    }}
                                    disabled={!form.useCustomFees}
                                />
                            </div>
                            <div>
                                <Label className="mb-2 block">Cartão (%)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={100}
                                    placeholder="ex: 10"
                                    value={form.cardFeePercentage ?? ""}
                                    onChange={(ev) => {
                                        const val = ev.target.value === "" ? undefined : parseFloat(ev.target.value);
                                        setForm((f) => ({ ...f, cardFeePercentage: val }));
                                    }}
                                    disabled={!form.useCustomFees}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button variant="default" onClick={saveModal}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}