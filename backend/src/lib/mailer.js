import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

// Support both MAIL_SEND_API_TOKEN and mail_send_api_token
const MAILERSEND_API_TOKEN = process.env.MAIL_SEND_API_TOKEN || process.env.mail_send_api_token;

let mailer = null;
if (MAILERSEND_API_TOKEN) {
  try {
    mailer = new MailerSend({ apiKey: MAILERSEND_API_TOKEN });
  } catch (e) {
    console.error('Failed to initialize MailerSend:', e);
  }
} else {
  console.warn('MailerSend API token missing (MAIL_SEND_API_TOKEN or mail_send_api_token). Emails disabled.');
}

// Basic sender. Configure your verified sender in MailerSend dashboard.
const defaultFromEmail = process.env.MAIL_FROM_EMAIL || 'no-reply@secril.me';
const defaultFromName = process.env.MAIL_FROM_NAME || 'Secril';

function buildTemplates(order, status, options = {}) {
  const orderId = order?.id || '';
  const price = order?.price != null ? order.price : '';
  const statusReadable = status;

  // Subjects by status
  const subjects = {
    created: `הזמנה חדשה #${orderId}`,
    'payment_verified': `התשלום נקלט להזמנה #${orderId}`,
    'ממתינה': `ההזמנה #${orderId} התקבלה`,
    confirmed: `ההזמנה #${orderId} אושרה`,
    shipped: `ההזמנה #${orderId} נשלחה`,
    delivered: `ההזמנה #${orderId} נמסרה`,
    cancelled: `ההזמנה #${orderId} בוטלה`,
    failed: `תשלום נכשל להזמנה #${orderId}`,
  };

  const subject = subjects[status] || `עדכון סטטוס להזמנה #${orderId}`;

  const baseIntro = `שלום,
קיבלנו עדכון להזמנה שלך #${orderId} בסכום ₪${price}.`;

  const bodies = {
    created: `${baseIntro}
ההזמנה נקלטה במערכת. תוכל לעקוב אחר ההזמנה שלך תחת "ההזמנות שלי".`,
    'payment_verified': `${baseIntro}
התשלום נקלט בהצלחה. אנו מתחילים בטיפול בהזמנה. אפשר לעקוב תחת "ההזמנות שלי".`,
    'ממתינה': `${baseIntro}
ההזמנה התקבלה וממתינה לטיפול. ניתן לעקוב תחת "ההזמנות שלי".`,
    confirmed: `${baseIntro}
ההזמנה אושרה ותעובד בקרוב.`,
    shipped: `${baseIntro}
ההזמנה נשלחה אליך!`,
    delivered: `${baseIntro}
ההזמנה נמסרה. נשמח לשמוע ממך משוב.`,
    cancelled: `${baseIntro}
ההזמנה בוטלה. אם זה לא בוצע על ידך, צור קשר עם התמיכה.`,
    failed: `${baseIntro}
התשלום נכשל. ניתן לנסות שוב מהחשבון שלך.`,
  };

  const text = bodies[status] || `${baseIntro}\nסטטוס נוכחי: ${statusReadable}`;

  // Simple HTML version
  const html = text
    .split('\n')
    .map(line => `<p>${line.replace(/"/g, '&quot;')}</p>`) // basic escaping for quotes
    .join('');

  return { subject, text, html };
}

export async function sendOrderEmail({ toEmail, toName, order, status, fromEmail, fromName }) {
  if (!mailer) return { ok: false, skipped: true, reason: 'mailer_not_configured' };
  if (!toEmail) return { ok: false, skipped: true, reason: 'missing_to_email' };

  const { subject, text, html } = buildTemplates(order, status);

  const sentFrom = new Sender(fromEmail || defaultFromEmail, fromName || defaultFromName);
  const recipients = [new Recipient(toEmail, toName || '')];

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject(subject)
    .setHtml(html)
    .setText(text);

  try {
    const response = await mailer.email.send(emailParams);
    return { ok: true, response };
  } catch (e) {
    console.error('Failed to send order email:', e);
    return { ok: false, error: e?.message || 'send_failed' };
  }
}

// Convenience wrappers
export async function sendOrderCreatedEmail({ toEmail, toName, order }) {
  return sendOrderEmail({ toEmail, toName, order, status: 'created' });
}

export async function sendOrderStatusEmail({ toEmail, toName, order, status }) {
  return sendOrderEmail({ toEmail, toName, order, status });
}


