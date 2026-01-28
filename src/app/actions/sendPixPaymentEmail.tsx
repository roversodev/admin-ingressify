'use server';

import { Resend } from 'resend';
import { 
  Body, 
  Column, 
  Container, 
  Head, 
  Hr, 
  Html, 
  Img, 
  Link, 
  Preview, 
  Row, 
  Section, 
  Text, 
} from '@react-email/components';

const baseUrl = 'https://ingressify.com.br';

interface PixEmailProps {
  customerName?: string;
  eventName: string;
  eventDate: number;
  eventLocation: string;
  tickets: Array<{
    type: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  transactionId: string;
  qrCodeText: string;
  qrCodeImageUrl: string;
  pixExpiresAt: string;
}

const IngressifyPixEmail = ({
  customerName,
  eventName,
  eventDate,
  eventLocation,
  tickets,
  totalAmount,
  transactionId,
  qrCodeText,
  qrCodeImageUrl,
  pixExpiresAt,
}: PixEmailProps) => {
  const eventDateFormatted = new Date(eventDate).toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const pixExpiresAtFormatted = new Date(pixExpiresAt).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Html>
      <Head />
      <Preview>Lembrete: Seu pagamento PIX para {eventName} está pendente!</Preview>
      
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section>
            <Row>
              <Column>
                <Img
                  src={`${baseUrl}/logo.png`}
                  width="200"
                  height="40"
                  alt="Ingressify"
                  style={logo}
                />
              </Column>
              <Column align="right" style={tableCell}>
                <Text style={heading}>Pagamento PIX</Text>
              </Column>
            </Row>
          </Section>

          {/* Promotional Banner */}
          <Section>
            <Text style={promoText}>
              🎟️ Seu código PIX foi gerado! Realize o pagamento para garantir seus ingressos.
            </Text>
          </Section>

          {/* Customer & Event Information */}
          <Section style={informationTable}>
            {customerName && (
              <Row>
                <Column style={informationTableColumn}>
                  <Text style={informationTableLabel}>CLIENTE</Text>
                  <Text style={informationTableValue}>{customerName}</Text>
                </Column>
              </Row>
            )}

            <Row>
              <Column style={informationTableColumn}>
                <Text style={informationTableLabel}>EVENTO</Text>
                <Text style={informationTableValue}>{eventName}</Text>
              </Column>
            </Row>

            <Row>
              <Column style={informationTableColumn}>
                <Text style={informationTableLabel}>DATA & HORA</Text>
                <Text style={informationTableValue}>{eventDateFormatted}</Text>
              </Column>
            </Row>

            <Row>
              <Column style={informationTableColumn}>
                <Text style={informationTableLabel}>LOCAL</Text>
                <Text style={informationTableValue}>{eventLocation}</Text>
              </Column>
            </Row>
          </Section>

          {/* PIX QR Code Section */}
          <Section style={pixSection}>
            <Text style={pixTitle}>Pagamento PIX</Text>
            <Text style={pixSubtitle}>Escaneie o QR Code ou use o código PIX abaixo:</Text>
            
            <Row>
              <Column align="center">
                <Img
                  src={qrCodeImageUrl}
                  width="200"
                  height="200"
                  alt="QR Code PIX"
                  style={qrCodeImage}
                />
              </Column>
            </Row>
            
            <Row>
              <Column style={pixCodeContainer}>
                <Text style={pixCodeLabel}>CÓDIGO PIX COPIA E COLA:</Text>
                <Text style={pixCodeValue}>{qrCodeText}</Text>
              </Column>
            </Row>
            
            <Row>
              <Column>
                <Text style={pixExpirationText}>
                  ⏰ Este código PIX expira em: {pixExpiresAtFormatted}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Tickets Section */}
          <Section style={productTitleTable}>
            <Text style={productsTitle}>Seus Ingressos</Text>
          </Section>

