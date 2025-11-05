'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/api';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Spinner from '@/components/Spinner';
import { toast } from 'sonner';

export default function UsuariosPage() {
  const { user, isLoaded } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['view_users', 'manage_users', 'manage_disputes']);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'support' | 'finance'>('admin');
  
  // Buscar todos os usuários
  const usersData = useQuery(api.admin.listAllUsers, 
    isLoaded && user?.id ? {
      userId: user.id,
      searchTerm: searchTerm,
      limit: 50
    } : "skip"
  );
  
  // Garantir que users seja sempre um array
  const users = usersData?.users || [];
  
  // Buscar todos os administradores
  const adminsData = useQuery(api.admin.listAllAdmins, 
    isLoaded && user?.id ? {
      currentUserId: user.id
    } : "skip"
  );
  
  // Garantir que admins seja sempre um array
  const admins = Array.isArray(adminsData) ? adminsData : [];
  
  // Mutation para adicionar um novo administrador
  const addAdmin = useMutation(api.admin.addAdmin);
  
  // Mutation para remover um administrador
  const removeAdmin = useMutation(api.admin.removeAdmin);
  
  // Mutation para atualizar permissões de um administrador
  const updateAdminPermissions = useMutation(api.admin.updateAdminPermissions);
  
  // Lista de permissões disponíveis
  const availablePermissions = [
    { id: 'view_users', label: 'Visualizar Usuários' },
    { id: 'manage_users', label: 'Gerenciar Usuários' },
    { id: 'view_events', label: 'Visualizar Eventos' },
    { id: 'manage_events', label: 'Gerenciar Eventos' },
    { id: 'view_finances', label: 'Visualizar Finanças' },
    { id: 'manage_finances', label: 'Gerenciar Finanças' },
    { id: 'manage_disputes', label: 'Gerenciar Disputas' },
  ];
  
  // Função para adicionar um novo administrador
  const handleAddAdmin = async (userId: string, email: string) => {
    try {
      await addAdmin({
        currentUserId: user?.id || '',
        newAdminUserId: userId,
        email: email,
        permissions: selectedPermissions,
        role: selectedRole
      });
      toast.success('Usuário promovido a administrador com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar administrador:', error);
      
      // Verifica se o erro é relacionado a permissões de superadmin
      if (error instanceof Error && 
          error.message.includes('superadmin') || 
          String(error).includes('superadmin')) {
        toast.error('Apenas superadmins podem adicionar novos administradores');
      } else {
        toast.error('Erro ao adicionar administrador');
      }
    }
  };
  
  // Função para remover um administrador
  const handleRemoveAdmin = async (adminUserId: string) => {
    if (confirm('Tem certeza que deseja remover este administrador?')) {
      try {
        await removeAdmin({
          currentUserId: user?.id || '',
          adminUserId: adminUserId
        });
        toast.success('Administrador removido com sucesso!');
      } catch (error) {
        console.error('Erro ao remover administrador:', error);
        
        // Verifica se o erro é relacionado a permissões de superadmin
        if (error instanceof Error && 
            error.message.includes('superadmin') || 
            String(error).includes('superadmin')) {
          toast.error('Apenas superadmins podem remover administradores');
        } else {
          toast.error('Erro ao remover administrador');
        }
      }
    }
  };
  
  // Função para atualizar permissões de um administrador
  const handleUpdatePermissions = async (adminUserId: string, permissions: string[], role: 'admin' | 'support' | 'finance') => {
    try {
      await updateAdminPermissions({
        currentUserId: user?.id || '',
        adminUserId: adminUserId,
        permissions: permissions,
        role: role
      });
      toast.success('Permissões atualizadas com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar permissões:', error);
      toast.error('Erro ao atualizar permissões');
    }
  };
  
  // Função para alternar uma permissão na lista de selecionadas
  const togglePermission = (permissionId: string) => {
    if (selectedPermissions.includes(permissionId)) {
      setSelectedPermissions(selectedPermissions.filter(id => id !== permissionId));
    } else {
      setSelectedPermissions([...selectedPermissions, permissionId]);
    }
  };
  
  if (!isLoaded) {
    return <Spinner />;
  }
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Administradores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Input 
                placeholder="Email do novo administrador" 
                value={newAdminEmail} 
                onChange={(e) => setNewAdminEmail(e.target.value)} 
                className="max-w-md"
              />
              <div className="flex flex-wrap gap-2">
                <select 
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'support' | 'finance')}
                  className="border rounded px-3 py-2"
                >
                  <option value="admin">Admin</option>
                  <option value="support">Suporte</option>
                  <option value="finance">Financeiro</option>
                </select>
                <Button 
                  onClick={() => {
                    const foundUser = users.find((u: { email: string; }) => u.email === newAdminEmail);
                    if (foundUser) {
                      handleAddAdmin(foundUser.userId, foundUser.email);
                    } else {
                      toast.error('Usuário não encontrado');
                    }
                  }}
                >
                  Adicionar Admin
                </Button>
              </div>
            </div>
            
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Permissões:</h3>
              <div className="flex flex-wrap gap-2">
                {availablePermissions.map(permission => (
                  <Badge 
                    key={permission.id}
                    variant={selectedPermissions.includes(permission.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => togglePermission(permission.id)}
                  >
                    {permission.label}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="border rounded-md mt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 font-medium p-3 border-b bg-muted/50">
                <div>Email</div>
                <div>Função</div>
                <div>Ações</div>
              </div>
              {admins && admins.length > 0 ? admins.map((admin: any) => (
                <div key={admin._id} className="grid grid-cols-1 md:grid-cols-4 p-3 border-b last:border-0">
                  <div>{admin.email}</div>
                  <div>
                    <Badge variant="outline">{admin.role}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Abrir modal ou expandir para editar permissões
                        handleUpdatePermissions(admin.userId, selectedPermissions, selectedRole);
                      }}
                    >
                      Editar
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleRemoveAdmin(admin.userId)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="p-3 text-center text-muted-foreground">
                  Nenhum administrador encontrado
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Todos os Usuários</CardTitle>
          <div className="mt-2">
            <Input 
              placeholder="Buscar usuários..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-4 font-medium p-3 border-b bg-muted/50">
              <div>Nome</div>
              <div>Email</div>
              <div>Status</div>
              <div>Ações</div>
            </div>
            {users && users.length > 0 ? users.map((user: any) => (
              <div key={user._id} className="grid grid-cols-1 md:grid-cols-4 p-3 border-b last:border-0">
                <div>{user.name}</div>
                <div>{user.email}</div>
                <div>
                  {admins && admins.length > 0 && admins.some((admin: any) => admin.userId === user.userId) ? (
                    <Badge>Administrador</Badge>
                  ) : (
                    <Badge variant="outline">Usuário</Badge>
                  )}
                </div>
                <div>
                  {admins && admins.length > 0 && !admins.some((admin: any) => admin.userId === user.userId) && (
                    <Button 
                      size="sm"
                      onClick={() => handleAddAdmin(user.userId, user.email)}
                    >
                      Tornar Admin
                    </Button>
                  )}
                </div>
              </div>
            )) : (
              <div className="p-3 text-center text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}