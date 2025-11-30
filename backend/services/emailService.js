const nodemailer = require('nodemailer');

const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_SECURE,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM,
} = process.env;

if (!EMAIL_USER || !EMAIL_PASS) {
  console.warn('Email credentials are not fully configured. Check EMAIL_USER and EMAIL_PASS in your .env file.');
}

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST || 'smtp.gmail.com',
  port: Number(EMAIL_PORT) || 587,
  secure: EMAIL_SECURE === 'true',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

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
  console.log("entrei no sendEmail");
  if (!to) throw new Error('Missing "to" when calling sendEmail.');
  if (!subject) throw new Error('Missing "subject" when calling sendEmail.');

  const message = {
    from: from || EMAIL_FROM || EMAIL_USER,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(message);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send email:', error.message);
    throw error;
  }
};

module.exports = { sendEmail };