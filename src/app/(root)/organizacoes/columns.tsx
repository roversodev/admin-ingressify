"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, Phone, ExternalLink, UserPlus, Users } from "lucide-react"
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
        window.open(`https://www.slticket.com/seller?org=${org._id}`, '_blank');
      }

      const handleJoin = () => {
        document.dispatchEvent(new CustomEvent('join-organization', { detail: { id: org._id, name: org.name } }))
      }

      const handleViewMembers = () => {
        document.dispatchEvent(new CustomEvent('view-organization-members', { detail: org._id }))
      }

      return (
        <div className="flex gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={handleViewMembers}
                className="border-zinc-700 text-white hover:bg-zinc-800 gap-2"
            >
                <Users className="h-3 w-3" />
                Membros
            </Button>
            
            {org.isMember ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAccess}
                  className="border-zinc-700 text-white hover:bg-zinc-800 gap-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  Acessar
                </Button>
            ) : (
                <Button
                  size="sm"
                  onClick={handleJoin}
                  className="bg-[#E8B322] text-black hover:bg-[#D4A017] gap-2"
                >
                  <UserPlus className="h-3 w-3" />
                  Entrar
                </Button>
            )}
        </div>
      )
    }
  }
]