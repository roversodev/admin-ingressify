import { query, mutation } from "./_generated/server";
import { GenericId, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { GenericMutationCtx } from "convex/server";

export type Metrics = {
  soldTickets: number;
  refundedTickets: number;
  cancelledTickets: number;
  revenue: number;
  refundedAmount: number; // Novo campo
  grossRevenue: number; // Receita bruta (sem descontos)
  totalDiscounts: number; // Total de descontos aplicados
  totalTickets: number;
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("is_cancelled"), undefined))
      .collect();
    
    // Adicionar o menor preço para cada evento
    const eventsWithLowestPrice = await Promise.all(
      events.map(async (event) => {
        // Buscar tipos de ingressos ativos para o evento
        const ticketTypes = await ctx.db
          .query("ticketTypes")
          .withIndex("by_event_active", (q) => 
            q.eq("eventId", event._id).eq("isActive", true)
          )
          .collect();
        
        // Encontrar o menor preço entre os tipos de ingressos pagos (não cortesia)
        const paidTicketTypes = ticketTypes.filter(type => !type.isCourtesy && type.currentPrice > 0);
        const lowestPrice = paidTicketTypes.length > 0
          ? Math.min(...paidTicketTypes.map(type => type.currentPrice))
          : 0;
        
        // Retornar o evento com o menor preço
        return {
          ...event,
          lowestPrice
        };
      })
    );
    
    return eventsWithLowestPrice;
  },
});

export const getById = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) return null;

    // Buscar todos os tickets do evento
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    // Buscar tipos de ingressos para calcular total
    const ticketTypes = await ctx.db
      .query("ticketTypes")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    const totalTickets = ticketTypes.reduce((sum, type) => sum + type.totalQuantity, 0);

    const validTickets = tickets.filter(
      (t) => t.status === "valid" || t.status === "used"
    );
    const refundedTickets = tickets.filter((t) => t.status === "refunded");
    const cancelledTickets = tickets.filter(
      (t) => t.status === "cancelled"
    );

    // Encontrar o menor preço entre os tipos de ingressos pagos (não cortesia)
    const paidTicketTypes = ticketTypes.filter(type => 
      type.isActive && !type.isCourtesy && type.currentPrice > 0
    );
    const lowestPrice = paidTicketTypes.length > 0
      ? Math.min(...paidTicketTypes.map(type => type.currentPrice))
      : 0;

    const metrics: Metrics = {
      soldTickets: validTickets.reduce((sum, ticket) => sum + ticket.quantity, 0),
      refundedTickets: refundedTickets.reduce((sum, ticket) => sum + ticket.quantity, 0),
      cancelledTickets: cancelledTickets.reduce((sum, ticket) => sum + ticket.quantity, 0),
      // Receita líquida (valor real pago com descontos aplicados)
      revenue: validTickets.reduce((total, ticket) => total + ticket.totalAmount, 0),
      // Receita bruta (valor original sem descontos)
      grossRevenue: validTickets.reduce((total, ticket) => total + (ticket.originalAmount || ticket.totalAmount), 0),
      // Total de descontos aplicados
      totalDiscounts: validTickets.reduce((total, ticket) => total + (ticket.discountAmount || 0), 0),
      refundedAmount: refundedTickets.reduce((total, ticket) => total + ticket.totalAmount, 0),
      totalTickets: totalTickets,
    };

    return {
      ...event,
      totalTickets,
      metrics,
      lowestPrice,
    };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", q => q.eq("slug", slug))
      .first();
    
    if (!event) return null;

    // Esta parte é opcional, mas unifica a lógica com getById
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect();

    const ticketTypes = await ctx.db
      .query("ticketTypes")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect();

    const totalTickets = ticketTypes.reduce((sum, type) => sum + type.totalQuantity, 0);

    return {
      ...event,
      totalTickets,
    };
  },
});

