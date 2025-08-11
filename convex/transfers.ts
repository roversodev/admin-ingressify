import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Criar solicitação de transferência
export const createTransferRequest = mutation({
  args: {
    ticketId: v.id("tickets"),
    toUserEmail: v.string(),
    fromUserId: v.string(), // Adicionar o userId do remetente
  },
  handler: async (ctx, { ticketId, toUserEmail, fromUserId }) => {
    // Verificar se o ticket pertence ao usuário
    const ticket = await ctx.db.get(ticketId);

    // Verificar se o ticket está válido
    if (!ticket || ticket.status !== "valid") {
      throw new Error("Apenas tickets válidos podem ser transferidos");
    }

    // Verificar se o ticket pertence ao usuário informado
    if (ticket.userId !== fromUserId) {
      throw new Error("Você não pode transferir este ticket");
    }

    // Verificar se já existe transferência pendente
    const existingTransfer = await ctx.db
      .query("transferRequests")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingTransfer) {
      throw new Error("Já existe uma transferência pendente para este ticket");
    }

    // Verificar se o usuário destinatário existe
    const toUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", toUserEmail))
      .first();

    if (!toUser) {
      throw new Error("Usuário destinatário não encontrado");
    }

    if (toUser.userId === fromUserId) {
      throw new Error("Você não pode transferir um ticket para si mesmo");
    }

    // Gerar token único para a transferência
    const transferToken = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 horas

    // Criar solicitação de transferência
    const transferRequestId = await ctx.db.insert("transferRequests", {
      ticketId,
      fromUserId,
      toUserId: toUser.userId,
      toUserEmail,
      transferToken,
      status: "pending",
      expiresAt,
      createdAt: Date.now(),
    });

    // TODO: Enviar email para o destinatário
    // await sendTransferEmail(toUserEmail, transferToken);

    return {
      transferRequestId,
      transferToken,
      expiresAt,
    };
  },
});

// Aceitar transferência
export const acceptTransfer = mutation({
  args: {
    transferToken: v.string(),
  },
  handler: async (ctx, { transferToken }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Não autenticado");

    const transferRequest = await ctx.db
      .query("transferRequests")
      .withIndex("by_token", (q) => q.eq("transferToken", transferToken))
      .first();

    if (!transferRequest) {
      throw new Error("Solicitação de transferência não encontrada");
    }

    if (transferRequest.status !== "pending") {
      throw new Error("Esta transferência não está mais disponível");
    }

    if (transferRequest.expiresAt < Date.now()) {
      // Marcar como expirada
      await ctx.db.patch(transferRequest._id, { status: "expired" });
      throw new Error("Esta transferência expirou");
    }

    if (transferRequest.toUserId !== identity.subject) {
      throw new Error("Esta transferência não é para você");
    }

    // Transferir o ticket
    const ticket = await ctx.db.get(transferRequest.ticketId);
    if (!ticket) {
      throw new Error("Ticket não encontrado");
    }

    // Atualizar o dono do ticket
    await ctx.db.patch(transferRequest.ticketId, {
      userId: identity.subject,
    });

    // Marcar transferência como aceita
    await ctx.db.patch(transferRequest._id, {
      status: "accepted",
      acceptedAt: Date.now(),
    });

    // Registrar no histórico
    await ctx.db.insert("transferHistory", {
      ticketId: transferRequest.ticketId,
      fromUserId: transferRequest.fromUserId,
      toUserId: identity.subject,
      transferredAt: Date.now(),
      transferRequestId: transferRequest._id,
    });

    return { success: true };
  },
});

// Cancelar transferência
export const cancelTransfer = mutation({
  args: {
    transferRequestId: v.id("transferRequests"),
  },
  handler: async (ctx, { transferRequestId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Não autenticado");

    const transferRequest = await ctx.db.get(transferRequestId);
    if (!transferRequest) {
      throw new Error("Solicitação não encontrada");
    }

    if (transferRequest.fromUserId !== identity.subject) {
      throw new Error("Você não pode cancelar esta transferência");
    }

    if (transferRequest.status !== "pending") {
      throw new Error("Esta transferência não pode ser cancelada");
    }

    await ctx.db.patch(transferRequestId, {
      status: "cancelled",
      cancelledAt: Date.now(),
    });

    return { success: true };
  },
});

// Listar transferências do usuário
export const getUserTransfers = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const sentTransfers = await ctx.db
      .query("transferRequests")
      .withIndex("by_from_user", (q) => q.eq("fromUserId", userId))
      .collect();

    const receivedTransfers = await ctx.db
      .query("transferRequests")
      .withIndex("by_to_email", (q) => q.eq("toUserEmail", "")) // Precisamos ajustar isso
      .collect();

    return { sent: sentTransfers, received: receivedTransfers };
  },
});

