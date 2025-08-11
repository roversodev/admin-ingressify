import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUserTicketForEvent = query({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
  },
  handler: async (ctx, { eventId, userId }) => {
    const ticket = await ctx.db
      .query("tickets")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", userId).eq("eventId", eventId)
      )
      .first();

    return ticket;
  },
});

export const getTicketWithDetails = query({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, { ticketId }) => {
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) return null;

    const event = await ctx.db.get(ticket.eventId);
    const ticketType = await ctx.db.get(ticket.ticketTypeId);

    return {
      ...ticket,
      event,
      ticketType,
    };
  },
});

export const getValidPaidTicketsForEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    return await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .filter((q) =>
        q.or(q.eq(q.field("status"), "valid"), q.eq(q.field("status"), "used"))
      )
      .collect();
  },
});

export const getValidTicketsForEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    return await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .filter((q) => q.eq(q.field("status"), "valid"))
      .collect();
  },
});

export const updateTicketStatus = mutation({
  args: {
    ticketId: v.id("tickets"),
    status: v.union(
      v.literal("valid"),
      v.literal("used"),
      v.literal("refunded"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, { ticketId, status }) => {
    await ctx.db.patch(ticketId, { status });
  },
});

export const validateTicket = mutation({
  args: {
    ticketId: v.id("tickets"),
    eventId: v.id("events"),
    userId: v.string()
  },
  handler: async (ctx, { ticketId, eventId, userId }) => {

    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Evento não encontrado");

    // Verificar se o usuário é o dono do evento ou um validador autorizado
    const isOwner = event.userId === userId;
    
    if (!isOwner) {
      // Verificar se o usuário é um validador aceito
      const validator = await ctx.db
        .query("ticketValidators")
        .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", userId))
        .filter((q) => q.eq(q.field("status"), "accepted"))
        .first();

      if (!validator) {
        throw new Error("Você não tem permissão para validar ingressos deste evento");
      }
    }

    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Ingresso não encontrado");
    if (ticket.eventId !== eventId) {
      throw new Error("Este ingresso não pertence a este evento");
    }
    
    // Buscar informações do tipo de ingresso
    const ticketType = await ctx.db.get(ticket.ticketTypeId);
    
    // Verificar se há transferência pendente
    const pendingTransfer = await ctx.db
      .query("transferRequests")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    
    if (pendingTransfer) {
      throw new Error("Ingresso em processo de transferência");
    }
    
    if (ticket.status === "used") {
      throw new Error("Ingresso já utilizado");
    }
    if (ticket.status === "refunded") {
      throw new Error("Ingresso reembolsado");
    }
    if (ticket.status === "cancelled") {
      throw new Error("Ingresso cancelado");
    }
    if (ticket.status !== "valid") {
      throw new Error("Ingresso inválido");
    }

    await ctx.db.patch(ticketId, { status: "used" });
    return { 
      success: true,
      ticket,
      event,
      ticketType
    };
  },
});

// Nova função para buscar ingressos por sessão do Stripe
export const getTicketsByStripeSession = query({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, { stripeSessionId }) => {
    return await ctx.db
      .query("tickets")
      .filter((q) => q.eq(q.field("stripeSessionId"), stripeSessionId))
      .collect();
  },
});

// Função para buscar ingressos por sessão com detalhes completos
export const getTicketsByStripeSessionWithDetails = query({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, { stripeSessionId }) => {
    const tickets = await ctx.db
      .query("tickets")
      .filter((q) => q.eq(q.field("stripeSessionId"), stripeSessionId))
      .collect();

    const ticketsWithDetails = await Promise.all(
      tickets.map(async (ticket) => {
        const event = await ctx.db.get(ticket.eventId);
        const ticketType = await ctx.db.get(ticket.ticketTypeId);
        return {
          ...ticket,
          event,
          ticketType,
        };
      })
    );

    return ticketsWithDetails;
  },
});

// Função para buscar tickets por IDs
export const getTicketsByIds = query({
  args: {
    ticketIds: v.array(v.id("tickets")),
  },
  handler: async (ctx, { ticketIds }) => {
    const tickets = [];
    for (const ticketId of ticketIds) {
      const ticket = await ctx.db.get(ticketId);
      if (ticket) {
        tickets.push(ticket);
      }
    }
    return tickets;
  },
});