// Comprar ingresso
// Função atualizada para compra múltipla
export const purchaseMultipleTickets = mutation({
  args: {
    eventId: v.id("events"),
    ticketTypeId: v.id("ticketTypes"),
    userId: v.string(),
    quantity: v.number(),
    paymentInfo: v.object({
      paymentIntentId: v.string(),
      totalAmount: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Validações...

    // Encontrar lote ativo com preço atual
    const activeBatch = await ctx.db
      .query("pricingBatches")
      .withIndex("by_ticket_type_active", (q) =>
        q.eq("ticketTypeId", args.ticketTypeId).eq("isActive", true)
      )
      .filter((q) => q.lt(q.field("soldQuantity"), q.field("quantity")))
      .order("asc")
      .first();

    if (!activeBatch) {
      throw new Error("Nenhum lote disponível");
    }

    // Verificar disponibilidade
    const availableInBatch = activeBatch.quantity - activeBatch.soldQuantity;
    if (availableInBatch < args.quantity) {
      throw new Error(`Apenas ${availableInBatch} ingressos disponíveis neste lote`);
    }

    // Criar ticket
    const ticketId = await ctx.db.insert("tickets", {
      eventId: args.eventId,
      ticketTypeId: args.ticketTypeId,
      userId: args.userId,
      quantity: args.quantity,
      unitPrice: activeBatch.price,
      totalAmount: args.paymentInfo.totalAmount,
      purchasedAt: Date.now(),
      status: "valid",
      paymentIntentId: args.paymentInfo.paymentIntentId,
    });

    // Atualizar quantidade vendida no lote
    await ctx.db.patch(activeBatch._id, {
      soldQuantity: activeBatch.soldQuantity + args.quantity,
    });

    return ticketId;
  },
});

// Obter ingressos do usuário com informações do evento
export const getUserTickets = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const ticketsWithEvents = await Promise.all(
      tickets.map(async (ticket) => {
        const event = await ctx.db.get(ticket.eventId);
        return {
          ...ticket,
          event,
        };
      })
    );

    return ticketsWithEvents;
  },
});

// Função simplificada para compra direta
export const purchaseTicketsDirect = mutation({
  args: {
    eventId: v.id("events"),
    ticketTypeId: v.id("ticketTypes"),
    userId: v.string(),
    quantity: v.number(),
    paymentInfo: v.object({
      paymentIntentId: v.string(),
      totalAmount: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Verificar se evento existe e está ativo
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Evento não encontrado");
    if (event.is_cancelled) throw new Error("Evento cancelado");

    // Verificar tipo de ingresso
    const ticketType = await ctx.db.get(args.ticketTypeId);
    if (!ticketType) throw new Error("Tipo de ingresso não encontrado");
    if (!ticketType.isActive) throw new Error("Tipo de ingresso não disponível");

    // Verificar disponibilidade
    if (ticketType.availableQuantity < args.quantity) {
      throw new Error(`Apenas ${ticketType.availableQuantity} ingressos disponíveis`);
    }

    // Calcular preço
    const unitPrice = ticketType.currentPrice;
    const expectedTotal = unitPrice * args.quantity;

    if (Math.abs(expectedTotal - args.paymentInfo.totalAmount) > 1) {
      throw new Error("Valor do pagamento não confere");
    }

    // Criar ticket
    const ticketId = await ctx.db.insert("tickets", {
      eventId: args.eventId,
      ticketTypeId: args.ticketTypeId,
      userId: args.userId,
      quantity: args.quantity,
      unitPrice,
      totalAmount: args.paymentInfo.totalAmount,
      purchasedAt: Date.now(),
      status: "valid",
      paymentIntentId: args.paymentInfo.paymentIntentId,
    });

    // Atualizar disponibilidade
    await ctx.db.patch(args.ticketTypeId, {
      availableQuantity: ticketType.availableQuantity - args.quantity,
    });

    return { ticketId, success: true };
  },
});

// Função para obter disponibilidade de um evento
export const getEventAvailability = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const ticketTypes = await ctx.db
      .query("ticketTypes")
      .withIndex("by_event_active", (q) =>
        q.eq("eventId", eventId).eq("isActive", true)
      )
      .collect();

    // Get all tickets for this event
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    // Count validated tickets (status = "used")
    const validatedTickets = tickets.filter(t => t.status === "used")
      .reduce((sum, ticket) => sum + ticket.quantity, 0);

    // Count purchased tickets (status = "valid" or "used")
    const purchasedTickets = tickets.filter(t => t.status === "valid" || t.status === "used")
      .reduce((sum, ticket) => sum + ticket.quantity, 0);

    const totalAvailable = ticketTypes.reduce((sum, type) => sum + type.availableQuantity, 0);
    const totalCapacity = ticketTypes.reduce((sum, type) => sum + type.totalQuantity, 0);
    const totalTickets = ticketTypes.reduce((sum, type) => sum + type.totalQuantity, 0);

    // Find lowest price among active ticket types (excluding courtesy tickets)
    const paidTicketTypes = ticketTypes.filter(type => !type.isCourtesy && type.currentPrice > 0);
    const lowestPrice = paidTicketTypes.length > 0
      ? Math.min(...paidTicketTypes.map(type => type.currentPrice))
      : 0;

    return {
      isSoldOut: totalAvailable === 0,
      totalAvailable,
      totalCapacity,
      totalTickets,
      lowestPrice,
      validatedTickets,
      purchasedTickets,
      ticketTypes: ticketTypes.map(type => ({
        id: type._id,
        name: type.name,
        price: type.currentPrice,
        available: type.availableQuantity,
        total: type.totalQuantity,
      })),
    };
  },
});

