import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Verificar se um usuário é admin e suas permissões
export const checkAdminStatus = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin) {
      return { isAdmin: false };
    }

    return {
      isAdmin: true,
      role: admin.role,
      permissions: admin.permissions,
      isSuperAdmin: admin.role === "superadmin",
    };
  },
});

// Criar o primeiro superadmin (só pode ser chamado uma vez)
export const createFirstSuperAdmin = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { userId, email }) => {
    // Verificar se já existe algum superadmin
    const existingSuperAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_role", (q) => q.eq("role", "superadmin"))
      .first();

    if (existingSuperAdmin) {
      throw new Error("Já existe um superadmin configurado");
    }

    // Criar o primeiro superadmin
    const adminId = await ctx.db.insert("platformAdmins", {
      userId,
      email,
      role: "superadmin",
      permissions: ["*"], // Todas as permissões
      createdAt: Date.now(),
      isActive: true,
    });

    // Registrar atividade
    await ctx.db.insert("adminActivityLogs", {
      adminId: userId,
      action: "create_first_superadmin",
      targetType: "admin",
      targetId: userId,
      details: { email },
      timestamp: Date.now(),
    });

    return adminId;
  },
});

// Adicionar um novo admin (requer ser superadmin)
export const addAdmin = mutation({
  args: {
    currentUserId: v.string(), // ID do admin atual
    newAdminUserId: v.string(), // ID do novo admin
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("support"),
      v.literal("finance")
    ),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário atual é superadmin
    const currentAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.currentUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!currentAdmin || currentAdmin.role !== "superadmin") {
      throw new Error("Apenas superadmins podem adicionar novos administradores");
    }

    // Verificar se o usuário já é admin
    const existingAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.newAdminUserId))
      .first();

    if (existingAdmin) {
      if (existingAdmin.isActive) {
        throw new Error("Este usuário já é um administrador");
      } else {
        // Reativar admin existente
        await ctx.db.patch(existingAdmin._id, {
          role: args.role,
          permissions: args.permissions,
          isActive: true,
          createdBy: args.currentUserId,
          createdAt: Date.now(),
        });

        // Registrar atividade
        await ctx.db.insert("adminActivityLogs", {
          adminId: args.currentUserId,
          action: "reactivate_admin",
          targetType: "admin",
          targetId: args.newAdminUserId,
          details: { role: args.role, permissions: args.permissions },
          timestamp: Date.now(),
        });

        return existingAdmin._id;
      }
    }

    // Criar novo admin
    const adminId = await ctx.db.insert("platformAdmins", {
      userId: args.newAdminUserId,
      email: args.email,
      role: args.role,
      permissions: args.permissions,
      createdAt: Date.now(),
      createdBy: args.currentUserId,
      isActive: true,
    });

    // Registrar atividade
    await ctx.db.insert("adminActivityLogs", {
      adminId: args.currentUserId,
      action: "create_admin",
      targetType: "admin",
      targetId: args.newAdminUserId,
      details: { role: args.role, permissions: args.permissions },
      timestamp: Date.now(),
    });

    return adminId;
  },
});