// Função para cancelar ticket
export const cancelTicket = mutation({
  args: {
    ticketId: v.id("tickets"),
    reason: v.string(),
  },
  handler: async (ctx, { ticketId, reason }) => {
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) {
      throw new Error("Ticket não encontrado");
    }

    // Atualizar status do ticket
    await ctx.db.patch(ticketId, { 
      status: "cancelled" 
    });

    // Se o ticket foi pago, devolver quantidade ao tipo de ingresso
    if (ticket.totalAmount > 0) {
      const ticketType = await ctx.db.get(ticket.ticketTypeId);
      if (ticketType) {
        await ctx.db.patch(ticket.ticketTypeId, {
          availableQuantity: ticketType.availableQuantity + ticket.quantity,
        });
      }
    }

    console.log(`Ticket ${ticketId} cancelado. Motivo: ${reason}`);
    return { success: true };
  },
});

// Função para buscar tickets por transaction ID da FreePay
export const getTicketsByTransactionId = query({
  args: {
    transactionId: v.string(),
  },
  handler: async (ctx, { transactionId }) => {
    return await ctx.db
      .query("tickets")
      .withIndex("by_transaction", (q) => q.eq("transactionId", transactionId))
      .collect();
  },
});

// Buscar ingressos por transactionId
export const getByTransactionId = query({
  args: {
    transactionId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.transactionId) {
      return [];
    }
    
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_transaction", (q) => q.eq("transactionId", args.transactionId))
      .collect();
      
    return tickets;
  },
});

// Função para criar tickets a partir de uma transação
export const createTicketsFromTransaction = mutation({
  args: {
    transactionId: v.string(),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerCpf: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Buscar a transação
    const transaction = await ctx.db
      .query("transactions")
      .withIndex("by_transactionId", (q) => q.eq("transactionId", args.transactionId))
      .first();
    
    if (!transaction) {
      throw new Error(`Transação ${args.transactionId} não encontrada`);
    }
    
    // Verificar se já existem tickets para esta transação (idempotência)
    const existingTickets = await ctx.db
      .query("tickets")
      .withIndex("by_transaction", (q) => q.eq("transactionId", args.transactionId))
      .collect();
    
    if (existingTickets.length > 0) {
      console.log('🔄 Tickets já existem para esta transação:', args.transactionId);
      return { ticketIds: existingTickets.map(t => t._id) };
    }
    
    // Buscar os detalhes do evento e seleções de tickets do metadata da transação
    const eventId = transaction.eventId;
    const userId = transaction.userId;
    
    // Buscar os tipos de tickets e quantidades do metadata
    const metadata = transaction.metadata || {};
    let ticketSelections = [];
    
    try {
      // Tentar extrair ticketSelections do metadata
      if (metadata.ticketSelections) {
        ticketSelections = typeof metadata.ticketSelections === 'string' 
          ? JSON.parse(metadata.ticketSelections) 
          : metadata.ticketSelections;
      }
    } catch (e) {
      console.error('Erro ao processar ticketSelections:', e);
      throw new Error('Formato inválido de ticketSelections no metadata');
    }
    
    if (!eventId || !userId || !ticketSelections || ticketSelections.length === 0) {
      throw new Error('Dados insuficientes para criar tickets');
    }
    
    // Criar os tickets
    const ticketIds = [];
    
    for (const selection of ticketSelections) {
      // Buscar o tipo de ingresso usando a query específica para garantir o tipo correto
      const ticketType = await ctx.db
        .query("ticketTypes")
        .filter((q) => q.eq(q.field("_id"), selection.ticketTypeId))
        .first();
        
      if (!ticketType) {
        throw new Error(`Tipo de ingresso ${selection.ticketTypeId} não encontrado`);
      }
      
      if (ticketType.availableQuantity < selection.quantity) {
        throw new Error(
          `Não há ingressos suficientes para o tipo "${ticketType.name}". Disponíveis: ${ticketType.availableQuantity}, Solicitados: ${selection.quantity}.`
        );
      }
      
      // Criar um ticket para cada quantidade
      for (let i = 0; i < selection.quantity; i++) {
        const ticketId = await ctx.db.insert("tickets", {
          eventId,
          ticketTypeId: selection.ticketTypeId,
          userId,
          quantity: 1,
          unitPrice: ticketType.currentPrice,
          totalAmount: ticketType.currentPrice,
          purchasedAt: Date.now(),
          status: "valid",
          transactionId: args.transactionId,
          paymentIntentId: args.transactionId,
          promoterCode: metadata.promoterCode,
          couponCode: metadata.couponCode,
          discountAmount: metadata.discountAmount ? parseFloat(metadata.discountAmount) / selection.quantity : undefined,
          originalAmount: ticketType.currentPrice,
        });
        
        ticketIds.push(ticketId);
      }
      
      // Atualizar a quantidade disponível
      await ctx.db.patch(ticketType._id, {
        availableQuantity: ticketType.availableQuantity - selection.quantity,
      });
    }
    
    return { ticketIds };
  },
});