export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, { searchTerm }) => {
    const events = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("is_cancelled"), undefined))
      .collect();

    return events.filter((event) => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        event.name.toLowerCase().includes(searchTermLower) ||
        event.description.toLowerCase().includes(searchTermLower) ||
        event.location.toLowerCase().includes(searchTermLower)
      );
    });
  },
});

export const getSellerEvents = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const events = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    const eventsWithMetrics = await Promise.all(
      events.map(async (event) => {
        const tickets = await ctx.db
          .query("tickets")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect();

        // Buscar tipos de ingressos para calcular total
        const ticketTypes = await ctx.db
          .query("ticketTypes")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect();

        const totalTickets = ticketTypes.reduce((sum, type) => sum + type.totalQuantity, 0);

        const validTickets = tickets.filter(
          (t) => t.status === "valid" || t.status === "used"
        );
        const refundedTickets = tickets.filter((t) => t.status === "refunded");
        const cancelledTickets = tickets.filter(
          (t) => t.status === "cancelled"
        );

        // Na função getSellerEvents, dentro do cálculo de metrics:
        const metrics: Metrics = {
          soldTickets: validTickets.reduce((sum, ticket) => sum + ticket.quantity, 0),
          refundedTickets: refundedTickets.reduce((sum, ticket) => sum + ticket.quantity, 0),
          cancelledTickets: cancelledTickets.reduce((sum, ticket) => sum + ticket.quantity, 0),
          // Receita líquida (valor real pago com descontos aplicados)
          revenue: validTickets.reduce((total, ticket) => total + ticket.totalAmount, 0),
          // Receita bruta (valor original sem descontos)
          grossRevenue: validTickets.reduce((total, ticket) => total + (ticket.originalAmount || ticket.totalAmount), 0),
          // Total de descontos aplicados
          totalDiscounts: validTickets.reduce((total, ticket) => total + (ticket.discountAmount || 0), 0),
          refundedAmount: refundedTickets.reduce((total, ticket) => total + ticket.totalAmount, 0),
          totalTickets: totalTickets,
        };

        return {
          ...event,
          totalTickets,
          metrics,
        };
      })
    );

    return eventsWithMetrics;
  },
});