// Remover um admin
export const removeAdmin = mutation({
  args: {
    currentUserId: v.string(),
    adminUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário atual é superadmin
    const currentAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.currentUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!currentAdmin || currentAdmin.role !== "superadmin") {
      throw new Error("Apenas superadmins podem remover administradores");
    }

    // Não permitir remover a si mesmo
    if (args.currentUserId === args.adminUserId) {
      throw new Error("Você não pode remover a si mesmo");
    }

    // Buscar o admin a ser removido
    const adminToRemove = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.adminUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!adminToRemove) {
      throw new Error("Administrador não encontrado");
    }

    // Desativar o admin (não excluir)
    await ctx.db.patch(adminToRemove._id, {
      isActive: false,
    });

    // Registrar atividade
    await ctx.db.insert("adminActivityLogs", {
      adminId: args.currentUserId,
      action: "remove_admin",
      targetType: "admin",
      targetId: args.adminUserId,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// Atualizar permissões de um admin
export const updateAdminPermissions = mutation({
  args: {
    currentUserId: v.string(),
    adminUserId: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("support"),
      v.literal("finance")
    ),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário atual é superadmin
    const currentAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.currentUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!currentAdmin || currentAdmin.role !== "superadmin") {
      throw new Error("Apenas superadmins podem atualizar permissões");
    }

    // Buscar o admin a ser atualizado
    const adminToUpdate = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.adminUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!adminToUpdate) {
      throw new Error("Administrador não encontrado");
    }

    // Não permitir alterar superadmins
    if (adminToUpdate.role === "superadmin") {
      throw new Error("Não é possível alterar permissões de um superadmin");
    }

    // Atualizar permissões
    await ctx.db.patch(adminToUpdate._id, {
      role: args.role,
      permissions: args.permissions,
    });

    // Registrar atividade
    await ctx.db.insert("adminActivityLogs", {
      adminId: args.currentUserId,
      action: "update_admin_permissions",
      targetType: "admin",
      targetId: args.adminUserId,
      details: { role: args.role, permissions: args.permissions },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// Listar todos os admins
export const listAllAdmins = query({
  args: { currentUserId: v.string() },
  handler: async (ctx, { currentUserId }) => {
    // Verificar se o usuário atual é admin
    const currentAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", currentUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!currentAdmin) {
      throw new Error("Acesso não autorizado");
    }

    // Buscar todos os admins ativos
    const admins = await ctx.db
      .query("platformAdmins")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return admins.map(admin => ({
      _id: admin._id,
      userId: admin.userId,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      createdAt: admin.createdAt,
      lastLogin: admin.lastLogin,
    }));
  },
});

// Obter estatísticas gerais da plataforma
export const getPlatformStats = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Verificar se o usuário é admin
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin) {
      throw new Error("Acesso não autorizado");
    }

    // Contar usuários
    const totalUsers = await ctx.db.query("users").collect();
    
    // Contar eventos
    const events = await ctx.db.query("events").collect();
    
    // Contar organizações
    const organizations = await ctx.db.query("organizations").collect();
    
    // Contar ingressos vendidos
    const tickets = await ctx.db
      .query("tickets")
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "valid"),
          q.eq(q.field("status"), "used")
        )
      )
      .collect();
    
    // Calcular receita total
    const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);
    
    return {
      totalUsers: totalUsers.length,
      totalEvents: events.length,
      totalOrganizations: organizations.length,
      totalTicketsSold: tickets.length,
      totalRevenue,
    };
  },
});

// Listar todos os usuários com paginação
export const listAllUsers = query({
  args: { 
    userId: v.string(),
    skip: v.optional(v.number()),
    limit: v.optional(v.number()),
    searchTerm: v.optional(v.string())
  },
  handler: async (ctx, { userId, skip = 0, limit = 50, searchTerm }) => {
    // Verificar se o usuário é admin
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin) {
      throw new Error("Acesso não autorizado");
    }

    // Buscar usuários com paginação
    let query = ctx.db.query("users");
    
    // Buscar todos os usuários e filtrar em JavaScript
    const allUsers = await query.collect();
    
    // Filtrar por termo de busca se fornecido
    let filteredUsers = allUsers;
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredUsers = allUsers.filter(user => 
        (user.name?.toLowerCase().includes(lowerSearchTerm) || 
         user.email?.toLowerCase().includes(lowerSearchTerm))
      );
    }
    
    // Aplicar paginação manualmente
    const paginatedUsers = filteredUsers.slice(skip, skip + limit);
    
    return {
      users: paginatedUsers,
      hasMore: skip + limit < filteredUsers.length,
      nextCursor: skip + limit < filteredUsers.length ? (skip + limit).toString() : null,
    };
  },
});

