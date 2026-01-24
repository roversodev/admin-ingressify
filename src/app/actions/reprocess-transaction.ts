"use server";

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getConvexClient } from "@/lib/convex";
import { api } from "@/api";
import { sendOneSignalToPlayers } from "@/lib/onesignal";

export async function checkTransactionStatusMP(paymentId: string) {
  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    
    if (!accessToken) {
      return { success: false, error: "Token de acesso do Mercado Pago não configurado." };
    }

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    const paymentData = await payment.get({ id: paymentId });

    return { 
      success: true, 
      status: paymentData.status,
      statusDetail: paymentData.status_detail,
      paymentData: JSON.parse(JSON.stringify(paymentData)) 
    };
  } catch (error: any) {
    console.error("Erro ao verificar status no Mercado Pago:", error);
    return { success: false, error: error.message || "Erro ao verificar status no Mercado Pago." };
  }
}

export async function sendPushNotification({
    email,
    eventName,
    transactionId
}: {
    email: string,
    eventName: string,
    transactionId: string
}) {
    try {
        const convex = getConvexClient();
        const userCheck = await convex.query(api.users.checkUserExistsByEmail, { email });

        if (userCheck.exists && userCheck.user) {
            const playerIds = await convex.query(api.users.getUserOneSignalPlayerIds, { userId: userCheck.user.userId });

            if (playerIds && playerIds.length > 0) {
                await sendOneSignalToPlayers({
                    playerIds,
                    title: "Compra Confirmada! 🎟️",
                    message: `Seus ingressos para ${eventName} estão disponíveis.`,
                    data: {
                        type: "ticket_purchase",
                        transactionId: transactionId
                    }
                });
                return { success: true };
            }
            return { success: false, reason: "no_player_ids" };
        }
        return { success: false, reason: "user_not_found" };
    } catch (error: any) {
        console.error("Erro ao enviar push notification:", error);
        return { success: false, error: error.message };
    }
}