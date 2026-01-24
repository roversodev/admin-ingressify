"use server";

import { MercadoPagoConfig, PaymentRefund } from 'mercadopago';

export async function processRefund(paymentId: string, reason?: string) {
  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    
    if (!accessToken) {
      return { success: false, error: "Token de acesso do Mercado Pago não configurado (MERCADO_PAGO_ACCESS_TOKEN)." };
    }

    const client = new MercadoPagoConfig({ accessToken });
    const paymentRefund = new PaymentRefund(client);

    const result = await paymentRefund.create({
      payment_id: paymentId,
    });

    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("Erro ao processar reembolso:", error);
    return { success: false, error: error.message || "Erro desconhecido ao processar reembolso." };
  }
}