// Listar todos os eventos com paginação
export const listAllEvents = query({
  args: { 
    userId: v.string(),
    skip: v.optional(v.number()),
    limit: v.optional(v.number()),
    searchTerm: v.optional(v.string())
  },
  handler: async (ctx, { userId, skip = 0, limit = 50, searchTerm }) => {
    // Verificar se o usuário é admin
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin) {
      throw new Error("Acesso não autorizado");
    }

    // Buscar eventos
    let query = ctx.db.query("events");
    
    // Buscar todos os eventos e filtrar em JavaScript
    const allEvents = await query.collect();
    
    // Filtrar por termo de busca se fornecido
    let filteredEvents = allEvents;
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredEvents = allEvents.filter(event => 
        (event.name?.toLowerCase().includes(lowerSearchTerm) || 
         event.description?.toLowerCase().includes(lowerSearchTerm) ||
         event.location?.toLowerCase().includes(lowerSearchTerm))
      );
    }
    
    // Aplicar paginação manualmente
    const paginatedEvents = filteredEvents.slice(skip, skip + limit);
    
    return {
      events: paginatedEvents,
      hasMore: skip + limit < filteredEvents.length,
      nextCursor: skip + limit < filteredEvents.length ? (skip + limit).toString() : null,
    };
  },
});

// Obter detalhes de um evento específico
export const getEventDetails = query({
  args: { 
    userId: v.string(),
    eventId: v.id("events")
  },
  handler: async (ctx, { userId, eventId }) => {
    // Verificar se o usuário é admin
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin) {
      throw new Error("Acesso não autorizado");
    }

    // Buscar detalhes do evento
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Evento não encontrado");
    }
    
    // Buscar tipos de ingresso
    const ticketTypes = await ctx.db
      .query("ticketTypes")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    
    // Buscar ingressos vendidos
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    
    // Calcular estatísticas
    const totalTicketsSold = tickets.length;
    const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);
    
    return {
      event,
      ticketTypes,
      stats: {
        totalTicketsSold,
        totalRevenue,
        ticketsByStatus: {
          valid: tickets.filter(t => t.status === "valid").length,
          used: tickets.filter(t => t.status === "used").length,
          refunded: tickets.filter(t => t.status === "refunded").length,
          cancelled: tickets.filter(t => t.status === "cancelled").length,
        }
      }
    };
  },
});

// Registrar ação de admin
export const logAdminActivity = mutation({
  args: {
    adminId: v.string(),
    action: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    details: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verificar se o usuário é admin
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", args.adminId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin) {
      throw new Error("Acesso não autorizado");
    }

    // Registrar atividade
    const logId = await ctx.db.insert("adminActivityLogs", {
      adminId: args.adminId,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      details: args.details,
      timestamp: Date.now(),
      ipAddress: args.ipAddress,
    });

    return logId;
  },
});

// Obter logs de atividade de admin
export const getAdminActivityLogs = query({
  args: { 
    userId: v.string(),
    skip: v.optional(v.number()),
    limit: v.optional(v.number()),
    filterAdmin: v.optional(v.string()),
    filterAction: v.optional(v.string()),
  },
  handler: async (ctx, { userId, skip = 0, limit = 50, filterAdmin, filterAction }) => {
    // Verificar se o usuário é admin
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin) {
      throw new Error("Acesso não autorizado");
    }

    // Construir query com o índice apropriado
    let query;
    
    if (filterAdmin) {
      query = ctx.db.query("adminActivityLogs")
        .withIndex("by_admin", (q) => q.eq("adminId", filterAdmin));
    } else if (filterAction) {
      query = ctx.db.query("adminActivityLogs")
        .withIndex("by_action", (q) => q.eq("action", filterAction));
    } else {
      query = ctx.db.query("adminActivityLogs");
    }
    
    // Executar query com paginação
    const logs = await query
      .order("desc")
      .paginate({ numItems: limit, cursor: skip.toString() });

    return {
      logs: logs.page,
      hasMore: logs.continueCursor !== null,
      nextCursor: logs.continueCursor,
    };
  },
});

