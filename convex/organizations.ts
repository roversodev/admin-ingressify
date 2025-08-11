import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Criar uma nova organização
export const createOrganization = mutation({
  args: {
    name: v.string(),
    userId: v.string(),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    responsibleName: v.string(),
    responsibleDocument: v.string(),
    pixKeys: v.optional(v.array(v.object({
      keyType: v.union(
        v.literal("cpf"), 
        v.literal("cnpj"), 
        v.literal("email"), 
        v.literal("phone"), 
        v.literal("random")
      ),
      key: v.string(),
      description: v.optional(v.string()),
      isDefault: v.boolean(),
    }))),
  },
  handler: async (ctx, args) => {


    // Criar a organização
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      description: args.description,
      imageStorageId: args.imageStorageId,
      createdAt: Date.now(),
      createdBy: args.userId,
      responsibleName: args.responsibleName,
      responsibleDocument: args.responsibleDocument,
      pixKeys: args.pixKeys || [],
    });

    // Adicionar o criador como membro proprietário
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    await ctx.db.insert("organizationMembers", {
      organizationId,
      userId: args.userId,
      email: user.email,
      role: "owner",
      status: "active",
      invitedBy: args.userId,
      invitedAt: Date.now(),
      joinedAt: Date.now(),
    });

    return organizationId;
  },
});

// Obter organizações do usuário
export const getUserOrganizations = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {

    // Buscar membros da organização para este usuário
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Buscar detalhes de cada organização
    const organizations = await Promise.all(
      memberships.map(async (membership) => {
        const org = await ctx.db.get(membership.organizationId);
        return {
          ...org,
          role: membership.role,
        };
      })
    );

    return organizations;
  },
});

// Convidar membro para organização
export const inviteMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("staff")),
    userId: v.string()
  },
  handler: async (ctx, args) => {
    

    // Verificar se o usuário tem permissão (owner ou admin)
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .filter((q) => 
        q.eq(q.field("status"), "active")
      )
      .first();

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Sem permissão para convidar membros");
    }

    // Gerar token único
    const inviteToken = Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);

    // Criar convite
    const inviteId = await ctx.db.insert("organizationInvites", {
      organizationId: args.organizationId,
      email: args.email,
      role: args.role,
      invitedBy: args.userId,
      status: "pending",
      inviteToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    return { inviteId, inviteToken };
  },
});

// Aceitar convite
export const acceptInvite = mutation({
  args: {
    inviteToken: v.string(),
    userId: v.string()
  },
  handler: async (ctx, args) => {
    

    // Buscar o convite
    const invite = await ctx.db
      .query("organizationInvites")
      .withIndex("by_token", (q) => q.eq("inviteToken", args.inviteToken))
      .first();

    if (!invite) {
      throw new Error("Convite não encontrado");
    }

    if (invite.status !== "pending") {
      throw new Error("Este convite já foi utilizado ou expirou");
    }

    if (invite.expiresAt < Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("Este convite expirou");
    }

    // Verificar se o email do usuário corresponde ao do convite
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    if (user.email !== invite.email) {
      throw new Error("Este convite não foi enviado para o seu email");
    }

    // Verificar se já é membro
    const existingMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", invite.organizationId).eq("userId", args.userId)
      )
      .first();

    if (existingMembership) {
      // Atualizar papel se necessário
      if (existingMembership.status !== "active" || existingMembership.role !== invite.role) {
        await ctx.db.patch(existingMembership._id, {
          role: invite.role,
          status: "active",
          joinedAt: Date.now(),
        });
      }
    } else {
      // Criar novo membro
      await ctx.db.insert("organizationMembers", {
        organizationId: invite.organizationId,
        userId: args.userId,
        email: user.email,
        role: invite.role,
        status: "active",
        invitedBy: invite.invitedBy,
        invitedAt: invite.createdAt,
        joinedAt: Date.now(),
      });
    }

    // Atualizar status do convite
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: Date.now(),
    });

    return { success: true };
  },
});