// Verificar transferência por token
export const getTransferByToken = query({
  args: { transferToken: v.string() },
  handler: async (ctx, { transferToken }) => {
    const transferRequest = await ctx.db
      .query("transferRequests")
      .withIndex("by_token", (q) => q.eq("transferToken", transferToken))
      .first();

    if (!transferRequest) return null;

    const ticket = await ctx.db.get(transferRequest.ticketId);
    const event = ticket ? await ctx.db.get(ticket.eventId) : null;
    const fromUser = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", transferRequest.fromUserId))
      .first();

    return {
      ...transferRequest,
      ticket,
      event,
      fromUser,
    };
  },
});

// Buscar transferências pendentes recebidas por um usuário
export const getPendingReceivedTransfers = query({
  args: { userEmail: v.string() },
  handler: async (ctx, { userEmail }) => {
    const pendingTransfers = await ctx.db
      .query("transferRequests")
      .withIndex("by_to_email", (q) => q.eq("toUserEmail", userEmail))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    // Buscar detalhes dos tickets e eventos para cada transferência
    const transfersWithDetails = await Promise.all(
      pendingTransfers.map(async (transfer) => {
        const ticket = await ctx.db.get(transfer.ticketId);
        const event = ticket ? await ctx.db.get(ticket.eventId) : null;
        const fromUser = await ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", transfer.fromUserId))
          .first();

        return {
          ...transfer,
          ticket,
          event,
          fromUser,
        };
      })
    );

    return transfersWithDetails;
  },
});

// Aceitar transferência (versão simplificada sem autenticação backend)
export const acceptTransferSimple = mutation({
  args: { 
    transferRequestId: v.id("transferRequests"),
    toUserId: v.string()
  },
  handler: async (ctx, { transferRequestId, toUserId }) => {
    const transferRequest = await ctx.db.get(transferRequestId);
    if (!transferRequest) {
      throw new Error("Solicitação não encontrada");
    }

    if (transferRequest.status !== "pending") {
      throw new Error("Esta transferência não está mais disponível");
    }

    if (transferRequest.expiresAt < Date.now()) {
      // Marcar como expirada
      await ctx.db.patch(transferRequest._id, { status: "expired" });
      throw new Error("Esta transferência expirou");
    }

    // Transferir o ticket
    const ticket = await ctx.db.get(transferRequest.ticketId);
    if (!ticket) {
      throw new Error("Ticket não encontrado");
    }

    // Atualizar o dono do ticket
    await ctx.db.patch(transferRequest.ticketId, {
      userId: toUserId,
    });

    // Marcar transferência como aceita
    await ctx.db.patch(transferRequestId, {
      status: "accepted",
      acceptedAt: Date.now(),
      toUserId: toUserId,
    });

    // Criar histórico
    await ctx.db.insert("transferHistory", {
      ticketId: transferRequest.ticketId,
      fromUserId: transferRequest.fromUserId,
      toUserId: toUserId,
      transferredAt: Date.now(),
      transferRequestId: transferRequestId,
    });

    return { success: true };
  },
});

// Recusar transferência
export const rejectTransfer = mutation({
  args: { transferRequestId: v.id("transferRequests") },
  handler: async (ctx, { transferRequestId }) => {
    const transferRequest = await ctx.db.get(transferRequestId);
    if (!transferRequest) {
      throw new Error("Solicitação não encontrada");
    }

    if (transferRequest.status !== "pending") {
      throw new Error("Esta transferência não pode ser recusada");
    }

    await ctx.db.patch(transferRequestId, {
      status: "cancelled",
      cancelledAt: Date.now(),
    });

    return { success: true };
  },
});

