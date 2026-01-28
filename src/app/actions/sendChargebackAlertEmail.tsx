'use server';

import { Resend } from 'resend';
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

type ChargebackEmailProps = {
  eventName: string;
  amount: number;
  transactionId: string;
  paymentMethod?: string;
};

function ChargebackAlertEmail({
  eventName,
  amount,
  transactionId,
  paymentMethod,
}: ChargebackEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Chargeback registrado — {eventName}</Preview>
      <Body style={{ backgroundColor: '#0B0B0B', color: '#FFFFFF', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ padding: '24px' }}>
          <Section>
            <Text style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              Chargeback registrado
            </Text>
            <Text style={{ color: '#A3A3A3' }}>
              Detectamos um chargeback relacionado ao evento:
            </Text>
            <Text style={{ fontSize: '16px', fontWeight: 600, marginTop: '8px' }}>
              {eventName}
            </Text>
          </Section>

          <Hr style={{ borderColor: '#333333' }} />

          <Section>
            <Text style={{ margin: '4px 0' }}>
              Valor: <strong>{formatCurrency(amount)}</strong>
            </Text>
            <Text style={{ margin: '4px 0' }}>
              Transação: <strong>{transactionId}</strong>
            </Text>
            {paymentMethod && (
              <Text style={{ margin: '4px 0' }}>
                Método de pagamento: <strong>{paymentMethod}</strong>
              </Text>
            )}
          </Section>

          <Hr style={{ borderColor: '#333333' }} />

          <Section>
            <Text style={{ color: '#A3A3A3', fontSize: '12px' }}>
              Este e-mail é automático para notificação interna. Em caso de dúvidas, acesse o dashboard para revisar a disputa.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function sendChargebackAlertEmail({
  eventName,
  amount,
  transactionId,
  paymentMethod,
}: ChargebackEmailProps) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'Ingressify <contato@ingressify.com.br>',
      to: 'contato@ingressify.com.br',
      subject: `⚠️ Chargeback registrado — ${eventName}`,
      react: ChargebackAlertEmail({ eventName, amount, transactionId, paymentMethod }),
    });
    return { success: true };
  } catch (error) {
    console.error('Erro ao enviar email de chargeback:', error);
    return { success: false, error };
  }
}