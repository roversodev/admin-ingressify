'use server';

import { getConvexClient } from "@/lib/convex";
import { api } from "@/api";
import { sendOneSignalToPlayers } from "@/lib/onesignal";
import { type GenericId as Id } from "convex/values";


interface SendOfflineSaleNotificationParams {
  eventId: string;
  promoterName: string;
  ticketTypeName: string;
  quantity: number;
  totalAmount: string;
}

export async function sendOfflineSaleNotification({
  eventId,
  promoterName,
  ticketTypeName,
  quantity,
  totalAmount,
}: SendOfflineSaleNotificationParams) {
  try {
    const convex = getConvexClient();

    // 1. Get event data to find organization
    const eventData = await convex.query(api.events.getEventEmailData, { 
      eventId: eventId as Id<"events"> 
    });

    if (!eventData?.organizationId) {
      console.warn(`Event ${eventId} has no organizationId`);
      return { success: false, reason: "no_organization" };
    }

    // 2. Get organization members
    const members = await convex.query(api.organizations.getOrganizationMembers, {
      organizationId: eventData.organizationId,
    });

    // 3. Get OneSignal player IDs for all members
    const allPlayerIdsNested = await Promise.all(
      (members || []).map((m: { userId: any; }) =>
        convex.query(api.users.getUserOneSignalPlayerIds, { userId: m.userId })
      )
    );
    const allPlayerIds = Array.from(new Set(allPlayerIdsNested.flat().filter(Boolean)));

    if (allPlayerIds.length === 0) {
      return { success: true, message: "No players to notify" };
    }

    // 4. Send notification
    const title = "Nova venda offline!";
    const message = `${promoterName} vendeu ${quantity}x ${ticketTypeName} - ${totalAmount}`;

    const res = await sendOneSignalToPlayers({
      playerIds: allPlayerIds,
      title,
      message,
      data: {
        eventId,
        type: "offline_sale",
      },
    });

    return { success: res.ok };
  } catch (error) {
    console.error("Error sending offline sale notification:", error);
    return { success: false, error };
  }
}