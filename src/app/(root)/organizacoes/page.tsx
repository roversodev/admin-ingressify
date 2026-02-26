"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/api";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, MessageCircle } from "lucide-react";
import { toast } from 'sonner';
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GenericId } from "convex/values";
import { PaginationState } from "@tanstack/react-table";

export default function OrganizationsPage() {
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = useState("");
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [isMembersOpen, setIsMembersOpen] = useState(false);

    const organizationsData = useQuery(
        api.admin.listAllOrganizations,
        user?.id
            ? {
                userId: user.id,
                searchTerm,
                skip: pagination.pageIndex * pagination.pageSize,
                limit: pagination.pageSize,
            }
            : "skip"
    );

    const organizations = organizationsData?.data || [];
    const totalCount = organizationsData?.total || 0;
    const pageCount = Math.ceil(totalCount / pagination.pageSize);

    const members = useQuery(
        api.organizations.getOrganizationMembers,
        selectedOrgId ? { organizationId: selectedOrgId as GenericId<"organizations"> } : "skip"
    );

    // Resetar para primeira página quando o termo de busca mudar
    useEffect(() => {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }, [searchTerm]);

    const addSelfToOrganization = useMutation(api.admin.addSelfToOrganization);

    const handleJoinOrganization = async (orgId: any, orgName: string) => {
        try {
            toast.loading(`Entrando na organização ${orgName}...`);
            await addSelfToOrganization({
                adminId: user?.id || "",
                organizationId: orgId
            });
            toast.success(`Você agora é membro de ${orgName}`);
        } catch (error) {
            console.error("Erro ao entrar na organização:", error);
            toast.error("Erro ao entrar na organização");
        } finally {
            toast.dismiss();
        }
    };

    useEffect(() => {
        const handleJoin = (e: any) => handleJoinOrganization(e.detail.id, e.detail.name);
        const handleViewMembers = (e: any) => {
            setSelectedOrgId(e.detail);
            setIsMembersOpen(true);
        };

        document.addEventListener('join-organization', handleJoin);
        document.addEventListener('view-organization-members', handleViewMembers);

        return () => {
            document.removeEventListener('join-organization', handleJoin);
            document.removeEventListener('view-organization-members', handleViewMembers);
        };
    }, []);

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Organizações</h1>
                <p className="text-[#A3A3A3] mt-2">
                    Gerencie as organizações e seus acessos
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div>
                            <CardTitle className="text-white">Lista de Organizações</CardTitle>
                            <CardDescription className="text-[#A3A3A3]">
                                Visualize proprietários e gerencie sua participação
                            </CardDescription>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#A3A3A3] h-4 w-4" />
                            <Input
                                placeholder="Buscar organizações..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder-[#A3A3A3]"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {!organizationsData ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E65CFF] mx-auto"></div>
                            <p className="text-[#A3A3A3] mt-2">Carregando organizações...</p>
                        </div>
                    ) : organizations.length === 0 ? (
                        <div className="text-center py-8">
                            <Building2 className="h-12 w-12 text-[#A3A3A3] mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">Nenhuma organização encontrada</h3>
                            <p className="text-[#A3A3A3]">
                                {searchTerm ? 'Tente ajustar sua busca.' : 'Não há organizações cadastradas.'}
                            </p>
                        </div>
                    ) : (
                        <DataTable 
                            columns={columns} 
                            data={organizations}
                            pageCount={pageCount}
                            pagination={pagination}
                            onPaginationChange={setPagination}
                        />
                    )}
                </CardContent>
            </Card>

            <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
                <DialogContent className="max-w-4xl bg-zinc-900 text-white border-zinc-800 max-h-[80vh] overflow-y-auto sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Membros da Organização</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Lista de membros e informações de contato.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        {!members ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E65CFF]"></div>
                            </div>
                        ) : members.length === 0 ? (
                            <p className="text-center text-zinc-500 py-8">Nenhum membro encontrado.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                        <TableHead className="text-zinc-400">Nome</TableHead>
                                        <TableHead className="text-zinc-400">Email</TableHead>
                                        <TableHead className="text-zinc-400">Função</TableHead>
                                        <TableHead className="text-zinc-400">Telefone</TableHead>
                                        <TableHead className="text-zinc-400">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {members.map((member: any) => (
                                        <TableRow key={member._id} className="border-zinc-800 hover:bg-zinc-800/50">
                                            <TableCell className="text-white">{member.userName || "N/A"}</TableCell>
                                            <TableCell className="text-zinc-300">{member.userEmail || member.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                                                    {member.role === 'owner' ? 'Proprietário' : 
                                                     member.role === 'admin' ? 'Administrador' : 
                                                     member.role === 'staff' ? 'Staff' : member.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-zinc-300">{member.userPhone || "N/A"}</TableCell>
                                            <TableCell>
                                                {member.userPhone && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="hover:bg-green-500/10 hover:text-green-500"
                                                        onClick={() => window.open(`https://wa.me/55${member.userPhone.replace(/\D/g, '')}`, '_blank')}
                                                    >
                                                        <MessageCircle className="h-4 w-4" />
                                                        <span className="sr-only">WhatsApp</span>
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}