// Obter estatísticas de vendas ao longo do tempo
export const getSalesOverTime = query({
  args: { 
    userId: v.string(),
    period: v.optional(v.string()), // "7d", "30d", "90d"
  },
  handler: async (ctx, { userId, period = "90d" }) => {
    // Verificar se o usuário é admin
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin) {
      throw new Error("Acesso não autorizado");
    }

    // Determinar a data de início com base no período
    const now = new Date();
    const startDate = new Date();
    if (period === "7d") {
      startDate.setDate(now.getDate() - 7);
    } else if (period === "30d") {
      startDate.setDate(now.getDate() - 30);
    } else {
      startDate.setDate(now.getDate() - 90);
    }

    // Buscar tickets criados no período
    const tickets = await ctx.db
      .query("tickets")
      .filter((q) => 
        q.and(
          q.or(
            q.eq(q.field("status"), "valid"),
            q.eq(q.field("status"), "used")
          ),
          q.gte(q.field("_creationTime"), startDate.getTime())
        )
      )
      .collect();

    // Definir interface para o objeto salesByDay
    interface DailySales {
      date: string;
      tickets: number;
      revenue: number;
    }
    
    // Inicializar salesByDay com o tipo correto
    const salesByDay: Record<string, DailySales> = {};
    
    tickets.forEach(ticket => {
      const date = new Date(ticket._creationTime);
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!salesByDay[dateString]) {
        salesByDay[dateString] = {
          date: dateString,
          tickets: 0,
          revenue: 0
        };
      }
      
      salesByDay[dateString].tickets += 1;
      salesByDay[dateString].revenue += ticket.totalAmount;
    });
    
    // Converter para array e ordenar por data
    const result = Object.values(salesByDay).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return result;
  },
});

export const getRevenueData = query({ 
  args: { userId: v.string() }, 
  handler: async (ctx, { userId }) => { 

    // Buscar todos os tickets válidos ou usados 
    const tickets = await ctx.db 
      .query("tickets") 
      .filter((q) => 
        q.or( 
          q.eq(q.field("status"), "valid"), 
          q.eq(q.field("status"), "used") 
        ) 
      ) 
      .collect(); 

    // Definir interfaces para os objetos de dados 
    interface MonthlyRevenue { 
      month: string; 
      actual: number; 
      projected: number; 
    } 

    interface YearlyRevenue { 
      month: string; // Ano como string 
      actual: number; 
      projected: number; 
    } 

    // Inicializar objetos para armazenar dados mensais e anuais 
    const monthlyData: Record<string, MonthlyRevenue> = {}; 
    const yearlyData: Record<string, YearlyRevenue> = {}; 

    // Valor base para projeção (8k no primeiro mês) 
    const baseProjection = 5000; 
    // Taxa de crescimento mensal para projeção (25%) 
    const monthlyGrowthRate = 0.25; 
    // Taxa de crescimento anual para projeção (40%) 
    const yearlyGrowthRate = 0.40; 

    // Obter o ano e mês atual 
    const currentDate = new Date(); 
    const currentYear = currentDate.getFullYear(); 
    const currentMonth = currentDate.getMonth() + 1; 

    // Criar entradas para todos os meses do ano atual 
    for (let month = 1; month <= 12; month++) { 
      const monthKey = `${currentYear}-${String(month).padStart(2, '0')}`; 
      const date = new Date(currentYear, month - 1, 1); 
      const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(date); 
      
      monthlyData[monthKey] = { 
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1), 
        actual: 0, 
        projected: 0 
      }; 
    } 

    // Criar entradas para os anos (atual e próximos 5 anos) 
    for (let yearOffset = 0; yearOffset < 6; yearOffset++) { 
      const year = currentYear + yearOffset; 
      const yearKey = `${year}`; 
      
      yearlyData[yearKey] = { 
        month: yearKey, 
        actual: 0, 
        projected: 0 
      }; 
    } 

    // Processar tickets para dados reais 
    tickets.forEach(ticket => { 
      const date = new Date(ticket._creationTime); 
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; 
      const yearKey = `${date.getFullYear()}`; 
      
      // Adicionar aos dados mensais se for do ano atual 
      if (date.getFullYear() === currentYear && monthlyData[monthKey]) { 
        monthlyData[monthKey].actual += ticket.totalAmount; 
      } 
      
      // Adicionar aos dados anuais 
      if (yearlyData[yearKey]) { 
        yearlyData[yearKey].actual += ticket.totalAmount; 
      } 
    }); 

    // Ordenar as chaves de meses e anos 
    const sortedMonthKeys = Object.keys(monthlyData).sort(); 
    const sortedYearKeys = Object.keys(yearlyData).sort(); 

    // Calcular projeções mensais 
    sortedMonthKeys.forEach((key, index) => { 
      // Projeção baseada no crescimento mensal a partir do valor base 
      monthlyData[key].projected = Math.round(baseProjection * Math.pow(1 + monthlyGrowthRate, index)); 
      
      // NÃO usar o valor projetado como valor real quando não há dados
      // Os valores reais devem permanecer como foram calculados com base nas transações reais
    }); 
    
    // Calcular projeções anuais 
    sortedYearKeys.forEach((key, index) => { 
      // Projeção baseada no crescimento anual a partir do valor base anualizado 
      yearlyData[key].projected = Math.round(baseProjection * 12 * Math.pow(1 + yearlyGrowthRate, index)); 
      
      // NÃO usar o valor projetado como valor real quando não há dados
      // Os valores reais devem permanecer como foram calculados com base nas transações reais
    }); 

    // Converter para arrays 
    const monthlyResult = sortedMonthKeys.map(key => monthlyData[key]); 
    const yearlyResult = sortedYearKeys.map(key => yearlyData[key]); 

    return { 
      monthly: monthlyResult, 
      yearly: yearlyResult 
    }; 
  }, 
});

