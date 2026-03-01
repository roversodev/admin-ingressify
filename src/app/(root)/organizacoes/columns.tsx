"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Building2, 
  Phone, 
  ExternalLink, 
  UserPlus, 
  Users, 
  Trash2, 
  MoreHorizontal 
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useStorageUrl } from "@/lib/utils"
import { type GenericId as Id } from "convex/values";

// Tipo para as organizações
export type Organization = {
  _id: string
  name: string
  imageStorageId?: string
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  isMember: boolean
  memberRole?: string
  memberCount: number
}

function OrganizationNameCell({ org }: { org: Organization }) {
    const imageUrl = useStorageUrl(org.imageStorageId as Id<"_storage"> | undefined);

    return (
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md overflow-hidden bg-zinc-800 flex items-center justify-center text-xs font-semibold uppercase text-white">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={org.name}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    org.name?.[0]
                )}
            </div>
            <span className="text-white font-medium">{org.name}</span>
        </div>
    );
}

export const columns: ColumnDef<Organization>[] = [
  {
    accessorKey: "name",
    header: "Organização",
    cell: ({ row }) => <OrganizationNameCell org={row.original} />
  },
  {
    accessorKey: "ownerName",
    header: "Proprietário",
    cell: ({ row }) => <div className="text-white">{row.getValue("ownerName") || "N/A"}</div>
  },
  {
    accessorKey: "ownerPhone",
    header: "Contato",
    cell: ({ row }) => (
      <div className="flex items-center gap-2 text-white">
        <Phone className="h-3 w-3 text-[#A3A3A3]" />
        <span>{row.getValue("ownerPhone") || "N/A"}</span>
      </div>
    )
  },
  {
    accessorKey: "isMember",
    header: "Status",
    cell: ({ row }) => {
      const isMember = row.getValue("isMember") as boolean
      return isMember ? (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">
          Membro
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[#A3A3A3] border-zinc-600">
          Não membro
        </Badge>
      )
    }
  },
  {
    id: "actions",
    header: "Ações",
    cell: ({ row }) => {
      const org = row.original
      
      const handleAccess = () => {
        window.open(`https://www.ingressify.com.br/seller?org=${org._id}`, '_blank');
      }

      const handleJoin = () => {
        // Usar setTimeout para garantir que o DropdownMenu feche antes de abrir o Dialog
        // Isso evita o problema de 'pointer-events: none' travando o body
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('join-organization', { detail: { id: org._id, name: org.name } }))
        }, 100);
      }

      const handleViewMembers = () => {
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('view-organization-members', { detail: org._id }))
        }, 100);
      }

      const handleDelete = () => {
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('delete-organization', { detail: { id: org._id, name: org.name } }))
        }, 100);
      }

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 text-white hover:bg-zinc-800">
              <span className="sr-only">Abrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-white">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuItem 
              onClick={() => navigator.clipboard.writeText(org._id)}
              className="hover:bg-zinc-800 cursor-pointer focus:bg-zinc-800 focus:text-white"
            >
              Copiar ID
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-800" />
            
            <DropdownMenuItem 
              onClick={handleViewMembers}
              className="hover:bg-zinc-800 cursor-pointer focus:bg-zinc-800 focus:text-white"
            >
              <Users className="mr-2 h-4 w-4" />
              Ver Membros
            </DropdownMenuItem>

            {org.isMember ? (
              <DropdownMenuItem 
                onClick={handleAccess}
                className="hover:bg-zinc-800 cursor-pointer focus:bg-zinc-800 focus:text-white"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Acessar Painel
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem 
                onClick={handleJoin}
                className="hover:bg-zinc-800 cursor-pointer focus:bg-zinc-800 focus:text-white"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Entrar na Organização
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator className="bg-zinc-800" />
            
            <DropdownMenuItem 
              onClick={handleDelete}
              className="text-red-500 hover:bg-red-900/20 hover:text-red-400 cursor-pointer focus:bg-red-900/20 focus:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir Organização
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  }
]