// Verificar se o usuário pertence a alguma organização
export const checkUserHasOrganization = query({
  args: {
    userId: v.string()
  },
  handler: async (ctx, args) => {

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    return { hasOrganization: !!membership };
  },
});

// Obter membros de uma organização
export const getOrganizationMembers = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Buscar informações adicionais dos usuários
    const membersWithUserInfo = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", member.userId))
          .first();

        return {
          ...member,
          userName: user?.name || null,
          userImage: null,
        };
      })
    );

    return membersWithUserInfo;
  },
});

// Obter convites pendentes de uma organização
export const getOrganizationPendingInvites = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const invites = await ctx.db
      .query("organizationInvites")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return invites;
  },
});

// Remover membro da organização
export const removeMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    memberId: v.id("organizationMembers"),
    userId: v.string() // ID do usuário que está executando a ação
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário tem permissão (owner ou admin)
    const userMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .filter((q) => 
        q.eq(q.field("status"), "active")
      )
      .first();

    if (!userMembership) {
      throw new Error("Usuário não encontrado na organização");
    }

    // Verificar se tem permissão
    if (userMembership.role !== "owner" && userMembership.role !== "admin") {
      throw new Error("Sem permissão para remover membros");
    }

    // Buscar o membro a ser removido
    const memberToRemove = await ctx.db.get(args.memberId);
    if (!memberToRemove) {
      throw new Error("Membro não encontrado");
    }

    // Não permitir remover o proprietário
    if (memberToRemove.role === "owner") {
      throw new Error("Não é possível remover o proprietário da organização");
    }

    // Admins só podem remover staff
    if (userMembership.role === "admin" && memberToRemove.role === "admin") {
      throw new Error("Administradores não podem remover outros administradores");
    }

    // Delete any pending invites for this member
    const pendingInvites = await ctx.db
      .query("organizationInvites")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "accepted"),
          q.eq(q.field("email"), memberToRemove.email)
        )
      )
      .collect();

    // Delete all found invites
    await Promise.all(
      pendingInvites.map(invite => ctx.db.delete(invite._id))
    );

    // Delete the member
    await ctx.db.delete(args.memberId);

    return { success: true };
  },
});

// Alterar papel de um membro
export const updateMemberRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    memberId: v.id("organizationMembers"),
    newRole: v.union(v.literal("admin"), v.literal("staff")),
    userId: v.string() // ID do usuário que está executando a ação
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário tem permissão (owner ou admin)
    const userMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .filter((q) => 
        q.eq(q.field("status"), "active")
      )
      .first();

    if (!userMembership) {
      throw new Error("Usuário não encontrado na organização");
    }

    // Apenas owner pode promover a admin
    if (args.newRole === "admin" && userMembership.role !== "owner") {
      throw new Error("Apenas o proprietário pode promover membros a administradores");
    }

    // Buscar o membro a ser atualizado
    const memberToUpdate = await ctx.db.get(args.memberId);
    if (!memberToUpdate) {
      throw new Error("Membro não encontrado");
    }

    // Não permitir alterar o papel do proprietário
    if (memberToUpdate.role === "owner") {
      throw new Error("Não é possível alterar o papel do proprietário");
    }

    // Admins só podem gerenciar staff
    if (userMembership.role === "admin" && memberToUpdate.role === "admin") {
      throw new Error("Administradores não podem alterar o papel de outros administradores");
    }

    // Atualizar o papel
    await ctx.db.patch(args.memberId, {
      role: args.newRole
    });

    return { success: true };
  },
});

// Cancelar convite pendente
export const cancelInvite = mutation({
  args: {
    inviteId: v.id("organizationInvites"),
    userId: v.string() // ID do usuário que está executando a ação
  },
  handler: async (ctx, args) => {
    // Buscar o convite
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Convite não encontrado");
    }

    // Verificar se o usuário tem permissão
    const userMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", invite.organizationId).eq("userId", args.userId)
      )
      .filter((q) => 
        q.eq(q.field("status"), "active")
      )
      .first();

    if (!userMembership || (userMembership.role !== "owner" && userMembership.role !== "admin")) {
      throw new Error("Sem permissão para cancelar convites");
    }

    // Atualizar status do convite
    await ctx.db.patch(args.inviteId, {
      status: "rejected"
    });

    return { success: true };
  },
});