export const getTicketSalesData = query({ 
  args: { userId: v.string() }, 
  handler: async (ctx, { userId }) => { 

    // Buscar todos os tickets válidos ou usados 
    const tickets = await ctx.db 
      .query("tickets") 
      .filter((q) => 
        q.or( 
          q.eq(q.field("status"), "valid"), 
          q.eq(q.field("status"), "used") 
        ) 
      ) 
      .collect(); 

    // Definir interfaces para os objetos de dados 
    interface MonthlyTickets { 
      month: string; 
      actual: number; 
      projected: number; 
    } 

    interface YearlyTickets { 
      month: string; // Ano como string 
      actual: number; 
      projected: number; 
    } 

    // Inicializar objetos para armazenar dados mensais e anuais 
    const monthlyData: Record<string, MonthlyTickets> = {}; 
    const yearlyData: Record<string, YearlyTickets> = {}; 

    // Valor base para projeção (500 ingressos no primeiro mês) 
    const baseProjection = 100; 
    // Taxa de crescimento mensal para projeção (20%) 
    const monthlyGrowthRate = 0.20; 
    // Taxa de crescimento anual para projeção (35%) 
    const yearlyGrowthRate = 0.35; 

    // Obter o ano e mês atual 
    const currentDate = new Date(); 
    const currentYear = currentDate.getFullYear(); 
    const currentMonth = currentDate.getMonth() + 1; 

    // Criar entradas para todos os meses do ano atual 
    for (let month = 1; month <= 12; month++) { 
      const monthKey = `${currentYear}-${String(month).padStart(2, '0')}`; 
      const date = new Date(currentYear, month - 1, 1); 
      const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(date); 
      
      monthlyData[monthKey] = { 
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1), 
        actual: 0, 
        projected: 0 
      }; 
    } 

    // Criar entradas para os anos (atual e próximos 5 anos) 
    for (let yearOffset = 0; yearOffset < 6; yearOffset++) { 
      const year = currentYear + yearOffset; 
      const yearKey = `${year}`; 
      
      yearlyData[yearKey] = { 
        month: yearKey, 
        actual: 0, 
        projected: 0 
      }; 
    } 

    // Processar tickets para dados reais 
    tickets.forEach(ticket => { 
      const date = new Date(ticket._creationTime); 
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; 
      const yearKey = `${date.getFullYear()}`; 
      
      // Adicionar aos dados mensais se for do ano atual 
      if (date.getFullYear() === currentYear && monthlyData[monthKey]) { 
        monthlyData[monthKey].actual += 1; // Contagem de ingressos, não valor 
      } 
      
      // Adicionar aos dados anuais 
      if (yearlyData[yearKey]) { 
        yearlyData[yearKey].actual += 1; // Contagem de ingressos, não valor 
      } 
    }); 

    // Ordenar as chaves de meses e anos 
    const sortedMonthKeys = Object.keys(monthlyData).sort(); 
    const sortedYearKeys = Object.keys(yearlyData).sort(); 

    // Calcular projeções mensais 
    sortedMonthKeys.forEach((key, index) => { 
      // Projeção baseada no crescimento mensal a partir do valor base 
      monthlyData[key].projected = Math.round(baseProjection * Math.pow(1 + monthlyGrowthRate, index)); 
      
      // NÃO usar o valor projetado como valor real quando não há dados
      // Os valores reais devem permanecer como foram calculados com base nas transações reais
    }); 
    
    // Calcular projeções anuais 
    sortedYearKeys.forEach((key, index) => { 
      // Projeção baseada no crescimento anual a partir do valor base anualizado 
      yearlyData[key].projected = Math.round(baseProjection * 12 * Math.pow(1 + yearlyGrowthRate, index)); 
      
      // NÃO usar o valor projetado como valor real quando não há dados
      // Os valores reais devem permanecer como foram calculados com base nas transações reais
    }); 

    // Converter para arrays 
    const monthlyResult = sortedMonthKeys.map(key => monthlyData[key]); 
    const yearlyResult = sortedYearKeys.map(key => yearlyData[key]); 

    return { 
      monthly: monthlyResult, 
      yearly: yearlyResult 
    }; 
  }, 
});