// Função para gerar um slug único
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]+/g, "-")     // Substitui caracteres não alfanuméricos por hífen
    .replace(/^-+|-+$/g, "")         // Remove hífens do início e do fim
    .replace(/--+/g, "-");           // Evita múltiplos hífens consecutivos
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    location: v.string(),
    latitude: v.optional(v.float64()),
    longitude: v.optional(v.float64()),
    placeId: v.optional(v.string()),
    eventStartDate: v.number(),
    eventEndDate: v.number(),
    userId: v.string(),
    organizationId: v.id("organizations"),
    customSections: v.optional(v.array(v.object({
      type: v.string(),
      title: v.optional(v.string()),
      content: v.any(),
      order: v.number(),
      isActive: v.boolean(),
    }))),
  },
  handler: async (ctx, args) => {
    const slug = generateSlug(args.name);

    const eventId = await ctx.db.insert("events", {
      ...args,
      slug, // Salva o slug gerado
      customSections: args.customSections || [],
      organizationId: args.organizationId ?? '',
    });

    return { _id: eventId, slug };
  },
});

export const updateEvent = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.string(),
    location: v.string(),
    latitude: v.optional(v.float64()),
    longitude: v.optional(v.float64()),
    placeId: v.optional(v.string()),
    eventStartDate: v.number(),
    eventEndDate: v.number(),
    customSections: v.optional(v.array(v.object({
      type: v.string(),
      title: v.optional(v.string()),
      content: v.any(),
      order: v.number(),
      isActive: v.boolean(),
    }))),
  },
  handler: async (ctx, { eventId, ...rest }) => {
    // Se o nome mudou, gera um novo slug. Se um slug foi passado, usa ele.
    const slug = rest.slug ? rest.slug : generateSlug(rest.name);

    await ctx.db.patch(eventId, {
      ...rest,
      slug,
      ...(rest.customSections !== undefined && { customSections: rest.customSections }),
    });
  },
});

export const cancelEvent = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Evento não encontrado");

    // Verificar apenas ingressos PAGOS ativos (ignorar cortesias)
    const paidTickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .filter((q) =>
        q.and(
          q.or(q.eq(q.field("status"), "valid"), q.eq(q.field("status"), "used")),
          q.gt(q.field("totalAmount"), 0) // Ignorar ingressos cortesia
        )
      )
      .collect();

    if (paidTickets.length > 0) {
      throw new Error(
        "Não é possível cancelar evento com ingressos pagos ativos. Por favor, reembolse todos os ingressos pagos primeiro."
      );
    }

    // Cancelar automaticamente todos os ingressos cortesia
    const courtesyTickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .filter((q) =>
        q.and(
          q.or(q.eq(q.field("status"), "valid"), q.eq(q.field("status"), "used")),
          q.eq(q.field("totalAmount"), 0) // Apenas ingressos cortesia
        )
      )
      .collect();

    // Atualizar status de todos os ingressos cortesia para "cancelled"
    for (const ticket of courtesyTickets) {
      await ctx.db.patch(ticket._id, { status: "cancelled" });
    }

    // Cancelar o evento
    await ctx.db.patch(eventId, {
      is_cancelled: true,
    });

    return { success: true };
  },
});

