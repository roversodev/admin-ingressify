"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Eye } from "lucide-react"

export type EventWithStats = {
  _id: string
  name: string
  description: string
  eventStartDate: number
  eventEndDate: number
  revenue: number
  producerAmount: number
  pixAvailable: number
  cardAvailable: number
  transactionCount: number
  paidTransactionCount: number
  [key: string]: any
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
};

const formatDateOnly = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

const getEventStatus = (startDate: number, endDate: number) => {
    const now = Date.now();
    if (startDate > now) return { label: "Próximo", color: "border-blue-500 text-blue-500 bg-blue-500/10" };
    if (endDate < now) return { label: "Finalizado", color: "border-zinc-600 text-zinc-400 bg-zinc-800" };
    return { label: "Em andamento", color: "bg-green-500/10 text-green-500 border-green-500/20" };
};

export const columns: ColumnDef<EventWithStats>[] = [
  {
    accessorKey: "name",
    header: "Evento",
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-white">{row.original.name}</div>
        <div className="text-sm text-[#A3A3A3] truncate max-w-[200px]">
            {row.original.description}
        </div>
      </div>
    )
  },
  {
    accessorKey: "eventStartDate",
    header: "Data",
    cell: ({ row }) => (
      <div>
        <div className="text-sm text-white">{formatDateOnly(row.original.eventStartDate)}</div>
        <div className="text-xs text-[#A3A3A3]">
            {new Date(row.original.eventStartDate).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            })}
        </div>
      </div>
    )
  },
  {
    accessorKey: "revenue",
    header: "Faturamento Bruto",
    cell: ({ row }) => (
      <div className="font-medium text-white">
        {formatCurrency(row.original.revenue || 0)}
      </div>
    )
  },
  {
    accessorKey: "producerAmount",
    header: "Valor ao Produtor",
    cell: ({ row }) => (
      <div className="font-medium text-green-400">
        {formatCurrency(row.original.producerAmount || 0)}
      </div>
    )
  },
  {
    id: "available",
    header: "Saldo Disponível",
    cell: ({ row }) => {
        const available = (row.original.pixAvailable || 0) + (row.original.cardAvailable || 0);
        return (
            <div>
                <div className="font-medium text-blue-400">
                    {formatCurrency(available)}
                </div>
                <div className="text-xs text-[#A3A3A3]">
                    PIX: {formatCurrency(row.original.pixAvailable || 0)}
                </div>
            </div>
        )
    }
  },
  {
    id: "transactions",
    header: "Transações",
    cell: ({ row }) => (
      <div>
        <div className="flex items-center text-white">
            <Users className="h-4 w-4 mr-1 text-[#A3A3A3]" />
            <span>{row.original.transactionCount || 0}</span>
        </div>
        <div className="text-xs text-[#A3A3A3]">
            {row.original.paidTransactionCount || 0} pagas
        </div>
      </div>
    )
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
        const status = getEventStatus(row.original.eventStartDate, row.original.eventEndDate);
        return (
            <Badge
                variant="outline"
                className={status.color}
            >
                {status.label}
            </Badge>
        )
    }
  },
  {
    id: "actions",
    header: "Ações",
    cell: ({ row }) => {
      const event = row.original
      return (
        <Button
            variant="outline"
            size="sm"
            onClick={() => document.dispatchEvent(new CustomEvent('view-event-details', { detail: event }))}
            className="border-zinc-700 text-white hover:bg-zinc-800"
        >
            <Eye className="h-4 w-4 mr-1" />
        </Button>
      )
    }
  }
]