export const getRevenueChurnData = query({ 
  args: { userId: v.string() }, 
  handler: async (ctx, { userId }) => { 

    // Buscar todos os tickets válidos ou usados para receita
    const validTickets = await ctx.db 
      .query("tickets") 
      .filter((q) => 
        q.or( 
          q.eq(q.field("status"), "valid"), 
          q.eq(q.field("status"), "used") 
        ) 
      ) 
      .collect(); 

    // Buscar tickets cancelados ou reembolsados para churn
    const canceledTickets = await ctx.db 
      .query("tickets") 
      .filter((q) => 
        q.or( 
          q.eq(q.field("status"), "canceled"), 
          q.eq(q.field("status"), "refunded") 
        ) 
      ) 
      .collect(); 

    // Definir interface para os dados mensais
    interface MonthlyRevenueChurn { 
      month: string; 
      revenues: number; 
      churn: number; 
    } 

    // Inicializar objeto para armazenar dados mensais
    const monthlyData: Record<string, MonthlyRevenueChurn> = {}; 

    // Obter o ano atual
    const currentDate = new Date(); 
    const currentYear = currentDate.getFullYear(); 

    // Criar entradas para todos os meses do ano atual
    for (let month = 1; month <= 12; month++) { 
      const date = new Date(currentYear, month - 1, 1); 
      const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date); 
      
      monthlyData[monthName] = { 
        month: monthName, 
        revenues: 0, 
        churn: 0 
      }; 
    } 

    // Processar tickets válidos para receitas
    validTickets.forEach(ticket => { 
      const date = new Date(ticket._creationTime); 
      const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date); 
      
      if (monthlyData[monthName]) { 
        monthlyData[monthName].revenues += ticket.totalAmount; 
      } 
    }); 

    // Processar tickets cancelados para churn (valor negativo)
    canceledTickets.forEach(ticket => { 
      const date = new Date(ticket._creationTime); 
      const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date); 
      
      if (monthlyData[monthName]) { 
        // Churn é representado como valor negativo
        monthlyData[monthName].churn -= ticket.totalAmount; 
      } 
    }); 

    // Converter para array e ordenar por mês
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = Object.values(monthlyData).sort((a, b) => {
      const monthA = a.month.split(' ')[0];
      const monthB = b.month.split(' ')[0];
      return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
    });

    return result; 
  }, 
});


