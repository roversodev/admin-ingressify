'use server';

import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { sendOneSignalToPlayers } from "@/lib/onesignal";

interface SendEventCreatedNotificationParams {
  eventName: string;
  organizerName: string;
  eventId: string;
  slug: string;
}

export async function sendEventCreatedNotification({
  eventName,
  organizerName,
  eventId,
  slug
}: SendEventCreatedNotificationParams) {
  try {
    const convex = getConvexClient();
    
    // Buscar IDs dos admins
    const adminPlayerIds = await convex.query(api.admin.getAdminOneSignalPlayerIds);
    
    if (!adminPlayerIds || adminPlayerIds.length === 0) {
      return { success: true, message: "No admins to notify" };
    }
    
    const title = "Novo Evento Criado! 🎉";
    const message = `O evento "${eventName}" foi criado por ${organizerName}.`;
    
    const res = await sendOneSignalToPlayers({
      playerIds: adminPlayerIds,
      title,
      message,
      data: { 
        type: "new_event",
        eventId,
        slug
      }
    });
    
    return { success: res.ok };
  } catch (error) {
    console.error("Error sending event created notification:", error);
    return { success: false, error };
  }
}