'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Ticket, Search, Filter, Eye, Download, CheckCircle, XCircle, Clock, RefreshCw, Hash, Calendar, DollarSign, User, Mail, Phone, CreditCard, RotateCcw, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import Spinner from '@/components/Spinner';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface TicketData {
    _id: string;
    eventId: string;
    eventName: string;
    ticketTypeName: string;
    status: 'valid' | 'used' | 'refunded' | 'cancelled' | 'transfered';
    purchasedAt: number;
    totalAmount: number;
    amount: number;
    userName: string;
    userEmail: string;
    userPhone?: string;
    userCpf?: string;
    transactionId?: string;
    transactionStatus?: string;
    transactionAmount?: number;
    formattedPurchaseDate: string;
    formattedAmount: string;
}

export default function IngressosPage() {
    const { user, isLoaded } = useUser();
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEvent, setSelectedEvent] = useState<string>('all');
    const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Mutation para atualizar status do ticket
    const updateTicketStatus = useMutation(api.admin.updateTicketStatusAdmin);

    // Buscar eventos para o filtro
    const eventsData = useQuery(api.admin.listAllEvents,
        user?.id ? { userId: user.id } : "skip"
    );

    // Buscar todos os ingressos da plataforma (SEM searchTerm)
    const allTicketsData = useQuery(api.admin.getAllPlatformTickets,
        user?.id ? {
            userId: user.id,
            eventId: selectedEvent !== 'all' ? selectedEvent as any : undefined,
            status: selectedStatus !== 'all' ? selectedStatus as any : undefined,
            limit: 1000
        } : "skip"
    );

    // Verificar se os dados estão carregando - CORRIGIDO
    const isLoadingTickets = !user?.id || allTicketsData === undefined;
    const isLoadingEvents = !user?.id || eventsData === undefined;

    // Filtrar ingressos localmente (incluindo busca por texto)
    const filteredTickets = (allTicketsData || []).filter((ticket: any) => {
        const matchesSearch = !searchTerm ||
            ticket.eventName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket._id?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = selectedStatus === 'all' || ticket.status === selectedStatus;
        const matchesEvent = selectedEvent === 'all' || ticket.eventId === selectedEvent;

        return matchesSearch && matchesStatus && matchesEvent;
    });

    // Estatísticas dos ingressos
    const stats = {
        total: filteredTickets.length,
        valid: filteredTickets.filter((t: any) => t.status === 'valid').length,
        used: filteredTickets.filter((t: any) => t.status === 'used').length,
        refunded: filteredTickets.filter((t: any) => t.status === 'refunded').length,
        cancelled: filteredTickets.filter((t: any) => t.status === 'cancelled').length,
        transfered: filteredTickets.filter((t: any) => t.status === 'transfered').length
    };

    const handleStatusChange = async (ticketId: string, newStatus: string) => {
        if (!user?.id) {
            toast.error('Usuário não autenticado');
            return;
        }

        try {
            await updateTicketStatus({
                userId: user.id,
                ticketId: ticketId as any,
                newStatus: newStatus as 'valid' | 'used' | 'refunded' | 'cancelled' | 'transfered',
                reason: `Status alterado para ${newStatus} pelo administrador`
            });
            toast.success('Status do ingresso atualizado com sucesso!');
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            toast.error('Erro ao atualizar status do ingresso');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'valid': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'used': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'refunded': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'transfered': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'valid': return <CheckCircle className="w-4 h-4" />;
            case 'used': return <Eye className="w-4 h-4" />;
            case 'refunded': return <RotateCcw className="w-4 h-4" />;
            case 'cancelled': return <XCircle className="w-4 h-4" />;
            case 'transfered': return <ArrowRightLeft className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner />
            </div>
        );
    }

    // Função para gerar e baixar PDF do ingresso com QR Code
    const handleDownloadPDF = async (ticket: TicketData) => {
        try {
            // Criar novo documento PDF
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Configurações de cores
            const primaryColor = '#E65CFF';
            const textColor = '#333333';
            const lightGray = '#666666';

            // Gerar QR Code
            const qrCodeData = `${ticket._id}|${ticket.eventName}|${ticket.status}`;
            const qrCodeDataURL = await QRCode.toDataURL(qrCodeData, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            // Configurar fonte
            pdf.setFont('helvetica');

            // Header com cor de fundo
            pdf.setFillColor(230, 92, 255); // #E65CFF
            pdf.rect(0, 0, 210, 40, 'F');

            // Título principal
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(24);
            pdf.setFont('helvetica', 'bold');
            pdf.text('INGRESSO ELETRÔNICO', 105, 20, { align: 'center' });

            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Ingressify Platform', 105, 30, { align: 'center' });

            // Reset cor do texto
            pdf.setTextColor(51, 51, 51); // #333333

            // Nome do evento
            pdf.setFontSize(20);
            pdf.setFont('helvetica', 'bold');
            pdf.text(ticket.eventName || 'Evento', 20, 60);

            // Linha separadora
            pdf.setDrawColor(230, 92, 255);
            pdf.setLineWidth(1);
            pdf.line(20, 65, 190, 65);

            // Informações do ingresso - Coluna esquerda
            let yPos = 80;
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(102, 102, 102); // #666666
            
            pdf.text('INFORMAÇÕES DO INGRESSO', 20, yPos);
            yPos += 10;
            
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(51, 51, 51);
            
            // ID do Ingresso
            pdf.setFont('helvetica', 'bold');
            pdf.text('ID:', 20, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(ticket._id, 35, yPos);
            yPos += 8;
            
            // Tipo do Ingresso
            pdf.setFont('helvetica', 'bold');
            pdf.text('Tipo:', 20, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(ticket.ticketTypeName || 'N/A', 35, yPos);
            yPos += 8;
            
            // Valor
            pdf.setFont('helvetica', 'bold');
            pdf.text('Valor:', 20, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(ticket.formattedAmount || 'N/A', 35, yPos);
            yPos += 8;
            
            // Data de Compra
            pdf.setFont('helvetica', 'bold');
            pdf.text('Compra:', 20, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(ticket.formattedPurchaseDate || 'N/A', 35, yPos);
            yPos += 8;
            
            // Status
            pdf.setFont('helvetica', 'bold');
            pdf.text('Status:', 20, yPos);
            pdf.setFont('helvetica', 'normal');
            
            // Cor do status
            switch(ticket.status) {
                case 'valid':
                  pdf.setTextColor(34, 197, 94); // green
                  pdf.text('VÁLIDO', 35, yPos);
                  break;
                case 'used':
                  pdf.setTextColor(59, 130, 246); // blue
                  pdf.text('USADO', 35, yPos);
                  break;
                case 'refunded':
                  pdf.setTextColor(239, 68, 68); // red
                  pdf.text('REEMBOLSADO', 35, yPos);
                  break;
                case 'cancelled':
                  pdf.setTextColor(156, 163, 175); // gray
                  pdf.text('CANCELADO', 35, yPos);
                  break;
                default:
                  pdf.text((ticket.status as string).toUpperCase(), 35, yPos);
            }
            
            pdf.setTextColor(51, 51, 51); // Reset cor
            yPos += 15;
            
            // Informações do cliente
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(102, 102, 102);
            pdf.text('INFORMAÇÕES DO CLIENTE', 20, yPos);
            yPos += 10;
            
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(51, 51, 51);
            
            // Nome
            pdf.setFont('helvetica', 'bold');
            pdf.text('Nome:', 20, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(ticket.userName || 'N/A', 35, yPos);
            yPos += 8;
            
            // Email
            pdf.setFont('helvetica', 'bold');
            pdf.text('Email:', 20, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(ticket.userEmail || 'N/A', 35, yPos);
            yPos += 8;
            
            // Telefone
            if (ticket.userPhone) {
              pdf.setFont('helvetica', 'bold');
              pdf.text('Telefone:', 20, yPos);
              pdf.setFont('helvetica', 'normal');
              pdf.text(ticket.userPhone, 35, yPos);
              yPos += 8;
            }
            
            // Transação
            if (ticket.transactionId) {
              pdf.setFont('helvetica', 'bold');
              pdf.text('Transação:', 20, yPos);
              pdf.setFont('helvetica', 'normal');
              pdf.text(ticket.transactionId, 35, yPos);
            }

            // QR Code - lado direito
            pdf.addImage(qrCodeDataURL, 'PNG', 130, 80, 50, 50);
            
            // Texto abaixo do QR Code
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(102, 102, 102);
            pdf.text('QR CODE DE VALIDAÇÃO', 155, 140, { align: 'center' });
            
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.text('Apresente este código na entrada', 155, 148, { align: 'center' });

            // Footer
            pdf.setFontSize(8);
            pdf.setTextColor(102, 102, 102);
            pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, 280);
            pdf.text('Este é um ingresso válido - Ingressify Platform', 105, 285, { align: 'center' });
            
            // Linha decorativa no footer
            pdf.setDrawColor(230, 92, 255);
            pdf.setLineWidth(0.5);
            pdf.line(20, 275, 190, 275);

            // Salvar o PDF
            const fileName = `ingresso-${ticket.eventName?.replace(/[^a-zA-Z0-9]/g, '-')}-${ticket._id.slice(-8)}.pdf`;
            pdf.save(fileName);
            
            toast.success('PDF do ingresso gerado com sucesso!');
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            toast.error('Erro ao gerar PDF do ingresso');
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col space-y-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: '#E65CFF20' }}>
                        <Ticket className="w-6 h-6" style={{ color: '#E65CFF' }} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Gerenciar Ingressos</h1>
                        <p className="text-gray-400">Visualize e gerencie todos os ingressos da plataforma</p>
                    </div>
                </div>

                {/* Estatísticas com Loading */}
                {isLoadingTickets ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[...Array(5)].map((_, i) => (
                            <Card key={i} className="bg-card border-border">
                                <CardContent className="p-4">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Skeleton className="w-4 h-4" />
                                        <Skeleton className="w-16 h-3" />
                                    </div>
                                    <Skeleton className="w-8 h-6" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card className="bg-card border-border">
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <Ticket className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-400">Total</span>
                                </div>
                                <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-border">
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    <span className="text-sm text-gray-400">Válidos</span>
                                </div>
                                <p className="text-2xl font-bold text-white mt-1">{stats.valid}</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-border">
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <Eye className="w-4 h-4 text-blue-400" />
                                    <span className="text-sm text-gray-400">Utilizados</span>
                                </div>
                                <p className="text-2xl font-bold text-white mt-1">{stats.used}</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-border">
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <RotateCcw className="w-4 h-4 text-yellow-400" />
                                    <span className="text-sm text-gray-400">Reembolsados</span>
                                </div>
                                <p className="text-2xl font-bold text-white mt-1">{stats.refunded}</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-border">
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <XCircle className="w-4 h-4 text-red-400" />
                                    <span className="text-sm text-gray-400">Cancelados</span>
                                </div>
                                <p className="text-2xl font-bold text-white mt-1">{stats.cancelled}</p>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Filtros */}
            <Card className="bg-card border-border">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    placeholder="Buscar por evento, cliente, email ou ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 bg-background border-border text-white placeholder:text-gray-400"
                                    disabled={isLoadingTickets}
                                />
                            </div>
                        </div>

                        <Select value={selectedEvent} onValueChange={setSelectedEvent} disabled={isLoadingEvents}>
                            <SelectTrigger className="w-full md:w-[200px] bg-background border-border text-white">
                                <SelectValue placeholder="Selecionar evento" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os eventos</SelectItem>
                                {eventsData?.events?.map((event: any) => (
                                    <SelectItem key={event._id} value={event._id}>
                                        {event.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedStatus} onValueChange={setSelectedStatus} disabled={isLoadingTickets}>
                            <SelectTrigger className="w-full md:w-[150px] bg-background border-border text-white">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="valid">Válidos</SelectItem>
                                <SelectItem value="used">Utilizados</SelectItem>
                                <SelectItem value="refunded">Reembolsados</SelectItem>
                                <SelectItem value="cancelled">Cancelados</SelectItem>
                                <SelectItem value="transfered">Transferidos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Lista de Ingressos com Loading */}
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                        <Filter className="w-5 h-5" style={{ color: '#E65CFF' }} />
                        <span>Ingressos ({isLoadingTickets ? '...' : filteredTickets.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingTickets ? (
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-4 border border-border rounded-lg min-h-[150px]">
                                    <div className="flex items-center space-x-4 flex-1">
                                        <Skeleton className="w-10 h-10 rounded" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="w-32 h-4" />
                                            <Skeleton className="w-48 h-3" />
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <Skeleton className="w-16 h-6" />
                                        <Skeleton className="w-20 h-8" />
                                        <Skeleton className="w-20 h-8" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="text-center py-12">
                            <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-400">Nenhum ingresso encontrado</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredTickets.map((ticket: any) => (
                                <Card key={ticket._id} className="bg-background border-border hover:border-[#E65CFF]/30 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center space-x-3">
                                                    <Badge className={getStatusColor(ticket.status)}>
                                                        {getStatusIcon(ticket.status)}
                                                        {ticket.status === 'valid' && 'Válido'}
                                                        {ticket.status === 'used' && 'Usado'}
                                                        {ticket.status === 'refunded' && 'Reembolsado'}
                                                        {ticket.status === 'cancelled' && 'Cancelado'}
                                                    </Badge>
                                                    <span className="text-white font-medium">{ticket.eventName}</span>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-gray-400">ID:</span>
                                                        <p className="text-white font-mono">{ticket._id.slice(-8)}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">Cliente:</span>
                                                        <p className="text-white">{ticket.userName || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">Valor:</span>
                                                        <p className="text-white">{ticket.formattedAmount}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">Data:</span>
                                                        <p className="text-white">{ticket.formattedPurchaseDate}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedTicket(ticket);
                                                        setIsDetailsOpen(true);
                                                    }}
                                                    className="border-border text-white hover:bg-[#E65CFF]/10 hover:border-[#E65CFF]/50"
                                                >
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    Detalhes
                                                </Button>

                                                <Select onValueChange={(value) => handleStatusChange(ticket._id, value as any)}>
                                                    <SelectTrigger className="w-[120px] bg-background border-border text-white">
                                                        <SelectValue placeholder="Ações" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="valid">Marcar como Válido</SelectItem>
                                                        <SelectItem value="used">Marcar como Usado</SelectItem>
                                                        <SelectItem value="refunded">Reembolsar</SelectItem>
                                                        <SelectItem value="cancelled">Cancelar</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal de Detalhes */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-2xl bg-card border-border sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center space-x-2">
                            <Ticket className="w-5 h-5" style={{ color: '#E65CFF' }} />
                            <span>Detalhes do Ingresso</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedTicket && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-3">Informações do Ingresso</h3>
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <Hash className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-400">ID:</span>
                                                <span className="text-white">{selectedTicket._id}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-400">Evento:</span>
                                                <span className="text-white">{selectedTicket.eventName || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <DollarSign className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-400">Valor:</span>
                                                <span className="text-white">{selectedTicket.formattedAmount}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-400">Data de Compra:</span>
                                                <span className="text-white">{selectedTicket.formattedPurchaseDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-3">Informações do Cliente</h3>
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-400">Nome:</span>
                                                <span className="text-white">{selectedTicket.userName || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Mail className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-400">Email:</span>
                                                <span className="text-white">{selectedTicket.userEmail || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Phone className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-400">Telefone:</span>
                                                <span className="text-white">{selectedTicket.userPhone || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <CreditCard className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-400">Transação:</span>
                                                <span className="text-white">{selectedTicket.transactionId || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-border">
                                <div className="flex items-center space-x-2">
                                    <Badge className={getStatusColor(selectedTicket.status)}>
                                        {getStatusIcon(selectedTicket.status)}
                                        {selectedTicket.status === 'valid' && 'Válido'}
                                        {selectedTicket.status === 'used' && 'Usado'}
                                        {selectedTicket.status === 'refunded' && 'Reembolsado'}
                                        {selectedTicket.status === 'cancelled' && 'Cancelado'}
                                    </Badge>
                                </div>

                                <Button
                                    onClick={() => handleDownloadPDF(selectedTicket)}
                                    variant="outline"
                                    size="sm"
                                    className="border-border text-white hover:bg-[#E65CFF]/10 hover:border-[#E65CFF]/50"
                                >
                                    <Download className="w-4 h-4 mr-1" />
                                    Baixar PDF
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
