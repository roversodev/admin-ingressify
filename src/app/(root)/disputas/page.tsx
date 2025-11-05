"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/api";
import { useMemo, useState } from "react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { type GenericId as Id } from "convex/values";
import { Eye } from "lucide-react";
import Link from "next/link";

type DisputeStatus = "open" | "won" | "lost" | "canceled";

export default function DisputesPage() {
    const { user } = useUser();

    const [statusFilter, setStatusFilter] = useState<DisputeStatus>("open");
    const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>("all");
    const [selectedEventId, setSelectedEventId] = useState<string>("all");
    const [limit, setLimit] = useState<number>(50);

    // Query: Organizações do usuário (para filtro)
    const organizations = useQuery(api.organizations.getUserOrganizations, {
        userId: user?.id || "",
    });

    // Query: Eventos para filtro (com org)
    const eventsWithOrg = useQuery(api.admin.listAllEventsWithOrganization, {
        userId: user?.id || "",
        limit: 1000,
        skip: 0,
        searchTerm: "",
    });

    // Query: Listar disputas
    const disputes = useQuery(api.disputes.listDisputes, {
        userId: user?.id || "",
        status: statusFilter,
        organizationId: selectedOrganizationId !== "all" ? (selectedOrganizationId as unknown as Id<"organizations">) : undefined,
        eventId: selectedEventId !== "all" ? (selectedEventId as unknown as Id<"events">) : undefined,
        limit,
    });

    const eventNameById = useMemo(() => {
        const map = new Map<string, string>();
        (eventsWithOrg?.events || []).forEach((ev: any) => {
            map.set(String(ev._id), ev.name);
        });
        return map;
    }, [eventsWithOrg]);

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

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Disputas</h1>
                <p className="text-[#A3A3A3] mt-2">
                    Gerencie chargebacks: visualize, analise e resolva disputas.
                </p>
            </div>

            {/* Filtros */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-white">Filtros</CardTitle>
                    <CardDescription className="text-[#A3A3A3]">
                        Refine a listagem por status, organização e evento.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm text-[#A3A3A3] mb-2 block">Status</label>
                            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DisputeStatus)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione um status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="open">Aberta</SelectItem>
                                    <SelectItem value="won">Ganha</SelectItem>
                                    <SelectItem value="lost">Perdida</SelectItem>
                                    <SelectItem value="canceled">Cancelada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm text-[#A3A3A3] mb-2 block">Organização</label>
                            <Select
                                value={selectedOrganizationId}
                                onValueChange={(v) => {
                                    setSelectedOrganizationId(v);
                                    // reset event filter quando trocar organização
                                    setSelectedEventId("all");
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione uma organização" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {(organizations || []).map((org: any) => (
                                        <SelectItem key={String(org._id)} value={String(org._id)}>
                                            {org.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm text-[#A3A3A3] mb-2 block">Evento</label>
                            <Select value={selectedEventId} onValueChange={(v) => setSelectedEventId(v)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione um evento" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {(eventsWithOrg?.events || [])
                                        .filter((ev: any) =>
                                            selectedOrganizationId === "all" ? true : String(ev.organizationId) === selectedOrganizationId
                                        )
                                        .map((ev: any) => (
                                            <SelectItem key={String(ev._id)} value={String(ev._id)}>
                                                {ev.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm text-[#A3A3A3] mb-2 block">Limite</label>
                            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecionar limite" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabela de Disputas */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-white">Lista de Disputas</CardTitle>
                        <CardDescription className="text-[#A3A3A3]">
                            Disputas ordenadas por data de abertura (mais recentes primeiro).
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    {!disputes ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E65CFF]" />
                        </div>
                    ) : disputes.length === 0 ? (
                        <div className="text-[#A3A3A3]">Nenhuma disputa encontrada para os filtros selecionados.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Transaction ID</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Abertura</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {disputes.map((d: any) => (
                                    <TableRow key={String(d._id)}>
                                        <TableCell>
                                            <Badge className={statusBadgeColor(d.status)}>{d.status}</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono">{d.transactionId}</TableCell>
                                        <TableCell>{formatCurrency(d.amount || 0)}</TableCell>
                                        <TableCell className="uppercase">{d.paymentMethod || "-"}</TableCell>
                                        <TableCell>{eventNameById.get(String(d.eventId)) || "Evento desconhecido"}</TableCell>
                                        <TableCell>{formatDateTime(d.openedAt)}</TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/disputas/${String(d._id)}`} className="inline-block ml-2">
                                                <Button variant="outline">
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Ver detalhes
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}