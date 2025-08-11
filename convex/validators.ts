import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

interface ValidatorWithUser {
  _id: Id<"ticketValidators">;
  _creationTime: number;
  userId?: string;
  acceptedAt?: number;
  eventId: Id<"events">;
  email: string;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
  expiresAt: number;
  invitedBy: string;
  inviteToken: string;
  user?: { name: string } | null;
}

// Função para gerar um token aleatório (substitui randomBytes do crypto)
function generateRandomToken(length = 32) {
  const characters = 'abcdef0123456789';
  let token = '';
  for (let i = 0; i < length * 2; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    token += characters[randomIndex];
  }
  return token;
}

// Função para convidar um validador
export const inviteValidator = mutation({
  args: {
    eventId: v.id("events"),
    email: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { eventId, email, userId }) => {

    // Verificar se o evento existe
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Evento não encontrado");
    }
    
    // Verificar permissão: o usuário é o dono do evento OU é membro da organização
    let hasPermission = event.userId === userId;
    
    // Se não é o dono e o evento pertence a uma organização, verificar se é membro
    if (!hasPermission && event.organizationId) {
      const membership = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization_user", (q) => 
          q.eq("organizationId", event.organizationId!).eq("userId", userId)
        )
        .filter((q) => 
          q.eq(q.field("status"), "active")
        )
        .first();

      hasPermission = !!membership;
    }

    if (!hasPermission) {
      throw new Error("Você não tem permissão para convidar validadores para este evento");
    }

    // Verificar se o email já foi convidado para este evento
    const existingInvite = await ctx.db
      .query("ticketValidators")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .filter((q) => q.eq(q.field("email"), email))
      .first();

    if (existingInvite) {
      throw new Error("Este email já foi convidado para validar ingressos deste evento");
    }

    // Gerar token único para o convite
    const token = generateRandomToken(32);

    // Criar o convite
    const validatorId = await ctx.db.insert("ticketValidators", {
      eventId,
      email,
      invitedBy: userId,
      status: "pending",
      inviteToken: token,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // Expira em 7 dias
    });

    return { validatorId, token };
  },
});

// Função para aceitar um convite
export const acceptInvitation = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
    userEmail: v.string(),
  },
  handler: async (ctx, { token, userId, userEmail }) => {
    // Verificar se o usuário está autenticado

    // Buscar o convite pelo token
    const invitation = await ctx.db
      .query("ticketValidators")
      .withIndex("by_token", (q) => q.eq("inviteToken", token))
      .first();

    if (!invitation) {
      throw new Error("Convite não encontrado");
    }

    if (invitation.status !== "pending") {
      throw new Error("Este convite já foi utilizado ou rejeitado");
    }

    if (invitation.expiresAt < Date.now()) {
      throw new Error("Este convite expirou");
    }

    // Verificar se o email do usuário logado corresponde ao email convidado
    if (userEmail !== invitation.email) {
      throw new Error("Este convite foi enviado para outro email");
    }

    // Atualizar o convite
    await ctx.db.patch(invitation._id, {
      userId,
      status: "accepted",
      acceptedAt: Date.now(),
    });

    // Buscar informações do evento
    const event = await ctx.db.get(invitation.eventId);

    return { success: true, event };
  },
});

// Função para listar validadores de um evento
export const getEventValidators = query({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
  },
  handler: async (ctx, { eventId, userId }) => {

    // Verificar se o evento existe
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Evento não encontrado");
    }

    // Verificar permissão: o usuário é o dono do evento OU é membro da organização
    let hasPermission = event.userId === userId;
    
    // Se não é o dono e o evento pertence a uma organização, verificar se é membro
    if (!hasPermission && event.organizationId) {
      const membership = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization_user", (q) => 
          q.eq("organizationId", event.organizationId!).eq("userId", userId)
        )
        .filter((q) => 
          q.eq(q.field("status"), "active")
        )
        .first();

      hasPermission = !!membership;
    }

    if (!hasPermission) {
      throw new Error("Você não tem permissão para ver os validadores deste evento");
    }

    // Buscar todos os validadores do evento
    const validators = await ctx.db
      .query("ticketValidators")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    // Buscar informações dos usuários que aceitaram o convite
    const validatorsWithDetails: ValidatorWithUser[] = await Promise.all(
      validators.map(async (validator) => {
        if (validator.userId) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_user_id", (q) => q.eq("userId", validator.userId!))
            .first();

          return {
            ...validator,
            user: user ? { name: user.name } : null,
          };
        }
        return validator as ValidatorWithUser;
      })
    );

    return validatorsWithDetails;
  },
});