export const getRefundsData = query({ 
  args: { userId: v.string() }, 
  handler: async (ctx, { userId }) => { 

    // Buscar tickets reembolsados ou cancelados
    const refundedTickets = await ctx.db 
      .query("tickets") 
      .filter((q) => 
        q.or( 
          q.eq(q.field("status"), "refunded"), 
          q.eq(q.field("status"), "cancelled") 
        ) 
      ) 
      .collect(); 

    // Definir interfaces para os objetos de dados 
    interface MonthlyRefunds { 
      month: string; 
      actual: number; 
      projected: number; 
    } 

    interface YearlyRefunds { 
      month: string; // Ano como string 
      actual: number; 
      projected: number; 
    } 

    // Inicializar objetos para armazenar dados mensais e anuais 
    const monthlyData: Record<string, MonthlyRefunds> = {}; 
    const yearlyData: Record<string, YearlyRefunds> = {}; 

    // Valor base para projeção (1000 no primeiro mês) 
    const baseProjection = 500; 
    // Taxa de crescimento mensal para projeção (15%) 
    const monthlyGrowthRate = 0.15; 
    // Taxa de crescimento anual para projeção (25%) 
    const yearlyGrowthRate = 0.25; 

    // Obter o ano e mês atual 
    const currentDate = new Date(); 
    const currentYear = currentDate.getFullYear(); 
    const currentMonth = currentDate.getMonth() + 1; 

    // Criar entradas para todos os meses do ano atual 
    for (let month = 1; month <= 12; month++) { 
      const monthKey = `${currentYear}-${String(month).padStart(2, '0')}`; 
      const date = new Date(currentYear, month - 1, 1); 
      const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date); 
      
      monthlyData[monthKey] = { 
        month: monthName, 
        actual: 0, 
        projected: 0 
      }; 
    } 

    // Criar entradas para os anos (atual e próximos 5 anos) 
    for (let yearOffset = 0; yearOffset < 6; yearOffset++) { 
      const year = currentYear + yearOffset; 
      const yearKey = `${year}`; 
      
      yearlyData[yearKey] = { 
        month: yearKey, 
        actual: 0, 
        projected: 0 
      }; 
    } 

    // Processar tickets para dados reais 
    refundedTickets.forEach(ticket => { 
      const date = new Date(ticket._creationTime); 
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; 
      const yearKey = `${date.getFullYear()}`; 
      
      // Adicionar aos dados mensais se for do ano atual 
      if (date.getFullYear() === currentYear && monthlyData[monthKey]) { 
        monthlyData[monthKey].actual += ticket.totalAmount; 
      } 
      
      // Adicionar aos dados anuais 
      if (yearlyData[yearKey]) { 
        yearlyData[yearKey].actual += ticket.totalAmount; 
      } 
    }); 

    // Ordenar as chaves de meses e anos 
    const sortedMonthKeys = Object.keys(monthlyData).sort(); 
    const sortedYearKeys = Object.keys(yearlyData).sort(); 

    // Calcular projeções mensais 
    sortedMonthKeys.forEach((key, index) => { 
      // Projeção baseada no crescimento mensal a partir do valor base 
      monthlyData[key].projected = Math.round(baseProjection * Math.pow(1 + monthlyGrowthRate, index)); 
    }); 
    
    // Calcular projeções anuais 
    sortedYearKeys.forEach((key, index) => { 
      // Projeção baseada no crescimento anual a partir do valor base anualizado 
      yearlyData[key].projected = Math.round(baseProjection * 12 * Math.pow(1 + yearlyGrowthRate, index)); 
    }); 

    // Converter para arrays 
    const monthlyResult = sortedMonthKeys.map(key => monthlyData[key]); 
    const yearlyResult = sortedYearKeys.map(key => yearlyData[key]); 

    return { 
      monthly: monthlyResult, 
      yearly: yearlyResult 
    }; 
  }, 
});


export const getEventLocationStats = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Verificar se o usuário é admin
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin) {
      throw new Error("Acesso não autorizado");
    }

    // Buscar todos os eventos
    const events = await ctx.db
      .query("events")
      .collect();

    // Agrupar eventos por localização
    const locationMap = new Map();
    
    events.forEach(event => {
      const location = event.location;
      // Extrair apenas a cidade da localização (assumindo formato "Cidade, Estado")
      const city = location.split(',')[0].trim();
      
      if (!locationMap.has(city)) {
        locationMap.set(city, {
          location: city,
          count: 0,
          revenue: 0,
          ticketsSold: 0
        });
      }
      
      locationMap.get(city).count += 1;
    });

    // Para cada localização, calcular receita e ingressos vendidos
    for (const [city, data] of locationMap.entries()) {
      // Buscar eventos desta cidade
      const cityEvents = events.filter(event => {
        const eventCity = event.location.split(',')[0].trim();
        return eventCity === city;
      });
      
      // Para cada evento, buscar tickets e calcular métricas
      for (const event of cityEvents) {
        const tickets = await ctx.db
          .query("tickets")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .filter((q) => 
            q.or(
              q.eq(q.field("status"), "valid"),
              q.eq(q.field("status"), "used")
            )
          )
          .collect();
        
        data.ticketsSold += tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
        data.revenue += tickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);
      }
    }

    // Converter para array e ordenar por contagem
    const result = Array.from(locationMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Pegar apenas as 10 principais localizações

    return result;
  },
});



