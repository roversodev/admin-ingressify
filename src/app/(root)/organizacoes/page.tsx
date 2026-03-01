"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/api";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, MessageCircle, MoreHorizontal, UserX, Shield, AlertTriangle, X } from "lucide-react";
import { toast } from 'sonner';
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GenericId } from "convex/values";
import { PaginationState } from "@tanstack/react-table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function OrganizationsPage() {
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = useState("");
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [isMembersOpen, setIsMembersOpen] = useState(false);

    // Estados para gerenciamento de exclusão de organização
    const [isDeleteOrgOpen, setIsDeleteOrgOpen] = useState(false);
    const [orgToDelete, setOrgToDelete] = useState<{id: string, name: string} | null>(null);

    // Estados para gerenciamento de membros
    const [isRemoveMemberOpen, setIsRemoveMemberOpen] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<{id: string, name: string} | null>(null);
    
    const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
    const [memberToChangeRole, setMemberToChangeRole] = useState<{id: string, name: string, role: string} | null>(null);
    const [newRole, setNewRole] = useState<string>("");

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
    const removeOrganizationMember = useMutation(api.admin.removeOrganizationMember);
    const updateOrganizationMemberRole = useMutation(api.admin.updateOrganizationMemberRole);
    const deleteOrganization = useMutation(api.admin.deleteOrganization);

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

    const handleDeleteOrganization = (e: any) => {
        setOrgToDelete(e.detail);
        setIsDeleteOrgOpen(true);
    };

    const confirmDeleteOrganization = async () => {
        if (!orgToDelete || !user?.id) return;
        
        try {
            toast.loading(`Excluindo organização ${orgToDelete.name}...`);
            await deleteOrganization({
                adminId: user.id,
                organizationId: orgToDelete.id as GenericId<"organizations">
            });
            toast.success(`Organização ${orgToDelete.name} excluída com sucesso`);
            setIsDeleteOrgOpen(false);
            setOrgToDelete(null);
        } catch (error) {
            console.error("Erro ao excluir organização:", error);
            toast.error("Erro ao excluir organização");
        } finally {
            toast.dismiss();
        }
    };

    const confirmRemoveMember = async () => {
        if (!memberToRemove || !selectedOrgId || !user?.id) return;

        try {
            toast.loading(`Removendo membro ${memberToRemove.name}...`);
            await removeOrganizationMember({
                adminId: user.id,
                organizationId: selectedOrgId as GenericId<"organizations">,
                userId: memberToRemove.id
            });
            toast.success(`Membro ${memberToRemove.name} removido com sucesso`);
            setIsRemoveMemberOpen(false);
            setMemberToRemove(null);
        } catch (error: any) {
            console.error("Erro ao remover membro:", error);
            toast.error(error.message || "Erro ao remover membro");
        } finally {
            toast.dismiss();
        }
    };

    const confirmChangeRole = async () => {
        if (!memberToChangeRole || !selectedOrgId || !user?.id || !newRole) return;

        try {
            toast.loading(`Alterando papel de ${memberToChangeRole.name}...`);
            await updateOrganizationMemberRole({
                adminId: user.id,
                organizationId: selectedOrgId as GenericId<"organizations">,
                userId: memberToChangeRole.id,
                newRole: newRole as "owner" | "admin" | "staff"
            });
            toast.success(`Papel alterado com sucesso`);
            setIsChangeRoleOpen(false);
            setMemberToChangeRole(null);
        } catch (error: any) {
            console.error("Erro ao alterar papel:", error);
            toast.error(error.message || "Erro ao alterar papel");
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
        const handleDelete = (e: any) => handleDeleteOrganization(e);

        document.addEventListener('join-organization', handleJoin);
        document.addEventListener('view-organization-members', handleViewMembers);
        document.addEventListener('delete-organization', handleDelete);

        return () => {
            document.removeEventListener('join-organization', handleJoin);
            document.removeEventListener('view-organization-members', handleViewMembers);
            document.removeEventListener('delete-organization', handleDelete);
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
                                                <div className="flex items-center gap-2">
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
                                                    
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800">
                                                                <span className="sr-only">Abrir menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-white">
                                                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                            <DropdownMenuItem 
                                                                onClick={() => {
                                                                    setMemberToChangeRole({ 
                                                                        id: member.userId, 
                                                                        name: member.userName || "Usuário", 
                                                                        role: member.role 
                                                                    });
                                                                    setNewRole(member.role);
                                                                    setIsChangeRoleOpen(true);
                                                                }}
                                                                className="hover:bg-zinc-800 cursor-pointer focus:bg-zinc-800 focus:text-white"
                                                            >
                                                                <Shield className="mr-2 h-4 w-4" />
                                                                Alterar Papel
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator className="bg-zinc-800" />
                                                            <DropdownMenuItem 
                                                                onClick={() => {
                                                                    setMemberToRemove({ 
                                                                        id: member.userId, 
                                                                        name: member.userName || "Usuário" 
                                                                    });
                                                                    setIsRemoveMemberOpen(true);
                                                                }}
                                                                className="text-red-500 hover:bg-red-900/20 hover:text-red-400 cursor-pointer focus:bg-red-900/20 focus:text-red-400"
                                                            >
                                                                <UserX className="mr-2 h-4 w-4" />
                                                                Remover Membro
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog de Confirmação de Exclusão de Organização */}
            <Dialog open={isDeleteOrgOpen} onOpenChange={setIsDeleteOrgOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-500 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Excluir Organização
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Tem certeza que deseja excluir a organização <strong className="text-white">{orgToDelete?.name}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 text-sm text-zinc-300 bg-red-950/30 p-4 rounded-md border border-red-900/50">
                        <p className="font-semibold text-red-400 mb-2">Atenção: Esta ação é irreversível!</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Todos os eventos e ingressos serão excluídos</li>
                            <li>Todos os membros e convites serão removidos</li>
                            <li>Todo o histórico financeiro será apagado</li>
                            <li>Todas as configurações serão perdidas</li>
                        </ul>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsDeleteOrgOpen(false)}
                            className="border-zinc-700 text-white hover:bg-zinc-800"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={confirmDeleteOrganization}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Excluir Definitivamente
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Confirmação de Remoção de Membro */}
            <Dialog open={isRemoveMemberOpen} onOpenChange={setIsRemoveMemberOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Remover Membro</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Tem certeza que deseja remover <strong className="text-white">{memberToRemove?.name}</strong> desta organização?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsRemoveMemberOpen(false)}
                            className="border-zinc-700 text-white hover:bg-zinc-800"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={confirmRemoveMember}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Remover Membro
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Alteração de Papel */}
            <Dialog open={isChangeRoleOpen} onOpenChange={setIsChangeRoleOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Alterar Papel do Membro</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Selecione o novo papel para <strong className="text-white">{memberToChangeRole?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        <Select value={newRole} onValueChange={setNewRole}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white w-full">
                                <SelectValue placeholder="Selecione um papel" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                                <SelectItem value="staff">Staff (Acesso limitado)</SelectItem>
                                <SelectItem value="admin">Administrador (Acesso total)</SelectItem>
                                <SelectItem value="owner">Proprietário (Transferir posse)</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        {newRole === "owner" && (
                            <p className="text-amber-500 text-xs mt-2 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Ao transferir a propriedade, você perderá seu status de proprietário.
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsChangeRoleOpen(false)}
                            className="border-zinc-700 text-white hover:bg-zinc-800"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            onClick={confirmChangeRole}
                            className="bg-[#E65CFF] text-black hover:bg-[#D4A017]"
                        >
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Confirmação de Exclusão de Organização */}
            <Dialog open={isDeleteOrgOpen} onOpenChange={setIsDeleteOrgOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-500 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Excluir Organização
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Tem certeza que deseja excluir a organização <strong className="text-white">{orgToDelete?.name}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 text-sm text-zinc-300 bg-red-950/30 p-4 rounded-md border border-red-900/50">
                        <p className="font-semibold text-red-400 mb-2">Atenção: Esta ação é irreversível!</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Todos os eventos e ingressos serão excluídos</li>
                            <li>Todos os membros e convites serão removidos</li>
                            <li>Todo o histórico financeiro será apagado</li>
                            <li>Todas as configurações serão perdidas</li>
                        </ul>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsDeleteOrgOpen(false)}
                            className="border-zinc-700 text-white hover:bg-zinc-800"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={confirmDeleteOrganization}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Excluir Definitivamente
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Confirmação de Remoção de Membro */}
            <Dialog open={isRemoveMemberOpen} onOpenChange={setIsRemoveMemberOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Remover Membro</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Tem certeza que deseja remover <strong className="text-white">{memberToRemove?.name}</strong> desta organização?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsRemoveMemberOpen(false)}
                            className="border-zinc-700 text-white hover:bg-zinc-800"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={confirmRemoveMember}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Remover Membro
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Alteração de Papel */}
            <Dialog open={isChangeRoleOpen} onOpenChange={setIsChangeRoleOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Alterar Papel do Membro</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Selecione o novo papel para <strong className="text-white">{memberToChangeRole?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        <Select value={newRole} onValueChange={setNewRole}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white w-full">
                                <SelectValue placeholder="Selecione um papel" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                                <SelectItem value="staff">Staff (Acesso limitado)</SelectItem>
                                <SelectItem value="admin">Administrador (Acesso total)</SelectItem>
                                <SelectItem value="owner">Proprietário (Transferir posse)</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        {newRole === "owner" && (
                            <p className="text-amber-500 text-xs mt-2 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Ao transferir a propriedade, você perderá seu status de proprietário.
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsChangeRoleOpen(false)}
                            className="border-zinc-700 text-white hover:bg-zinc-800"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            onClick={confirmChangeRole}
                            className="bg-[#E65CFF] text-black hover:bg-[#D4A017]"
                        >
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}