// Obter transações da organização
export const getOrganizationTransactions = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário tem permissão para acessar a organização
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!membership) {
      throw new Error("Sem permissão para acessar esta organização");
    }

    // Buscar eventos da organização
    const events = await ctx.db
      .query("events")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const eventIds = events.map(event => event._id);

    // Se não houver eventos, retornar array vazio
    if (eventIds.length === 0) {
      return [];
    }

    // Buscar todas as transações dos eventos da organização
    const transactions = [];
    
    for (const eventId of eventIds) {
      const eventTransactions = await ctx.db
        .query("transactions")
        .filter((q) => q.eq(q.field("eventId"), eventId))
        .collect();
      
      transactions.push(...eventTransactions);
    }

    // Ordenar por data (mais recente primeiro)
    return transactions.sort((a, b) => {
      // Assumindo que há um campo createdAt, caso contrário, precisamos adicionar
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  },
});

// Obter estatísticas financeiras da organização
export const getOrganizationFinancialStats = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário tem permissão para acessar a organização
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!membership) {
      throw new Error("Sem permissão para acessar esta organização");
    }

    // Buscar eventos da organização
    const events = await ctx.db
      .query("events")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const stats = {
      totalEvents: events.length,
      activeEvents: events.filter(e => !e.is_cancelled).length,
      totalEarnings: 0,
      totalTicketsSold: 0,
      monthlyEarnings: {} as Record<string, number>,
      paymentMethodStats: {
        card: {
          count: 0,
          amount: 0,
          pendingAmount: 0,
          availableAmount: 0,
        },
        pix: {
          count: 0,
          amount: 0,
          availableAmount: 0,
        },
      },
    };

    // Calcular ganhos por evento e por método de pagamento
    for (const event of events) {
      // Buscar transações do evento
      const transactions = await ctx.db
        .query("transactions")
        .filter((q) => q.eq(q.field("eventId"), event._id))
        .collect();

      for (const transaction of transactions) {
        if (transaction.status === "paid") {
          stats.totalEarnings += transaction.amount;

          // Agrupar por método de pagamento
          if (transaction.paymentMethod === "credit_card") {
            stats.paymentMethodStats.card.count++;
            stats.paymentMethodStats.card.amount += transaction.amount;

            // Verificar se já passou o período de 14 dias para liberação
            const releaseDate = transaction.createdAt + (14 * 24 * 60 * 60 * 1000); // 14 dias em milissegundos
            if (Date.now() >= releaseDate) {
              stats.paymentMethodStats.card.availableAmount += transaction.amount;
            } else {
              stats.paymentMethodStats.card.pendingAmount += transaction.amount;
            }
          } else if (transaction.paymentMethod === "pix") {
            stats.paymentMethodStats.pix.count++;
            stats.paymentMethodStats.pix.amount += transaction.amount;
            stats.paymentMethodStats.pix.availableAmount += transaction.amount; // PIX é disponível imediatamente
          }

          // Agrupar por mês
          const date = new Date(transaction.createdAt);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          stats.monthlyEarnings[monthKey] = (stats.monthlyEarnings[monthKey] || 0) + transaction.amount;
        }
      }

      // Contar ingressos vendidos
      const tickets = await ctx.db
        .query("tickets")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();

      for (const ticket of tickets) {
        if (ticket.status === "valid" || ticket.status === "used") {
          stats.totalTicketsSold += ticket.quantity;
        }
      }
    }

    return stats;
  },
});

// Obter organização por ID
export const getOrganizationById = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    return organization;
  },
});

