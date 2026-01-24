'use server';

import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { sendOneSignalToPlayers } from "@/lib/onesignal";

interface SendWithdrawalNotificationParams {
  organizationName: string;
  amount: string;
  requesterName: string;
  withdrawalId?: string;
}

export async function sendWithdrawalNotification({
  organizationName,
  amount,
  requesterName,
  withdrawalId
}: SendWithdrawalNotificationParams) {
  try {
    const convex = getConvexClient();
    
    // Buscar IDs dos admins
    const adminPlayerIds = await convex.query(api.admin.getAdminOneSignalPlayerIds);
    
    if (!adminPlayerIds || adminPlayerIds.length === 0) {
      return { success: true, message: "No admins to notify" };
    }
    
    const title = "Nova Solicitação de Saque 💰";
    const message = `${organizationName} solicitou saque de ${amount}. Solicitante: ${requesterName}`;
    
    const res = await sendOneSignalToPlayers({
      playerIds: adminPlayerIds,
      title,
      message,
      data: { 
        type: "withdrawal_request",
        withdrawalId
      }
    });
    
    return { success: res.ok };
  } catch (error) {
    console.error("Error sending withdrawal notification:", error);
    return { success: false, error };
  }
}