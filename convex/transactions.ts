import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const create = mutation({
  args: {
    transactionId: v.string(),
    eventId: v.id("events"),
    userId: v.string(),
    customerId: v.string(),
    amount: v.number(),
    status: v.string(),
    paymentMethod: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("transactions", {
      ...args,
      createdAt: Date.now(), // Adicionar o timestamp atual
    });
  },
});

export const getByTransactionId = query({
  args: {
    transactionId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.transactionId) {
      return null;
    }
    
    const transaction = await ctx.db
      .query("transactions")
      .withIndex("by_transactionId", (q) => q.eq("transactionId", args.transactionId))
      .first();
      
    return transaction;
  },
});

export const updateStatus = mutation({
  args: {
    transactionId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db
      .query("transactions")
      .withIndex("by_transactionId", (q) => q.eq("transactionId", args.transactionId))
      .first();
    if (!tx) throw new Error("Transação não encontrada");
    await ctx.db.patch(tx._id, { status: args.status });
  },
});