// Na mutation purchaseTickets, adicionar os parâmetros:
export const purchaseTickets = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
    ticketSelections: v.array(v.object({
      ticketTypeId: v.id("ticketTypes"),
      quantity: v.number(),
    })),
    stripeSessionId: v.string(),
    paymentIntentId: v.string(),
    promoterCode: v.optional(v.string()),
    couponCode: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Evento não encontrado");
    }

    // Parse ticket selections
    const selections: Array<{ ticketTypeId: Id<"ticketTypes">, quantity: number }> =
      typeof args.ticketSelections === 'string'
        ? JSON.parse(args.ticketSelections)
        : args.ticketSelections;

    const createdTickets = [];

    // Verificar se o promoter existe (se fornecido)
    let promoter = null;
    if (args.promoterCode) {
      promoter = await ctx.db
        .query("promoters")
        .withIndex("by_event_code", (q) =>
          q.eq("eventId", args.eventId).eq("code", args.promoterCode!)
        )
        .first();

      if (!promoter) {
        console.warn(`Promoter code ${args.promoterCode} not found or inactive`);
      }
    }

    for (const selection of selections) {
      const ticketType = await ctx.db.get(selection.ticketTypeId);
      if (!ticketType) {
        throw new Error(`Tipo de ingresso não encontrado: ${selection.ticketTypeId}`);
      }

      // Check availability
      if (selection.quantity > ticketType.availableQuantity) {
        throw new Error(`Quantidade solicitada (${selection.quantity}) excede disponibilidade (${ticketType.availableQuantity}) para ${ticketType.name}`);
      }

      // Create tickets - INCLUIR INFORMAÇÕES DO CUPOM AQUI
      for (let i = 0; i < selection.quantity; i++) {
        // Calcular o valor real pago por ingresso considerando desconto
        const totalTicketsInPurchase = selections.reduce((sum, sel) => sum + sel.quantity, 0);
        const discountPerTicket = args.discountAmount ? args.discountAmount / totalTicketsInPurchase : 0;
        const actualAmountPaid = Math.max(0, ticketType.currentPrice - discountPerTicket);

        const ticketId = await ctx.db.insert("tickets", {
          eventId: args.eventId,
          userId: args.userId,
          ticketTypeId: selection.ticketTypeId,
          quantity: 1,
          unitPrice: ticketType.currentPrice,
          totalAmount: actualAmountPaid,
          purchasedAt: Date.now(),
          status: "valid",
          stripeSessionId: args.stripeSessionId,
          paymentIntentId: args.paymentIntentId,
          promoterCode: args.promoterCode,
          couponCode: args.couponCode,
          discountAmount: args.discountAmount,
          originalAmount: ticketType.currentPrice,
        });
        createdTickets.push(ticketId);
      }

      // Update available quantity
      await ctx.db.patch(selection.ticketTypeId, {
        availableQuantity: ticketType.availableQuantity - selection.quantity,
      });
    }

    // Atualizar estatísticas do promoter (se existir)
    if (promoter) {
      const totalSales = createdTickets.length;

      // Buscar todos os ticket types de uma vez
      const ticketTypesPromises = selections.map(sel => ctx.db.get(sel.ticketTypeId));
      const ticketTypesResults = await Promise.all(ticketTypesPromises);

      const totalRevenue = selections.reduce((sum, sel, index) => {
        const ticketType = ticketTypesResults[index];
        return sum + (ticketType?.currentPrice || 0) * sel.quantity;
      }, 0);

      await ctx.db.patch(promoter._id, {
        totalSales: (promoter.totalSales || 0) + totalSales,
        totalRevenue: (promoter.totalRevenue || 0) + totalRevenue,
      });
    }

    return { ticketIds: createdTickets };
  },
});

// REMOVER TODO O CÓDIGO DUPLICADO ABAIXO (linhas 547-562)
// O código que estava duplicado deve ser removido completamente

// Função para gerar ingressos cortesia
// Add this new function before generateCourtesyTickets
export const getOrCreateCourtesyTicketType = mutation({
  args: {
    eventId: v.id("events"),
    organizerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if courtesy ticket type already exists for this event
    const existingCourtesyType = await ctx.db
      .query("ticketTypes")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .filter((q) => q.eq(q.field("isCourtesy"), true))
      .first();

    if (existingCourtesyType) {
      return existingCourtesyType._id;
    }

    // Create new courtesy ticket type
    const courtesyTicketTypeId = await ctx.db.insert("ticketTypes", {
      eventId: args.eventId,
      name: "Cortesia",
      description: "Ingresso cortesia",
      totalQuantity: 1000, // High number for courtesy tickets
      availableQuantity: 1000,
      currentPrice: 0,
      isActive: true,
      sortOrder: 999, // Put at the end
      isCourtesy: true,
    });

    return courtesyTicketTypeId;
  },
});

