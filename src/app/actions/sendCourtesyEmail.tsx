"use server";

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

interface CourtesyEmailProps {
  recipientName?: string;
  eventName: string;
  ticketType: string;
  quantity: number;
  customMessage?: string;
  ticketId: string;
  eventImageUrl?: string;
}

const IngressifyCourtesyEmail = ({
  recipientName,
  eventName,
  ticketType,
  quantity,
  customMessage,
  ticketId,
  eventImageUrl,
}: CourtesyEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>🎉 Você recebeu ingressos cortesia para {eventName}!</Preview>
      
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
                <Text style={heading}>Cortesia</Text>
              </Column>
            </Row>
          </Section>

          {/* Promotional Banner */}
          <Section>
            <Text style={promoText}>
              🎉 Você recebeu ingressos cortesia! Apresente seu QR Code na entrada do evento.
            </Text>
          </Section>

          {/* Recipient & Event Information */}
          <Section style={informationTable}>
            {recipientName && (
              <Row>
                <Column style={informationTableColumn}>
                  <Text style={informationTableLabel}>DESTINATÁRIO</Text>
                  <Text style={informationTableValue}>{recipientName}</Text>
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
                <Text style={informationTableLabel}>TIPO DE INGRESSO</Text>
                <Text style={informationTableValue}>{ticketType}</Text>
              </Column>
            </Row>

            <Row>
              <Column style={informationTableColumn}>
                <Text style={informationTableLabel}>QUANTIDADE</Text>
                <Text style={informationTableValue}>{quantity} ingresso(s)</Text>
              </Column>
            </Row>
          </Section>

          {/* Custom Message */}
          {customMessage && (
            <Section style={messageSection}>
              <Text style={messageTitle}>Mensagem Especial</Text>
              <Text style={messageText}>{customMessage}</Text>
            </Section>
          )}

          {/* Tickets Section */}
          <Section style={productTitleTable}>
            <Text style={productsTitle}>Seus Ingressos Cortesia</Text>
          </Section>

          <Section>
            <Row>
              <Column style={{ width: '64px' }}>
                {eventImageUrl ? (
                  <Img
                    src={eventImageUrl}
                    width="64"
                    height="64"
                    alt={eventName}
                    style={{
                      objectFit: 'cover',
                      width: '64px !important',
                      height: '64px !important',
                      minWidth: '64px',
                      minHeight: '64px',
                      maxWidth: '64px',
                      maxHeight: '64px',
                      borderRadius: '8px',
                      display: 'block'
                    }}
                  />
                ) : (
                  <div style={ticketIcon}>🎟️</div>
                )}
              </Column>
              <Column style={{ paddingLeft: '22px' }}>
                <Text style={productTitle}>{ticketType}</Text>
                <Text style={productDescription}>Quantidade: {quantity}x</Text>
                <Text style={productDescription}>ID: {ticketId}</Text>
                <Text style={productDescription}>Tipo: Cortesia</Text>
              </Column>
              <Column style={productPriceWrapper} align="right">
                <Text style={productPrice}>GRATUITO</Text>
              </Column>
            </Row>
          </Section>

          <Hr style={productPriceLine} />
          
          {/* CTA Section */}
          <Section>
            <Row>
              <Column align="center" style={ctaTitle}>
                <Text style={ctaText}>Acesse seus ingressos a qualquer momento</Text>
              </Column>
            </Row>
          </Section>
          
          <Section>
            <Row>
              <Column align="center" style={walletWrapper}>
                <Link href={`${baseUrl}/tickets/${ticketId}`} style={walletLink}>
                  <Text style={walletLinkText}>Ver Meus Ingressos</Text>
                </Link>
              </Column>
            </Row>
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
              Guarde este email! Você precisará apresentar seus ingressos na entrada do evento.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export async function sendCourtesyEmail({
  to,
  recipientName,
  eventName,
  ticketType,
  quantity,
  customMessage,
  ticketId,
  eventImageUrl, // Novo parâmetro
}: {
  to: string;
  recipientName?: string;
  eventName: string;
  ticketType: string;
  quantity: number;
  customMessage?: string;
  ticketId: string;
  eventImageUrl?: string; // Nova propriedade
}) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is missing');
    return { success: false, error: 'RESEND_API_KEY is missing' };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'Ingressify <confirmacao@ingressify.com.br>',
      to,
      subject: `🎟️ Seus ingressos cortesia para ${eventName}`,
      react: IngressifyCourtesyEmail({
        recipientName,
        eventName,
        ticketType,
        quantity,
        customMessage,
        ticketId,
        eventImageUrl,
      }),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao enviar email de cortesia:', error);
    return { success: false, error };
  }
}

// Styles (reutilizando os mesmos estilos do sendPurchaseEmail)
const main = {
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  backgroundColor: '#232323',
};

const resetText = {
  margin: '0',
  padding: '0',
  lineHeight: 1.4,
};

const container = {
  backgroundColor: '#232323',
  margin: '0 auto',
  padding: '20px 12px 48px',
  marginBottom: '64px',
};

const tableCell = { display: 'table-cell' };

const heading = {
  fontSize: '12px',
  fontWeight: '300',
  color: '#A3A3A3',
};

const logo = {
  margin: '0 0 10px 0',
};

const promoText = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '500',
  textAlign: 'center' as const,
  backgroundColor: '#232323',
  padding: '12px 20px',
  borderRadius: '8px',
  margin: '20px 0',
};