// Função para remover um validador
export const removeValidator = mutation({
  args: {
    validatorId: v.id("ticketValidators"),
    userId: v.string(),
  },
  handler: async (ctx, { validatorId, userId }) => {

    // Buscar o validador
    const validator = await ctx.db.get(validatorId);
    if (!validator) {
      throw new Error("Validador não encontrado");
    }

    // Verificar se o evento existe
    const event = await ctx.db.get(validator.eventId);
    if (!event) {
      throw new Error("Evento não encontrado");
    }
    
    // Verificar permissão: o usuário é o dono do evento OU é membro da organização
    let hasPermission = event.userId === userId;
    
    // Se não é o dono e o evento pertence a uma organização, verificar se é membro
    if (!hasPermission && event.organizationId) {
      const membership = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization_user", (q) => 
          q.eq("organizationId", event.organizationId!).eq("userId", userId)
        )
        .filter((q) => 
          q.eq(q.field("status"), "active")
        )
        .first();

      hasPermission = !!membership;
    }

    if (!hasPermission) {
      throw new Error("Você não tem permissão para remover validadores deste evento");
    }

    // Remover o validador
    await ctx.db.delete(validatorId);

    return { success: true };
  },
});

// Função para verificar se um usuário pode validar ingressos de um evento
export const canValidateTickets = query({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
  },
  handler: async (ctx, { eventId, userId }) => {

    // Verificar se o evento existe
    const event = await ctx.db.get(eventId);
    if (!event) {
      return { canValidate: false, reason: "Evento não encontrado" };
    }

    // Se o usuário é o dono do evento, ele pode validar
    if (event.userId === userId) {
      return { canValidate: true, isOwner: true };
    }

    // Verificar se o usuário é um validador aceito
    const validator = await ctx.db
      .query("ticketValidators")
      .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "accepted"))
      .first();

    if (validator) {
      return { canValidate: true, isOwner: false };
    }

    // Verificar se o evento pertence a uma organização
    if (event.organizationId) {
      // Verificar se o usuário é membro ativo da organização
      const membership = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization_user", (q) =>
          q.eq("organizationId", event.organizationId!).eq("userId", userId)
        )
        .filter((q) =>
          q.eq(q.field("status"), "active")
        )
        .first();

      if (membership) {
        return { canValidate: true, isOwner: false, isMember: true, role: membership.role };
      }
    }

    return { canValidate: false, reason: "Sem permissão para validar ingressos" };
  },
});

// Função para obter eventos que o usuário pode validar como convidado
export const getEventsUserCanValidate = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {

    // Buscar todos os convites aceitos para este usuário
    const validatorInvitations = await ctx.db
      .query("ticketValidators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "accepted"))
      .collect();

    // Buscar detalhes dos eventos
    const eventsWithDetails = await Promise.all(
      validatorInvitations.map(async (invitation) => {
        const event = await ctx.db.get(invitation.eventId);
        if (!event) return null;

        return {
          ...event,
          validatorId: invitation._id,
          invitedAt: invitation.createdAt,
          acceptedAt: invitation.acceptedAt,
        };
      })
    );

    // Filtrar eventos nulos (caso algum evento tenha sido excluído)
    return eventsWithDetails.filter(Boolean);
  },
});