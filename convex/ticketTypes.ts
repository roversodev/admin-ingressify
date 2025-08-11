// NOVO ARQUIVO: Gerenciamento de tipos de ingressos
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getEventTicketTypes = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    return await ctx.db
      .query("ticketTypes")
      .withIndex("by_event_active", (q) => 
        q.eq("eventId", eventId).eq("isActive", true)
      )
      .filter((q) => q.eq(q.field("isCourtesy"), false)) // Filtrar cortesias
      .order("asc")
      .collect();
  },
});

export const createTicketType = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    description: v.optional(v.string()),
    totalQuantity: v.number(),
    price: v.number(),
    sortOrder: v.number(),
    isCourtesy: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { price, isCourtesy, isActive, ...ticketTypeData } = args;
    
    return await ctx.db.insert("ticketTypes", {
      ...ticketTypeData,
      availableQuantity: args.totalQuantity,
      currentPrice: price,
      isActive: isActive === undefined ? true : isActive, // Corrigido
      isCourtesy: isCourtesy || false, // Valor padrão é false
    });
  },
});

export const checkAvailability = query({
  args: { 
    ticketTypeId: v.id("ticketTypes"),
    requestedQuantity: v.number(),
  },
  handler: async (ctx, { ticketTypeId, requestedQuantity }) => {
    const ticketType = await ctx.db.get(ticketTypeId);
    if (!ticketType) return { available: false, reason: "Tipo de ingresso não encontrado" };
    
    if (!ticketType.isActive) {
      return { available: false, reason: "Tipo de ingresso não está ativo" };
    }
    
    // Adicionar validação para cortesia
    if (ticketType.isCourtesy) {
      return { available: false, reason: "Ingressos cortesia não estão disponíveis para venda" };
    }
    
    if (ticketType.availableQuantity < requestedQuantity) {
      return { 
        available: false, 
        reason: `Apenas ${ticketType.availableQuantity} ingressos disponíveis`,
        availableQuantity: ticketType.availableQuantity
      };
    }
    
    return { 
      available: true, 
      price: ticketType.currentPrice,
      totalAmount: ticketType.currentPrice * requestedQuantity
    };
  },
});

export const updateTicketType = mutation({
  args: {
    ticketTypeId: v.id("ticketTypes"),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    totalQuantity: v.number(),
    sortOrder: v.number(),
    isCourtesy: v.optional(v.boolean()), // Adicionar este campo
    isActive: v.optional(v.boolean()), // Adicionar este campo
  },
  handler: async (ctx, args) => {
    const { ticketTypeId, price, isCourtesy, isActive, ...updates } = args;
    
    const ticketType = await ctx.db.get(ticketTypeId);
    if (!ticketType) throw new Error("Tipo de ingresso não encontrado");
    
    // Calcular nova quantidade disponível baseada na diferença
    const quantityDifference = args.totalQuantity - ticketType.totalQuantity;
    const newAvailableQuantity = ticketType.availableQuantity + quantityDifference;
    
    // Verificar se a nova quantidade disponível não é negativa
    if (newAvailableQuantity < 0) {
      throw new Error("Não é possível reduzir a quantidade total abaixo dos ingressos já vendidos");
    }
    
    await ctx.db.patch(ticketTypeId, {
      ...updates,
      currentPrice: price,
      availableQuantity: newAvailableQuantity,
      totalQuantity: args.totalQuantity,
      isCourtesy: isCourtesy || false, // Adicionar esta linha
      isActive: isActive === undefined ? true : isActive, // Corrigido
    });
    
    return ticketTypeId;
  },
});

export const deleteTicketType = mutation({
  args: {
    ticketTypeId: v.id("ticketTypes"),
  },
  handler: async (ctx, { ticketTypeId }) => {
    const ticketType = await ctx.db.get(ticketTypeId);
    if (!ticketType) throw new Error("Tipo de ingresso não encontrado");
    
    // Verificar se há ingressos vendidos para este tipo
    const soldTickets = await ctx.db
      .query("tickets")
      .withIndex("by_ticket_type", (q) => q.eq("ticketTypeId", ticketTypeId))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "valid"),
          q.eq(q.field("status"), "used")
        )
      )
      .collect();
    
    if (soldTickets.length > 0) {
      throw new Error("Não é possível deletar tipo de ingresso com ingressos já vendidos");
    }
    
    // Marcar como inativo ao invés de deletar para manter integridade
    await ctx.db.patch(ticketTypeId, { isActive: false });
    
    return ticketTypeId;
  },
});

export const getAllEventTicketTypesIncludingCourtesy = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    return await ctx.db
      .query("ticketTypes")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .order("asc")
      .collect();
  },
});

export const getById = query({
  args: { ticketTypeId: v.id("ticketTypes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ticketTypeId);
  },
});