// Função para buscar ingressos por email do usuário
export const getTicketsByEmail = query({
  args: {
    email: v.string(),
    eventId: v.optional(v.id("events")),
  },
  handler: async (ctx, { email, eventId }) => {
    // Primeiro, encontrar o usuário pelo email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      return [];
    }

    // Depois, buscar os ingressos desse usuário
    let ticketsQuery = ctx.db.query("tickets").withIndex("by_user", (q) => 
      q.eq("userId", user.userId)
    );

    // Se eventId for fornecido, filtrar por evento específico
    if (eventId) {
      ticketsQuery = ticketsQuery.filter((q) => 
        q.eq(q.field("eventId"), eventId)
      );
    }

    return await ticketsQuery.collect();
  },
});

// Função para buscar ingressos por CPF do usuário
export const getTicketsByCpf = query({
  args: {
    cpf: v.string(),
    eventId: v.optional(v.id("events")),
  },
  handler: async (ctx, { cpf, eventId }) => {
    // Buscar usuários com este CPF
    // Como não temos índice por CPF, precisamos buscar todos e filtrar
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("cpf"), cpf))
      .collect();

    if (users.length === 0) {
      return [];
    }

    // Buscar ingressos para todos os usuários encontrados com este CPF
    const tickets = [];
    for (const user of users) {
      let ticketsQuery = ctx.db.query("tickets").withIndex("by_user", (q) => 
        q.eq("userId", user.userId)
      );

      // Se eventId for fornecido, filtrar por evento específico
      if (eventId) {
        ticketsQuery = ticketsQuery.filter((q) => 
          q.eq(q.field("eventId"), eventId)
        );
      }

      const userTickets = await ticketsQuery.collect();
      tickets.push(...userTickets);
    }

    return tickets;
  },
});

// Função para buscar ingressos com detalhes por email ou CPF
export const getTicketsWithDetailsByEmailOrCpf = query({
  args: {
    email: v.optional(v.string()),
    cpf: v.optional(v.string()),
    eventId: v.optional(v.id("events")),
  },
  handler: async (ctx, { email, cpf, eventId }) => {
    if (!email && !cpf) {
      throw new Error("É necessário fornecer email ou CPF");
    }

    // Buscar usuários por email ou CPF
    let users: { userId: string; name: string; email: string; cpf: string; phone: string; }[] = [];
    if (email) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (user && user.cpf && user.phone) {
        users.push({
          userId: user.userId,
          name: user.name,
          email: user.email,
          cpf: user.cpf,
          phone: user.phone
        });
      }
    } else if (cpf) {
      users = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("cpf"), cpf))
        .collect() as { userId: string; name: string; email: string; cpf: string; phone: string; }[];
    }

    if (users.length === 0) {
      return [];
    }

    // Buscar ingressos para todos os usuários encontrados
    const tickets = [];
    for (const user of users) {
      let ticketsQuery = ctx.db.query("tickets").withIndex("by_user", (q) => 
        q.eq("userId", user.userId)
      );

      // Se eventId for fornecido, filtrar por evento específico
      if (eventId) {
        ticketsQuery = ticketsQuery.filter((q) => 
          q.eq(q.field("eventId"), eventId)
        );
      }

      const userTickets = await ticketsQuery.collect();
      
      // Adicionar detalhes de evento e tipo de ingresso para cada ingresso
      for (const ticket of userTickets) {
        const event = await ctx.db.get(ticket.eventId);
        const ticketType = await ctx.db.get(ticket.ticketTypeId);
        const userDetails = {
          name: user.name,
          email: user.email,
          cpf: user.cpf,
          phone: user.phone
        };
        
        tickets.push({
          ...ticket,
          event,
          ticketType,
          user: userDetails
        });
      }
    }

    return tickets;
  },
});