export const generateCourtesyTickets = mutation({
  args: {
    eventId: v.id("events"),
    ticketTypeId: v.optional(v.id("ticketTypes")),
    userEmail: v.string(),
    quantity: v.number(),
    generatedBy: v.string(),
    recipientName: v.optional(v.string()),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user exists - DO NOT create if doesn't exist
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) {
      throw new Error(`Usuário com email ${args.userEmail} não está cadastrado no sistema. Apenas usuários cadastrados podem receber ingressos cortesia.`);
    }

    // Buscar o evento
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Evento não encontrado");
    }

    // Verificar permissão: o usuário é o dono do evento OU é membro da organização
    let hasPermission = event.userId === args.generatedBy;
    
    // Se não é o dono e o evento pertence a uma organização, verificar se é membro
    if (!hasPermission && event.organizationId) {
      const membership = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization_user", (q) => 
          q.eq("organizationId", event.organizationId!).eq("userId", args.generatedBy)
        )
        .filter((q) => 
          q.eq(q.field("status"), "active")
        )
        .first();

      hasPermission = !!membership;
    }

    if (!hasPermission) {
      throw new Error("Você não tem permissão para gerar cortesias para este evento");
    }

    // Get or create courtesy ticket type
    let ticketTypeId = args.ticketTypeId;
    if (!ticketTypeId) {
      ticketTypeId = await getOrCreateCourtesyTicketType(ctx, {
        eventId: args.eventId,
        organizerId: args.generatedBy,
      });
    }

    // Verify ticket type availability
    if (!ticketTypeId) throw new Error("Ticket type ID is required");
    const ticketType = await ctx.db.get(ticketTypeId);
    if (!ticketType) {
      throw new Error("Tipo de ingresso não encontrado");
    }

    if (ticketType.availableQuantity < args.quantity) {
      throw new Error("Quantidade insuficiente disponível");
    }

    // Create courtesy ticket
    // Create individual courtesy tickets (one for each quantity)
    const ticketIds: GenericId<"tickets">[] = [];

    for (let i = 0; i < args.quantity; i++) {
      const ticketId = await ctx.db.insert("tickets", {
        eventId: args.eventId,
        ticketTypeId,
        userId: user.userId,
        quantity: 1, // Sempre 1 para cada ticket individual
        unitPrice: 0,
        totalAmount: 0,
        purchasedAt: Date.now(),
        status: "valid",
      });

      ticketIds.push(ticketId);
    }

    // Update available quantity
    await ctx.db.patch(ticketTypeId, {
      availableQuantity: ticketType.availableQuantity - args.quantity,
    });

    return { ticketIds }; // Retorna array de IDs ao invés de um único ID
  },
});


export const getEventBuyers = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {

    
    const event = await ctx.db.get(eventId);

    // Buscar todos os tickets válidos do evento
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();

    // Buscar informações dos usuários via Clerk
    const buyersData = await Promise.all(
      tickets.map(async (ticket) => {
        const user = await ctx.db.query("users").withIndex("by_user_id", (q) => q.eq("userId", ticket.userId)).first();
        return {
          name: user?.name,
          email: user?.email,
          phone: user?.phone,
          ticketQuantity: ticket.quantity,
          ticketStatus: ticket.status,
          purchaseDate: ticket.purchasedAt,
          totalAmount: ticket.totalAmount
        };
      })
    );

    return buyersData;
  },
});

export const getEventFinancialMetrics = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    const ticketTypes = await ctx.db
      .query("ticketTypes")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    // Métricas por tipo de ingresso
    const salesByType = ticketTypes.map(type => {
      const typeTickets = tickets.filter(t => t.ticketTypeId === type._id && (t.status === "valid" || t.status === "used"));
      const revenue = typeTickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);
      const quantity = typeTickets.reduce((sum, ticket) => sum + ticket.quantity, 0);

      return {
        typeName: type.name,
        revenue,
        quantity,
        averagePrice: quantity > 0 ? revenue / quantity : 0
      };
    });

    // Métricas por período (últimos 30 dias)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const dailySales = [];

    for (let i = 29; i >= 0; i--) {
      const dayStart = Date.now() - (i * 24 * 60 * 60 * 1000);
      const dayEnd = dayStart + (24 * 60 * 60 * 1000);

      const dayTickets = tickets.filter(t =>
        t._creationTime >= dayStart &&
        t._creationTime < dayEnd &&
        (t.status === "valid" || t.status === "used")
      );

      const dayRevenue = dayTickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);
      const dayQuantity = dayTickets.reduce((sum, ticket) => sum + ticket.quantity, 0);

      dailySales.push({
        date: new Date(dayStart).toISOString().split('T')[0],
        revenue: dayRevenue,
        quantity: dayQuantity
      });
    }

    return {
      salesByType,
      dailySales
    };
  }
});

