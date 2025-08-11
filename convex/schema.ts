import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Modificar a tabela de eventos
  events: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    location: v.string(),
    latitude: v.optional(v.float64()),
    longitude: v.optional(v.float64()),
    placeId: v.optional(v.string()),
    eventStartDate: v.number(),
    eventEndDate: v.number(),
    salesDeadline: v.optional(v.number()),
    userId: v.string(),
    organizationId: v.optional(v.id("organizations")), // ID da organização (opcional para compatibilidade)
    imageStorageId: v.optional(v.id("_storage")),
    is_cancelled: v.optional(v.boolean()),
    customSections: v.optional(v.array(v.object({
      type: v.string(), // "spotify", "lineup", "faq", "terms", etc.
      title: v.optional(v.string()),
      content: v.any(), // Conteúdo específico para cada tipo de seção
      order: v.number(), // Ordem de exibição
      isActive: v.boolean(),
    }))),
  })
    .index("by_slug", ["slug"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_events", {
      searchField: "name",
      filterFields: ["description", "location"]
    }),

  ticketTypes: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    description: v.optional(v.string()),
    totalQuantity: v.number(),
    availableQuantity: v.number(),
    currentPrice: v.number(),
    isActive: v.boolean(),
    sortOrder: v.number(),
    isCourtesy: v.boolean(),
  })
    .index("by_event", ["eventId"])
    .index("by_event_active", ["eventId", "isActive"]),

  pricingBatches: defineTable({
    ticketTypeId: v.id("ticketTypes"),
    batchNumber: v.number(),
    price: v.number(),
    quantity: v.number(),
    soldQuantity: v.number(),
    isActive: v.boolean(),
  })
    .index("by_ticket_type", ["ticketTypeId"])
    .index("by_ticket_type_active", ["ticketTypeId", "isActive"]),

  // Modificar a tabela promoters
  promoters: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    code: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    totalSales: v.optional(v.number()),
    totalRevenue: v.optional(v.number()),
    hasCoupon: v.optional(v.boolean()), // Se este promoter tem cupom associado
    couponCode: v.optional(v.string()), // Código do cupom associado
    // Novos campos para equipes
    teamId: v.optional(v.id("promoterTeams")), // ID da equipe a que pertence
    isCoordinator: v.optional(v.boolean()), // Se é coordenador de uma equipe
  })
    .index("by_event", ["eventId"])
    .index("by_event_code", ["eventId", "code"])
    // Novo índice para equipes
    .index("by_team", ["teamId"]),

  // Nova tabela para equipes de promotores
  promoterTeams: defineTable({
    eventId: v.id("events"),
    name: v.string(), // Nome da equipe
    description: v.optional(v.string()), // Descrição da equipe
    coordinatorId: v.optional(v.id("promoters")), // ID do promoter que é coordenador (opcional)
    createdAt: v.number(),
    createdBy: v.string(), // ID do usuário que criou
    isActive: v.boolean(),
  })
    .index("by_event", ["eventId"])
    .index("by_coordinator", ["coordinatorId"]),

  // NOVA TABELA: Cupons de desconto
  coupons: defineTable({
    eventId: v.id("events"),
    code: v.string(), // "DESCONTO10", "PROMO20"
    name: v.string(),
    discountType: v.union(v.literal("percentage"), v.literal("fixed"), v.literal("custom")),
    discountValue: v.number(), // 10 (para 10%) ou 50 (para R$ 50)
    maxUses: v.optional(v.number()), // Limite de usos
    currentUses: v.number(), // Usos atuais
    validFrom: v.number(),
    validUntil: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
    // Restrições opcionais
    minPurchaseAmount: v.optional(v.number()),
    applicableTicketTypes: v.optional(v.array(v.id("ticketTypes"))),
    // Campos para regras personalizadas
    promotionType: v.optional(v.union(
      v.literal("standard"),      // Cupom padrão
      v.literal("buyXgetY"),     // Compre X leve Y
      v.literal("minQuantity"),  // Desconto por quantidade mínima
      v.literal("bundle")        // Pacote com preço especial
    )),
    promotionRules: v.optional(v.object({
      minQuantity: v.optional(v.number()),       // Quantidade mínima de ingressos
      targetQuantity: v.optional(v.number()),   // Quantidade alvo (ex: compre 3 leve 4)
      sameTicketType: v.optional(v.boolean()),  // Se precisa ser do mesmo tipo
      discountedItems: v.optional(v.number()),  // Número de itens com desconto
      discountPercentage: v.optional(v.number()) // Porcentagem de desconto para os itens
    })),
  })
    .index("by_event", ["eventId"])
    .index("by_code", ["code"])
    .index("by_event_code", ["eventId", "code"]),

  tickets: defineTable({
    eventId: v.id("events"),
    ticketTypeId: v.id("ticketTypes"),
    pricingBatchId: v.optional(v.id("pricingBatches")),
    userId: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    totalAmount: v.number(),
    purchasedAt: v.number(),
    status: v.union(v.literal("valid"), v.literal("used"), v.literal("refunded"), v.literal("cancelled")),
    stripeSessionId: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    promoterCode: v.optional(v.string()),
    couponCode: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
    originalAmount: v.optional(v.number()),
    paymentIntentId: v.optional(v.string()),
  })
    .index("by_event", ["eventId"])
    .index("by_user", ["userId"])
    .index("by_user_event", ["userId", "eventId"])
    .index("by_ticket_type", ["ticketTypeId"])
    .index("by_payment_intent", ["paymentIntentId"])
    .index("by_transaction", ["transactionId"])
    .index("by_coupon", ["couponCode"])
    .index("by_promoter", ["promoterCode"]),

  // Tabela para armazenar todas as transações de pagamento
  // Atualizar a definição da tabela de transações
  transactions: defineTable({
    transactionId: v.string(), // ID da FreePay
    eventId: v.id("events"),
    userId: v.string(),
    customerId: v.string(), // ID do cliente na FreePay
    amount: v.number(), // Valor em centavos
    status: v.string(), // 'pending', 'paid', 'failed', 'refunded'
    paymentMethod: v.string(), // 'PIX', 'CARD'
    metadata: v.any(), // Para armazenar os metadados enviados
    createdAt: v.number(), // Adicionar timestamp de criação
  })
    .index("by_transactionId", ["transactionId"]),

  users: defineTable({
    name: v.string(),
    email: v.string(),
    userId: v.string(),
    phone: v.optional(v.string()),
    cpf: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    gender: v.optional(v.string()),
    profileComplete: v.optional(v.boolean()),
    sellerOnboarded: v.optional(v.boolean()), // true se já preencheu os dados
  })
    .index("by_user_id", ["userId"])
    .index("by_email", ["email"])
    .searchIndex("search_users", {
      searchField: "name",
      filterFields: ["email"]
    }),

  // Nova tabela para controle de saques
  withdrawals: defineTable({
    userId: v.string(),
    amount: v.number(), // Valor em centavos
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    bankInfo: v.object({
      bank: v.string(),
      agency: v.string(),
      account: v.string(),
      accountType: v.string(),
      accountHolder: v.string(),
      accountHolderCpfCnpj: v.string(),
    }),
    requestedAt: v.number(),
    processedAt: v.optional(v.number()),
    failureReason: v.optional(v.string()),
    transactionId: v.optional(v.string()), // ID da transação bancária
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_requested_at", ["requestedAt"]),

  transferRequests: defineTable({
    ticketId: v.id("tickets"),
    fromUserId: v.string(),
    toUserEmail: v.string(),
    toUserId: v.optional(v.string()), // Preenchido quando aceito
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("cancelled"),
      v.literal("expired")
    ),
    transferToken: v.string(), // Token único para o link
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  })
    .index("by_ticket", ["ticketId"])
    .index("by_from_user", ["fromUserId"])
    .index("by_to_email", ["toUserEmail"])
    .index("by_token", ["transferToken"])
    .index("by_status", ["status"]),

  transferHistory: defineTable({
    ticketId: v.id("tickets"),
    fromUserId: v.string(),
    toUserId: v.string(),
    transferredAt: v.number(),
    transferRequestId: v.id("transferRequests"),
  })
    .index("by_ticket", ["ticketId"])
    .index("by_from_user", ["fromUserId"])
    .index("by_to_user", ["toUserId"]),

  pendingEmails: defineTable({
    transactionId: v.string(),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    eventId: v.id("events"),
    ticketSelections: v.any(),
    qrCodeText: v.string(),
    pixExpiresAt: v.string(),
    scheduledFor: v.number(), // timestamp em ms
    status: v.string(), // 'pending', 'sent', 'cancelled'
    createdAt: v.number(),
  })
    .index("by_transactionId", ["transactionId"])
    .index("by_scheduledFor", ["scheduledFor"])
    .index("by_status", ["status"]),
  // Nova tabela para validadores de ingressos
  ticketValidators: defineTable({
    eventId: v.id("events"),
    userId: v.optional(v.string()), // ID do usuário convidado (preenchido quando aceito)
    email: v.string(), // Email do usuário convidado
    invitedBy: v.string(), // ID do usuário que convidou
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
    inviteToken: v.string(), // Token único para o link de convite
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_event", ["eventId"])
    .index("by_email", ["email"])
    .index("by_user", ["userId"])
    .index("by_event_user", ["eventId", "userId"])
    .index("by_token", ["inviteToken"]),





  // Tabela de Organizações
  organizations: defineTable({
    name: v.string(), // Nome da organização
    description: v.optional(v.string()), // Descrição/sobre opcional
    imageStorageId: v.optional(v.id("_storage")), // Logo da organização
    createdAt: v.number(), // Data de criação
    createdBy: v.string(), // ID do usuário que criou
    pixKeys: v.optional(v.array(v.object({ // Chaves PIX
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
    responsibleName: v.string(), // Nome do responsável
    responsibleDocument: v.string(), // CPF/CNPJ do responsável
  })
    .index("by_created_by", ["createdBy"]),

  // Tabela de Membros da Organização
  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(), // ID do usuário
    email: v.string(), // Email do usuário
    role: v.union(
      v.literal("owner"), // Proprietário (criador)
      v.literal("admin"), // Administrador
      v.literal("staff") // Equipe
    ),
    status: v.union(
      v.literal("active"),
      v.literal("pending"),
      v.literal("removed")
    ),
    invitedBy: v.string(), // ID do usuário que convidou
    invitedAt: v.number(),
    joinedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_email", ["email"])
    .index("by_organization_user", ["organizationId", "userId"])
    .index("by_organization_email", ["organizationId", "email"]),

  // Tabela de Convites para Organização
  organizationInvites: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(), // Email do convidado
    role: v.union(
      v.literal("admin"),
      v.literal("staff")
    ),
    invitedBy: v.string(), // ID do usuário que convidou
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired")
    ),
    inviteToken: v.string(), // Token único para o link de convite
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_email", ["email"])
    .index("by_token", ["inviteToken"]),

  // Nova tabela para controle de saques de organizações
  organizationWithdrawals: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(), // ID do usuário que solicitou o saque
    amount: v.number(), // Valor em centavos
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    pixKey: v.object({
      keyType: v.union(
        v.literal("cpf"),
        v.literal("cnpj"),
        v.literal("email"),
        v.literal("phone"),
        v.literal("random")
      ),
      key: v.string(),
      description: v.optional(v.string()),
    }),
    requestedAt: v.number(),
    processedAt: v.optional(v.number()),
    failureReason: v.optional(v.string()),
    transactionId: v.optional(v.string()), // ID da transação bancária
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_requested_at", ["requestedAt"]),


  // Tabela de Administradores da Plataforma
  platformAdmins: defineTable({
    userId: v.string(), // ID do usuário
    email: v.string(), // Email do usuário
    role: v.union(
      v.literal("superadmin"), // Admin master com todos os poderes
      v.literal("admin"), // Admin com poderes limitados
      v.literal("support"), // Suporte com acesso somente leitura
      v.literal("finance") // Acesso a dados financeiros
    ),
    permissions: v.array(v.string()), // Array de permissões específicas
    createdAt: v.number(),
    createdBy: v.optional(v.string()), // ID do admin que concedeu acesso (null para o primeiro superadmin)
    lastLogin: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_user_id", ["userId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // Tabela de Logs de Atividades de Admin
  adminActivityLogs: defineTable({
    adminId: v.string(), // ID do usuário admin
    action: v.string(), // Ação realizada (ex: "create_admin", "update_event", etc)
    targetType: v.string(), // Tipo do alvo (ex: "user", "event", "organization")
    targetId: v.optional(v.string()), // ID do alvo (opcional)
    details: v.optional(v.any()), // Detalhes adicionais da ação
    timestamp: v.number(),
    ipAddress: v.optional(v.string()),
  })
    .index("by_admin", ["adminId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_action", ["action"]),



  customers: defineTable({
    userId: v.string(), // ID do usuário no sistema
    email: v.string(), // Email do usuário
    customerId: v.string(), // ID do cliente no Mercado Pago
    createdAt: v.number(), // Data de criação
    updatedAt: v.optional(v.number()), // Data de atualização
  })
    .index("by_user_id", ["userId"])
    .index("by_email", ["email"])
    .index("by_customer_id", ["customerId"]),

  // Tabela de Listas de Eventos
  eventLists: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(), // userId do criador
    publicUrl: v.string(), // URL amigável para acesso público
    maxSubscriptions: v.optional(v.number()), // Limite de inscrições (opcional)
    currentSubscriptions: v.number(), // Contador de inscrições atuais
    listType: v.string(), // "public" (usuários se inscrevem) ou "private" (apenas admin adiciona)
    validationUrl: v.optional(v.string()), // URL para validação/check-in
  })
    .index("by_event", ["eventId"])
    .index("by_public_url", ["publicUrl"])
    .index("by_validation_url", ["validationUrl"]),

  // Tabela de Inscrições nas Listas
  listSubscriptions: defineTable({
    listId: v.id("eventLists"),
    userId: v.string(),
    eventId: v.id("events"),
    subscribedAt: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("cancelled")
    ),
    addedBy: v.optional(v.string()), // ID do admin que adicionou (para listas privadas)
    checkedIn: v.boolean(), // Status de check-in
    checkedInAt: v.optional(v.number()), // Timestamp do check-in
    checkedInBy: v.optional(v.string()), // ID do validador que fez o check-in
  })
    .index("by_list", ["listId"])
    .index("by_user_list", ["userId", "listId"])
    .index("by_event_user", ["eventId", "userId"]),
    
  // Nova tabela para validadores de listas
  listValidators: defineTable({
    listId: v.id("eventLists"),
    userId: v.string(), // ID do validador
    email: v.string(), // Email do validador
    invitedBy: v.string(), // ID de quem convidou
    invitedAt: v.number(), // Timestamp do convite
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
  })
    .index("by_list", ["listId"])
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),
});
