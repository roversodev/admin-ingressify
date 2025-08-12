"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Tipo para as transações
export type Transaction = {
  _id: string
  transactionId: string
  eventName: string
  createdAt: number
  amount: number
  status: string
}

export const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "transactionId",
    header: "ID da Transação",
    cell: ({ row }) => <div className="truncate max-w-[150px]">{row.getValue("transactionId")}</div>
  },
  {
    accessorKey: "eventName",
    header: "Evento",
  },
  {
    accessorKey: "createdAt",
    header: "Data",
    cell: ({ row }) => {
      const timestamp = row.getValue("createdAt") as number
      return new Date(timestamp).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  },
  {
    accessorKey: "amount",
    header: "Valor",
    cell: ({ row }) => {
      const amount = row.getValue("amount") as number
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(amount)
    }
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge className={status === "paid" ? "bg-green-500" : status === "pending" ? "bg-yellow-500" : "bg-red-500"}>
          {status}
        </Badge>
      )
    }
  },
  {
    id: "actions",
    header: "Ações",
    cell: ({ row }) => {
      const transaction = row.original
      
      return (
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => document.dispatchEvent(new CustomEvent('view-transaction-details', { detail: transaction.transactionId }))}
        >
          Ver Detalhes
        </Button>
      )
    }
  }
]