export const getUserGrowthData = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Verificar se o usuário é admin
    const admin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin) {
      throw new Error("Acesso não autorizado");
    }

    // Buscar todos os usuários
    const users = await ctx.db
      .query("users")
      .collect();

    // Definir interfaces para os objetos de dados
    interface MonthlyUsers {
      month: string;
      actual: number;
      projected: number;
    }

    interface YearlyUsers {
      month: string; // Ano como string
      actual: number;
      projected: number;
    }

    // Inicializar objetos para armazenar dados mensais e anuais
    const monthlyData: Record<string, MonthlyUsers> = {};
    const yearlyData: Record<string, YearlyUsers> = {};

    // Obter a data atual
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Criar entradas para todos os meses do ano atual
    for (let month = 1; month <= 12; month++) {
      const monthKey = `${currentYear}-${String(month).padStart(2, '0')}`;
      const date = new Date(currentYear, month - 1, 1);
      const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(date);
      
      monthlyData[monthKey] = {
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        actual: 0,
        projected: 0
      };
    }

    // Criar entradas para os anos (atual e próximos 5 anos)
    for (let yearOffset = 0; yearOffset < 6; yearOffset++) {
      const year = currentYear + yearOffset;
      const yearKey = `${year}`;
      
      yearlyData[yearKey] = {
        month: yearKey,
        actual: 0,
        projected: 0
      };
    }

    // Processar usuários para dados reais
    users.forEach(user => {
      // Usar _creationTime como data de criação do usuário
      const date = new Date(user._creationTime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const yearKey = `${date.getFullYear()}`;
      
      // Adicionar aos dados mensais se for do ano atual
      if (date.getFullYear() === currentYear && monthlyData[monthKey]) {
        monthlyData[monthKey].actual += 1;
      }
      
      // Adicionar aos dados anuais
      if (yearlyData[yearKey]) {
        yearlyData[yearKey].actual += 1;
      }
    });

    // Ordenar as chaves de meses e anos
    const sortedMonthKeys = Object.keys(monthlyData).sort();
    const sortedYearKeys = Object.keys(yearlyData).sort();

    // Definir taxas de crescimento para projeções
    const monthlyGrowthRate = 0.05; // 5% de crescimento mensal
    const yearlyGrowthRate = 0.30; // 30% de crescimento anual

    // Valor base para projeções (média dos últimos 3 meses ou um valor mínimo)
    let baseProjection = 10; // Valor mínimo padrão
    
    // Calcular média dos últimos 3 meses disponíveis
    const lastMonthsData = sortedMonthKeys
      .map(key => monthlyData[key].actual)
      .filter(value => value > 0)
      .slice(-3);
    
    if (lastMonthsData.length > 0) {
      baseProjection = Math.round(lastMonthsData.reduce((sum, val) => sum + val, 0) / lastMonthsData.length);
    }

    // Calcular projeções mensais
    sortedMonthKeys.forEach((key, index) => {
      // Projeção baseada no crescimento mensal a partir do valor base
      monthlyData[key].projected = Math.round(baseProjection * Math.pow(1 + monthlyGrowthRate, index));
    });
    
    // Calcular projeções anuais
    sortedYearKeys.forEach((key, index) => {
      // Projeção baseada no crescimento anual a partir do valor base anualizado
      yearlyData[key].projected = Math.round(baseProjection * 12 * Math.pow(1 + yearlyGrowthRate, index));
    });

    // Converter para arrays
    const monthlyResult = sortedMonthKeys.map(key => monthlyData[key]);
    const yearlyResult = sortedYearKeys.map(key => yearlyData[key]);

    return {
      monthly: monthlyResult,
      yearly: yearlyResult
    };
  },
});