// Nova função para listar proprietários de ingressos
export const getEventTicketHolders = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .filter((q) => q.or(
        q.eq(q.field("status"), "valid"),
        q.eq(q.field("status"), "used")
      ))
      .collect();

    // Agrupar tickets por usuário
    const holderMap = new Map();

    for (const ticket of tickets) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_user_id", (q) => q.eq("userId", ticket.userId))
        .first();

      const ticketType = await ctx.db.get(ticket.ticketTypeId);

      if (user && ticketType) {
        const key = ticket.userId;
        if (!holderMap.has(key)) {
          holderMap.set(key, {
            userId: ticket.userId,
            userName: user.name || "Nome não disponível",
            userEmail: user.email,
            tickets: [],
            totalTickets: 0,
            totalValue: 0
          });
        }

        const holder = holderMap.get(key);
        holder.tickets.push({
          ticketId: ticket._id,
          ticketType: ticketType.name,
          quantity: ticket.quantity,
          value: ticket.totalAmount,
          status: ticket.status,
          purchaseDate: ticket._creationTime
        });
        holder.totalTickets += ticket.quantity;
        holder.totalValue += ticket.totalAmount;
      }
    }

    return Array.from(holderMap.values()).sort((a, b) => b.totalTickets - a.totalTickets);
  }
});

// Mutation para processar compra via FreePay
export const purchaseTicketsWithFreePay = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.string(), // This is Clerk's user ID
    ticketSelections: v.array(
      v.object({
        ticketTypeId: v.id("ticketTypes"),
        quantity: v.number(),
      })
    ),
    transactionId: v.string(),
    promoterCode: v.optional(v.string()),
    couponCode: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
    customerName: v.string(),
    customerEmail: v.string(),
    customerCpf: v.string(),
  },
  handler: async (ctx, args) => {
    // Verificar idempotência - se já existem ingressos para esta transação
    const existingTickets = await ctx.db
      .query("tickets")
      .withIndex("by_transaction", (q) => q.eq("transactionId", args.transactionId))
      .collect();

    if (existingTickets.length > 0) {
      console.log('🔄 Ingressos já existem para transação:', args.transactionId);
      return { ticketIds: existingTickets.map(t => t._id) };
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Evento não encontrado!");
    }

    if (event.is_cancelled) {
      throw new Error("Este evento foi cancelado.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      throw new Error("Usuário (comprador) não encontrado!");
    }

    // Verificar e aplicar promoção/cupom
    let promoter = null;
    if (args.promoterCode) {
      promoter = await ctx.db
        .query("promoters")
        .withIndex("by_event_code", (q) =>
          q.eq("eventId", args.eventId).eq("code", args.promoterCode!)
        )
        .first();
    }

    let coupon = null;
    if (args.couponCode) {
      coupon = await ctx.db
        .query("coupons")
        .withIndex("by_event_code", (q) =>
          q.eq("eventId", args.eventId).eq("code", args.couponCode!)
        )
        .first();
    }

    const totalTicketsRequested = args.ticketSelections.reduce(
      (sum, s) => sum + s.quantity,
      0
    );
    const finalDiscountPerTicket =
      args.discountAmount && totalTicketsRequested > 0
        ? args.discountAmount / totalTicketsRequested
        : undefined;

    const ticketIds: Id<"tickets">[] = [];
    for (const selection of args.ticketSelections) {
      const ticketType = await ctx.db.get(selection.ticketTypeId);
      if (!ticketType) {
        throw new Error(
          `Tipo de ingresso ${selection.ticketTypeId} não encontrado.`
        );
      }
      
      if (ticketType.availableQuantity < selection.quantity) {
        throw new Error(
          `Não há ingressos suficientes para o tipo "${ticketType.name}". Disponíveis: ${ticketType.availableQuantity}, Solicitados: ${selection.quantity}.`
        );
      }

      for (let i = 0; i < selection.quantity; i++) {
        const ticketId = await ctx.db.insert("tickets", {
          eventId: args.eventId,
          ticketTypeId: selection.ticketTypeId,
          userId: args.userId,
          quantity: 1,
          unitPrice: ticketType.currentPrice,
          totalAmount: ticketType.currentPrice,
          purchasedAt: Date.now(),
          status: "valid",
          transactionId: args.transactionId,
          promoterCode: args.promoterCode,
          couponCode: args.couponCode,
          discountAmount: finalDiscountPerTicket,
          originalAmount: ticketType.currentPrice,
          paymentIntentId: args.transactionId,
        });
        ticketIds.push(ticketId);
      }

      await ctx.db.patch(ticketType._id, {
        availableQuantity: ticketType.availableQuantity - selection.quantity,
      });
    }

    return { ticketIds };
  },
});