// Atualizar organização
export const updateOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    responsibleName: v.string(),
    responsibleDocument: v.string(),
    pixKeys: v.optional(v.array(v.object({
      keyType: v.union(
        v.literal("cpf"), 
        v.literal("cnpj"), 
        v.literal("email"), 
        v.literal("phone"), 
        v.literal("random")
      ),
      key: v.string(),
      description: v.optional(v.string()),
      isDefault: v.boolean(),
    }))),
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário tem permissão (owner ou admin)
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .filter((q) => 
        q.eq(q.field("status"), "active")
      )
      .first();

    if (!membership || membership.role !== "owner") {
      throw new Error("Sem permissão para editar a organização");
    }

    // Atualizar a organização
    await ctx.db.patch(args.organizationId, {
      name: args.name,
      description: args.description,
      imageStorageId: args.imageStorageId,
      responsibleName: args.responsibleName,
      responsibleDocument: args.responsibleDocument,
      pixKeys: args.pixKeys || [],
    });

    return { success: true };
  },
});

// Solicitar saque para organização
export const requestWithdrawal = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
    amount: v.number(),
    pixKeyIndex: v.number(),
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário tem permissão (owner ou admin)
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .filter((q) => 
        q.eq(q.field("status"), "active")
      )
      .first();

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Sem permissão para solicitar saques");
    }

    // Buscar a organização
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organização não encontrada");
    }

    // Verificar se a organização tem chaves PIX cadastradas
    if (!organization.pixKeys || organization.pixKeys.length === 0) {
      throw new Error("A organização não possui chaves PIX cadastradas");
    }

    // Verificar se o índice da chave PIX é válido
    if (args.pixKeyIndex < 0 || args.pixKeyIndex >= organization.pixKeys.length) {
      throw new Error("Chave PIX inválida");
    }

    const selectedPixKey = organization.pixKeys[args.pixKeyIndex];

    // Verificar se o valor é válido
    if (args.amount < 90) { // Mínimo R$ 90,00
      throw new Error("Valor mínimo para saque é R$ 90,00");
    }

    // Calcular saldo disponível
    const stats = await ctx.db
      .query("transactions")
      .filter((q) => {
        // Buscar transações pagas de eventos da organização
        return q.eq(q.field("status"), "paid");
      })
      .collect();

    // Filtrar apenas transações de eventos da organização
    const orgEvents = await ctx.db
      .query("events")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    
    const orgEventIds = new Set(orgEvents.map(event => event._id));
    
    // Filtrar transações apenas dos eventos da organização
    const orgTransactions = stats.filter(tx => {
      return orgEventIds.has(tx.eventId);
    });

    // Calcular valores disponíveis
    let availableBalance = 0;

    for (const tx of orgTransactions) {
      if (tx.paymentMethod === "pix") {
        // PIX disponível imediatamente
        availableBalance += tx.amount;
      } else if (tx.paymentMethod === "credit_card") {
        // Cartão disponível após 14 dias
        const releaseDate = tx.createdAt + (14 * 24 * 60 * 60 * 1000);
        if (Date.now() >= releaseDate) {
          availableBalance += tx.amount;
        }
      }
    }

    // Buscar saques anteriores
    const previousWithdrawals = await ctx.db
      .query("organizationWithdrawals")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const totalWithdrawn = previousWithdrawals
      .filter(w => w.status === "completed" || w.status === "processing")
      .reduce((sum, w) => sum + w.amount, 0);

    // Calcular saldo final disponível
    const finalAvailableBalance = availableBalance - totalWithdrawn;
    
    if (args.amount > finalAvailableBalance) {
      throw new Error("Saldo insuficiente para este saque");
    }

    // Criar solicitação de saque
    const withdrawalId = await ctx.db.insert("organizationWithdrawals", {
      organizationId: args.organizationId,
      userId: args.userId,
      amount: args.amount,
      status: "pending",
      pixKey: {
        keyType: selectedPixKey.keyType,
        key: selectedPixKey.key,
        description: selectedPixKey.description,
      },
      requestedAt: Date.now(),
    });

    return { withdrawalId };
  },
});

