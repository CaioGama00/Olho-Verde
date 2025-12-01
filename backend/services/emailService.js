const axios = require('axios');
const nodemailer = require('nodemailer');

const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_SECURE,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM,
  RESEND_API_KEY,
} = process.env;

const RESEND_API_URL = 'https://api.resend.com/emails';
const smtpTransporter = EMAIL_USER && EMAIL_PASS
  ? nodemailer.createTransport({
      host: EMAIL_HOST || 'smtp.gmail.com',
      port: Number(EMAIL_PORT) || 587,
      secure: EMAIL_SECURE === 'true',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      family: 4, // force IPv4 to avoid IPv6 timeouts on some hosts
    })
  : null;

if (!RESEND_API_KEY && !smtpTransporter) {
  console.warn('Email provider is not configured. Set RESEND_API_KEY or EMAIL_USER/EMAIL_PASS.');
}

const sendWithSMTP = async (message) => {
  if (!smtpTransporter) {
    throw new Error('SMTP credentials are not configured.');
  }

  const info = await smtpTransporter.sendMail(message);
  return info;
};

const sendWithResend = async (message) => {
  try {
    const { data } = await axios.post(
      RESEND_API_URL,
      {
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return data;
  } catch (error) {
    const details = error.response?.data || error.message;
    console.error('Failed to send email via Resend:', details);
    throw new Error(typeof details === 'string' ? details : JSON.stringify(details));
  }
};

/**
 * Sends an email using the configured transporter.
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email(s).
 * @param {string} options.subject - Email subject.
 * @param {string} [options.text] - Plain-text body.
 * @param {string} [options.html] - HTML body.
 * @param {string} [options.from] - Custom sender address.
 */
const sendEmail = async ({ to, subject, text, html, from }) => {
  if (!to) throw new Error('Missing "to" when calling sendEmail.');
  if (!subject) throw new Error('Missing "subject" when calling sendEmail.');

  const sender = from || EMAIL_FROM || EMAIL_USER;
  if (!sender) throw new Error('Missing "from" address. Set EMAIL_FROM or EMAIL_USER.');

  const message = {
    from: sender,
    to,
    subject,
    text,
    html,
  };

  try {
    if (RESEND_API_KEY) {
      try {
        return await sendWithResend(message);
      } catch (err) {
        console.warn('Resend API failed, falling back to SMTP (if configured).', err?.message || err);
        if (smtpTransporter) {
          return await sendWithSMTP(message);
        }
        throw err;
      }
    }

    return await sendWithSMTP(message);
  } catch (error) {
    console.error('Failed to send email:', error.message);
    throw error;
  }
};

module.exports = { sendEmail };