// Mutation para salvar referência da transação
export const saveTransactionReference = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
    transactionId: v.string(),
    customerId: v.string(),
    amount: v.number(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    // Esta função pode ser usada para salvar informações adicionais sobre a transação
    // Por exemplo, em uma tabela separada de transações se necessário
    console.log(`Transaction reference saved: ${args.transactionId} for event ${args.eventId}, customer: ${args.customerId}`);
    return { success: true };
  },
});

export const getOrganizationEvents = query({
  args: { 
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, { organizationId }) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    const eventsWithMetrics = await Promise.all(
      events.map(async (event) => {
        const tickets = await ctx.db
          .query("tickets")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect();

        // Buscar tipos de ingressos para calcular total
        const ticketTypes = await ctx.db
          .query("ticketTypes")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect();

        const totalTickets = ticketTypes.reduce((sum, type) => sum + type.totalQuantity, 0);

        const validTickets = tickets.filter(
          (t) => t.status === "valid" || t.status === "used"
        );
        const refundedTickets = tickets.filter((t) => t.status === "refunded");
        const cancelledTickets = tickets.filter(
          (t) => t.status === "cancelled"
        );

        const metrics: Metrics = {
          soldTickets: validTickets.reduce((sum, ticket) => sum + ticket.quantity, 0),
          refundedTickets: refundedTickets.reduce((sum, ticket) => sum + ticket.quantity, 0),
          cancelledTickets: cancelledTickets.reduce((sum, ticket) => sum + ticket.quantity, 0),
          // Receita líquida (valor real pago com descontos aplicados)
          revenue: validTickets.reduce((total, ticket) => total + ticket.totalAmount, 0),
          // Receita bruta (valor original sem descontos)
          grossRevenue: validTickets.reduce((total, ticket) => total + (ticket.originalAmount || ticket.totalAmount), 0),
          // Total de descontos aplicados
          totalDiscounts: validTickets.reduce((total, ticket) => total + (ticket.discountAmount || 0), 0),
          refundedAmount: refundedTickets.reduce((total, ticket) => total + ticket.totalAmount, 0),
          totalTickets: totalTickets,
        };

        return {
          ...event,
          totalTickets,
          metrics,
        };
      })
    );

    return eventsWithMetrics;
  },
});

// Função para buscar todos os eventos publicados (não cancelados) para o sitemap
export const getPublishedEvents = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("is_cancelled"), undefined))
      .collect();
    
    // Retornar apenas os dados necessários para o sitemap
    return events.map(event => ({
      _id: event._id,
      slug: event.slug,
      name: event.name,
      eventStartDate: event.eventStartDate,
      eventEndDate: event.eventEndDate,
    }));
  },
});

// Obter estatísticas demográficas dos compradores de ingressos do evento
export const getEventDemographicStats = query({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    // Buscar o evento
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Evento não encontrado");
    }

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

    // Buscar tickets válidos do evento
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
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

    // Atualizar contagens totais
    stats.uniqueBuyers = uniqueBuyerIds.size;
    stats.buyersWithCompleteProfile = buyersWithCompleteProfileIds.size;

    return stats;
  },
});