// Buscar histórico de saques da organização
export const getOrganizationWithdrawals = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário tem permissão para acessar a organização
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!membership) {
      throw new Error("Sem permissão para acessar esta organização");
    }

    const withdrawals = await ctx.db
      .query("organizationWithdrawals")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();

    return withdrawals;
  },
});

// Obter estatísticas demográficas dos compradores de ingressos da organização
export const getOrganizationDemographicStats = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário tem permissão para acessar a organização
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_user", (q) => 
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!membership) {
      throw new Error("Sem permissão para acessar esta organização");
    }

    // Buscar eventos da organização
    const events = await ctx.db
      .query("events")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Inicializar estatísticas
    const stats = {
      // Estatísticas por gênero
      genderStats: {
        male: 0,
        female: 0,
        other: 0,
        prefer_not_to_say: 0,
        not_informed: 0,
      },
      // Estatísticas por faixa etária
      ageStats: {
        under18: 0,
        age18to24: 0,
        age25to34: 0,
        age35to44: 0,
        age45to54: 0,
        age55plus: 0,
        not_informed: 0,
      },
      // Total de compradores únicos
      uniqueBuyers: 0,
      // Compradores com perfil completo
      buyersWithCompleteProfile: 0,
    };

    // Conjunto para rastrear compradores únicos
    const uniqueBuyerIds = new Set();
    const buyersWithCompleteProfileIds = new Set();

    // Para cada evento, buscar os tickets e os compradores
    for (const event of events) {
      // Buscar tickets válidos do evento
      const tickets = await ctx.db
        .query("tickets")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .filter((q) => q.or(
          q.eq(q.field("status"), "valid"),
          q.eq(q.field("status"), "used")
        ))
        .collect();

      // Para cada ticket, buscar informações do comprador
      for (const ticket of tickets) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", ticket.userId))
          .first();

        if (user) {
          // Adicionar ao conjunto de compradores únicos
          uniqueBuyerIds.add(user.userId);

          // Verificar se o perfil está completo
          if (user.profileComplete) {
            buyersWithCompleteProfileIds.add(user.userId);
          }

          // Contabilizar por gênero
          if (user.gender) {
            if (user.gender && user.gender in stats.genderStats) {
              if (user.gender === 'male' || user.gender === 'female' || 
                  user.gender === 'other' || user.gender === 'prefer_not_to_say') {
                stats.genderStats[user.gender]++;
              } else {
                stats.genderStats.not_informed++;
              }
            } else {
              stats.genderStats.not_informed++;
            }
          } else {
            stats.genderStats.not_informed++;
          }

          // Contabilizar por faixa etária
          if (user.birthDate) {
            const birthDate = new Date(user.birthDate);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            
            // Ajustar se o aniversário ainda não ocorreu este ano
            const monthDiff = today.getMonth() - birthDate.getMonth();
            const dayDiff = today.getDate() - birthDate.getDate();
            const adjustedAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

            // Classificar por faixa etária
            if (adjustedAge < 18) {
              stats.ageStats.under18++;
            } else if (adjustedAge >= 18 && adjustedAge <= 24) {
              stats.ageStats.age18to24++;
            } else if (adjustedAge >= 25 && adjustedAge <= 34) {
              stats.ageStats.age25to34++;
            } else if (adjustedAge >= 35 && adjustedAge <= 44) {
              stats.ageStats.age35to44++;
            } else if (adjustedAge >= 45 && adjustedAge <= 54) {
              stats.ageStats.age45to54++;
            } else if (adjustedAge >= 55) {
              stats.ageStats.age55plus++;
            }
          } else {
            stats.ageStats.not_informed++;
          }
        }
      }
    }

    // Atualizar contagens totais
    stats.uniqueBuyers = uniqueBuyerIds.size;
    stats.buyersWithCompleteProfile = buyersWithCompleteProfileIds.size;

    return stats;
  },
});