// Verificar se há transferência pendente para um ticket
export const getPendingTransferForTicket = query({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, { ticketId }) => {
    return await ctx.db
      .query("transferRequests")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
  },
});

// Buscar histórico de transferência para um ticket
export const getTransferHistoryForTicket = query({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, { ticketId }) => {
    const history = await ctx.db
      .query("transferHistory")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .first();
    
    if (!history) return null;
    
    // Buscar informações do usuário que fez a transferência
    const fromUser = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", history.fromUserId))
      .first();
    
    return {
      ...history,
      fromUserName: fromUser?.name || "Usuário desconhecido"
    };
  },
});

// Nova função para estatísticas de transferências do evento
export const getEventTransferStats = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    // Buscar todos os tickets do evento
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    
    const ticketIds = tickets.map(t => t._id);
    
    // Buscar transferências pendentes
    const pendingTransfers = await ctx.db
      .query("transferRequests")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    
    const eventPendingTransfers = pendingTransfers.filter(t => 
      ticketIds.includes(t.ticketId)
    );
    
    // Buscar histórico de transferências
    const transferHistory = await ctx.db
      .query("transferHistory")
      .collect();
    
    const eventTransferHistory = transferHistory.filter(t => 
      ticketIds.includes(t.ticketId)
    );
    
    // Estatísticas por período (últimos 30 dias)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentTransfers = eventTransferHistory.filter(t => 
      t._creationTime >= thirtyDaysAgo
    );
    
    return {
      totalTransfers: eventTransferHistory.length,
      pendingTransfers: eventPendingTransfers.length,
      recentTransfers: recentTransfers.length,
      transferRate: tickets.length > 0 ? (eventTransferHistory.length / tickets.length) * 100 : 0
    };
  }
});

// Nova função para detalhes de transferências do evento
export const getEventTransferDetails = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    // Buscar todos os tickets do evento
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    
    const ticketIds = tickets.map(t => t._id);
    
    // Buscar transferências pendentes com detalhes
    const pendingTransfers = await ctx.db
      .query("transferRequests")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    
    const eventPendingTransfers = await Promise.all(
      pendingTransfers
        .filter(t => ticketIds.includes(t.ticketId))
        .map(async (transfer) => {
          const ticket = await ctx.db.get(transfer.ticketId);
          const ticketType = ticket ? await ctx.db.get(ticket.ticketTypeId) : null;
          const fromUser = await ctx.db
            .query("users")
            .withIndex("by_user_id", (q) => q.eq("userId", transfer.fromUserId))
            .first();
          
          return {
            transferId: transfer._id,
            fromUserName: fromUser?.name || "Usuário desconhecido",
            toUserEmail: transfer.toUserEmail,
            ticketType: ticketType?.name || "Tipo desconhecido",
            createdAt: transfer._creationTime,
            expiresAt: transfer.expiresAt
          };
        })
    );
    
    // Buscar histórico de transferências com detalhes
    const transferHistory = await ctx.db
      .query("transferHistory")
      .collect();
    
    const eventTransferHistory = await Promise.all(
      transferHistory
        .filter(t => ticketIds.includes(t.ticketId))
        .map(async (transfer) => {
          const ticket = await ctx.db.get(transfer.ticketId);
          const ticketType = ticket ? await ctx.db.get(ticket.ticketTypeId) : null;
          const fromUser = await ctx.db
            .query("users")
            .withIndex("by_user_id", (q) => q.eq("userId", transfer.fromUserId))
            .first();
          const toUser = await ctx.db
            .query("users")
            .withIndex("by_user_id", (q) => q.eq("userId", transfer.toUserId))
            .first();
          
          return {
            transferId: transfer._id,
            fromUserName: fromUser?.name || "Usuário desconhecido",
            toUserName: toUser?.name || "Usuário desconhecido",
            ticketType: ticketType?.name || "Tipo desconhecido",
            transferredAt: transfer._creationTime
          };
        })
    );
    
    return {
      pendingTransfers: eventPendingTransfers,
      completedTransfers: eventTransferHistory.sort((a, b) => b.transferredAt - a.transferredAt)
    };
  }
});