          {tickets.map((ticket, index) => (
            <Section key={index}>
              <Row>
                <Column style={{ width: '64px' }}>
                  <div style={ticketIcon}>🎟️</div>
                </Column>
                <Column style={{ paddingLeft: '22px' }}>
                  <Text style={productTitle}>{ticket.type}</Text>
                  <Text style={productDescription}>Quantidade: {ticket.quantity}x</Text>
                </Column>
                <Column style={productPriceWrapper} align="right">
                  <Text style={productPrice}>R$ {(ticket.unitPrice * ticket.quantity).toFixed(2)}</Text>
                </Column>
              </Row>
              {index < tickets.length - 1 && <Hr style={productPriceLine} />}
            </Section>
          ))}

          <Hr style={productPriceLine} />
          
          {/* Total */}
          <Section align="right">
            <Row>
              <Column style={tableCell} align="right">
                <Text style={productPriceTotal}>TOTAL</Text>
              </Column>
              <Column style={productPriceVerticalLine} />
              <Column style={productPriceLargeWrapper}>
                <Text style={productPriceLarge}>R$ {totalAmount.toFixed(2)}</Text>
              </Column>
            </Row>
          </Section>
          
          <Hr style={productPriceLineBottom} />

          {/* Instruções de Pagamento */}
          <Section style={instructionsSection}>
            <Text style={instructionsTitle}>Como pagar com PIX:</Text>
            <Text style={instructionsText}>1. Abra o aplicativo do seu banco</Text>
            <Text style={instructionsText}>2. Vá até a área de PIX</Text>
            <Text style={instructionsText}>3. Selecione PIX Copia e Cola ou Ler QR code</Text>
            <Text style={instructionsText}>4. Efetue o pagamento e clique em confirmar</Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © 2025 Ingressify. Todos os direitos reservados.
            </Text>
            <Text style={footerText}>
              Este e-mail foi enviado automaticamente, não responda.
            </Text>
            <Text style={footerText}>
              ID da Transação: {transactionId}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export async function sendPixPaymentEmail({
  to,
  customerName,
  eventName,
  eventDate,
  eventLocation,
  tickets,
  totalAmount,
  transactionId,
  qrCodeText,
  qrCodeImageUrl,
  pixExpiresAt,
}: {
  to: string;
  customerName?: string;
  eventName: string;
  eventDate: number;
  eventLocation: string;
  tickets: Array<{
    type: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  transactionId: string;
  qrCodeText: string;
  qrCodeImageUrl: string;
  pixExpiresAt: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'Ingressify <pix@ingressify.com.br>',
      to,
      subject: `🎟️ Seu pagamento PIX para ${eventName} foi gerado!`,
      react: IngressifyPixEmail({
        customerName,
        eventName,
        eventDate,
        eventLocation,
        tickets,
        totalAmount,
        transactionId,
        qrCodeText,
        qrCodeImageUrl,
        pixExpiresAt,
      }),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao enviar email de pagamento PIX:', error);
    return { success: false, error };
  }
}

// Styles
const main = {
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  backgroundColor: '#ffffff',
};

const resetText = {
  margin: '0',
  padding: '0',
  lineHeight: 1.4,
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const tableCell = { display: 'table-cell' };

const heading = {
  fontSize: '12px',
  fontWeight: '300',
  color: '#888888',
};

const logo = {
  margin: '0 0 10px 0',
};

const promoText = {
  color: '#000',
  fontSize: '14px',
  fontWeight: '500',
  textAlign: 'center' as const,
  backgroundColor: '#f6f9fc',
  padding: '12px 20px',
  borderRadius: '8px',
  margin: '20px 0',
};

const informationTable = {
  borderCollapse: 'collapse' as const,
  borderSpacing: '0px',
  color: 'rgb(51,51,51)',
  backgroundColor: 'rgb(250,250,250)',
  borderRadius: '3px',
  fontSize: '12px',
  marginTop: '12px',
};

const informationTableColumn = {
  padding: '12px 20px',
  borderStyle: 'solid',
  borderColor: 'white',
  borderWidth: '0px 1px 1px 0px',
};

const informationTableLabel = {
  fontSize: '10px',
  color: 'rgb(102,102,102)',
  ...resetText,
};

const informationTableValue = {
  fontSize: '12px',
  color: 'rgb(51,51,51)',
  ...resetText,
};

const pixSection = {
  backgroundColor: '#f0f7ff',
  padding: '20px',
  borderRadius: '8px',
  margin: '20px 0',
  textAlign: 'center' as const,
};

const pixTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1a56db',
  margin: '0 0 10px 0',
  textAlign: 'center' as const,
};

const pixSubtitle = {
  fontSize: '14px',
  color: '#4a5568',
  margin: '0 0 20px 0',
  textAlign: 'center' as const,
};

const qrCodeImage = {
  margin: '0 auto 20px auto',
  border: '1px solid #e2e8f0',
  padding: '10px',
  backgroundColor: 'white',
  borderRadius: '4px',
};

const pixCodeContainer = {
  backgroundColor: 'white',
  padding: '15px',
  borderRadius: '4px',
  border: '1px solid #e2e8f0',
  margin: '0 auto 20px auto',
  maxWidth: '80%',
};

const pixCodeLabel = {
  fontSize: '10px',
  color: '#4a5568',
  fontWeight: 'bold',
  margin: '0 0 5px 0',
  textAlign: 'center' as const,
};

const pixCodeValue = {
  fontSize: '12px',
  color: '#2d3748',
  wordBreak: 'break-all' as const,
  textAlign: 'center' as const,
  fontFamily: 'monospace',
};

const pixExpirationText = {
  fontSize: '12px',
  color: '#e53e3e',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '10px 0 0 0',
};

const productTitleTable = {
  margin: '30px 0 15px 0',
  borderCollapse: 'collapse' as const,
};

const productsTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: 'rgb(51,51,51)',
  ...resetText,
};

const ticketIcon = {
  fontSize: '30px',
  textAlign: 'center' as const,
};

const productTitle = {
  fontSize: '14px',
  color: 'rgb(51,51,51)',
  fontWeight: '500',
  ...resetText,
};

const productDescription = {
  fontSize: '12px',
  color: 'rgb(102,102,102)',
  ...resetText,
};

const productPriceWrapper = {
  display: 'table-cell',
  padding: '0 20px 0 0',
};

const productPrice = {
  fontSize: '13px',
  color: 'rgb(51,51,51)',
  fontWeight: '600',
  ...resetText,
};

const productPriceLine = {
  margin: '12px 0',
  borderStyle: 'solid',
  borderColor: 'rgb(238,238,238)',
  borderWidth: '1px 0 0 0',
};

const productPriceVerticalLine = {
  display: 'table-cell',
  height: '48px',
  borderStyle: 'solid',
  borderColor: 'rgb(238,238,238)',
  borderWidth: '0 1px 0 0',
};

const productPriceTotal = {
  fontSize: '13px',
  color: 'rgb(102,102,102)',
  ...resetText,
  fontWeight: '500',
  padding: '0 15px 0 0',
};

const productPriceLargeWrapper = {
  display: 'table-cell',
  padding: '0 20px 0 15px',
};

const productPriceLarge = {
  fontSize: '16px',
  color: 'rgb(51,51,51)',
  fontWeight: '600',
  ...resetText,
};

const productPriceLineBottom = {
  margin: '20px 0',
  borderStyle: 'solid',
  borderColor: 'rgb(238,238,238)',
  borderWidth: '1px 0 0 0',
};

const instructionsSection = {
  backgroundColor: '#f9fafb',
  padding: '20px',
  borderRadius: '8px',
  margin: '20px 0',
};

const instructionsTitle = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#4a5568',
  margin: '0 0 10px 0',
};

const instructionsText = {
  fontSize: '12px',
  color: '#4a5568',
  margin: '0 0 5px 0',
};

const footer = {
  textAlign: 'center' as const,
  margin: '20px 0',
};

const footerText = {
  fontSize: '12px',
  color: 'rgb(102,102,102)',
  margin: '4px 0',
};