const informationTable = {
  borderCollapse: 'collapse' as const,
  borderSpacing: '0px',
  color: '#ffffff',
  backgroundColor: '#232323',
  borderRadius: '3px',
  fontSize: '12px',
  marginTop: '12px',
};

const informationTableColumn = {
  padding: '12px 20px',
  borderStyle: 'solid',
  borderColor: '#333333',
  borderWidth: '0px 1px 1px 0px',
  minHeight: '60px',
};

const informationTableLabel = {
  ...resetText,
  color: '#A3A3A3',
  fontSize: '10px',
  fontWeight: '500',
  textTransform: 'uppercase' as const,
};

const informationTableValue = {
  fontSize: '12px',
  margin: '0',
  padding: '0',
  lineHeight: 1.4,
  color: '#ffffff',
};

const messageSection = {
  backgroundColor: '#181818',
  padding: '20px',
  borderRadius: '8px',
  margin: '20px 0',
  borderLeft: '4px solid #E65CFF',
};

const messageTitle = {
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 10px 0',
  color: '#E65CFF',
};

const messageText = {
  fontSize: '14px',
  margin: '0',
  fontStyle: 'italic',
  color: '#ffffff',
};

const productTitleTable = {
  ...informationTable,
  margin: '30px 0 15px 0',
  height: '24px',
};

const productsTitle = {
  fontSize: '13px',
  fontWeight: '500',
  margin: '0',
  padding: '0 20px',
  lineHeight: '24px',
  color: '#ffffff',
};

const ticketIcon = {
  fontSize: '32px',
  margin: '0 0 0 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '64px',
  height: '64px',
  backgroundColor: '#232323',
  borderRadius: '12px',
};

const productTitle = {
  fontSize: '12px',
  fontWeight: '600',
  ...resetText,
  color: '#ffffff',
};

const productDescription = {
  fontSize: '12px',
  color: '#A3A3A3',
  ...resetText,
};

const productPrice = {
  fontSize: '12px',
  fontWeight: '600',
  margin: '0',
  color: '#4ADE80',
};

const productPriceWrapper = {
  display: 'table-cell',
  padding: '0px 20px 0px 0px',
  width: '100px',
  verticalAlign: 'top',
};

const productPriceLine = { 
  margin: '30px 0 0 0',
  borderColor: '#333333',
};

const ctaTitle = {
  display: 'table-cell',
  padding: '0 0 10px 0',
};

const ctaText = {
  fontSize: '16px',
  fontWeight: '500',
  margin: '0',
  color: '#ffffff',
};

const walletWrapper = { display: 'table-cell' };

const walletLink = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  backgroundColor: '#E65CFF',
  padding: '12px 24px',
  borderRadius: '8px',
  display: 'inline-block',
};

const walletLinkText = {
  fontSize: '14px',
  fontWeight: '600',
  margin: '0',
};

const footer = {
  marginTop: '40px',
  paddingTop: '20px',
  borderTop: '1px solid #333333',
};

const footerText = {
  fontSize: '12px',
  color: '#A3A3A3',
  textAlign: 'center' as const,
  margin: '5px 0',
};