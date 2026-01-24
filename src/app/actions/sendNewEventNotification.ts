"use server";

import { getConvexClient } from "@/lib/convex";
import { api } from "@/api";
import { sendOneSignalToPlayers } from "@/lib/onesignal";

export async function sendNewEventNotification({
  eventName,
  eventId,
  slug,
  userName,
  userTelefone
}: {
  eventName: string;
  eventId: string;
  slug: string;
  userName: string;
  userTelefone: string;
}) {
  try {
    const convex = getConvexClient();
    
    // Buscar Player IDs de todos os admins
    const adminPlayerIds = await convex.query(api.admin.getAdminOneSignalPlayerIds);

    if (adminPlayerIds && adminPlayerIds.length > 0) {
      await sendOneSignalToPlayers({
        playerIds: adminPlayerIds,
        title: "Novo Evento Criado! 🎉",
        message: `O evento "${eventName}" foi criado na plataforma.`,
        data: {
          type: "new_event_created",
          eventId,
          slug
        }
      });
      console.log(`Notificação de novo evento enviada para ${adminPlayerIds.length} admins.`);
    }
    
    return { success: true };
  } catch (error) {
    console.error("Erro ao enviar notificação de novo evento:", error);
    return { success: false, error };
  }
}