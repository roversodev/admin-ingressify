'use server';

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
  throw new Error('Missing WhatsApp env vars: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
}

type SendTemplateOptions = {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
  headerParameters?: string[];
  components?: Array<{
    type: 'body' | 'header';
    parameters: Array<{ type: 'text'; text: string; parameter_name?: string }>;
  }>;
};

function normalizeBrazilE164(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

export async function sendWhatsAppTemplateMessage(opts: SendTemplateOptions) {
  const { to, templateName, languageCode = 'pt_BR', bodyParameters = [], headerParameters = [], components } = opts;
  const toE164 = normalizeBrazilE164(to);
  const url = `https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const template: any = { name: templateName, language: { code: languageCode, policy: 'deterministic' } };
  if (components && components.length > 0) {
    template.components = components;
  } else {
    const comps: any[] = [];
    if (headerParameters.length > 0) comps.push({ type: 'header', parameters: headerParameters.map((text) => ({ type: 'text', text })) });
    if (bodyParameters.length > 0) comps.push({ type: 'body', parameters: bodyParameters.map((text) => ({ type: 'text', text })) });
    if (comps.length > 0) template.components = comps;
  }

  const payload = { messaging_product: 'whatsapp', to: toE164, type: 'template', template };

  console.log('whatsapp_template_request', { url, to: toE164, templateName, languageCode, payload });
  try {
    console.log('whatsapp_template_request_payload', JSON.stringify(payload, null, 2));
  } catch {}
  let res: Response;
  let data: any;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await res.json();
  } catch (err) {
    console.error('whatsapp_template_fetch_error', err);
    throw err;
  }
  console.log('whatsapp_template_response', { status: res.status, ok: res.ok, data });
  if (!res.ok) {
    const errMsg = data?.error?.message || `HTTP ${res.status}`;
    const errCode = data?.error?.code;
    const errDetails = data?.error?.error_subcode || data?.error?.error_data?.details || data?.error?.details;
    console.error('whatsapp_template_error', { errMsg, errCode, errDetails, error: data?.error, payload });
    throw new Error(`WhatsApp send failed: ${errMsg} (code ${errCode} sub ${errDetails})`);
  }
  return data;
}

export async function sendWhatsAppTextMessage(to: string, text: string) {
  const toE164 = normalizeBrazilE164(to);
  const url = `https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = { messaging_product: 'whatsapp', to: toE164, text: { body: text } };
  console.log('whatsapp_text_request', { url, to: toE164, payload });
  let res: Response;
  let data: any;
  try {
    res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    data = await res.json();
  } catch (err) {
    console.error('whatsapp_text_fetch_error', err);
    throw err;
  }
  console.log('whatsapp_text_response', { status: res.status, ok: res.ok, data });
  if (!res.ok) {
    const errMsg = data?.error?.message || `HTTP ${res.status}`;
    const errCode = data?.error?.code;
    const errDetails = data?.error?.error_subcode || data?.error?.details;
    console.error('whatsapp_text_error', { errMsg, errCode, errDetails, error: data?.error, payload });
    throw new Error(`WhatsApp send failed: ${errMsg} (code ${errCode} sub ${errDetails})`);
  }
  return data;
}

export async function sendCompraIngressoMessage(to: string, name: string, event: string, languageCode: string = 'pt_BR') {
  return sendWhatsAppTemplateMessage({
    to,
    templateName: 'compra_ingresso',
    languageCode,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: name, parameter_name: 'name' },
          { type: 'text', text: event, parameter_name: 'event' },
        ],
      },
    ],
  });
}

export async function getWhatsAppTemplateDefinition(templateName: string) {
  const WABA_ID = process.env.WHATSAPP_WABA_ID;
  if (!WABA_ID) {
    throw new Error('Missing WhatsApp env var: WHATSAPP_WABA_ID');
  }
  const url = `https://graph.facebook.com/v22.0/${WABA_ID}/message_templates?fields=name,language,components`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } });
  const data = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Failed to list templates: ${errMsg}`);
  }
  const match = (data?.data || []).find((t: any) => t?.name === templateName);
  return match || null;
}
