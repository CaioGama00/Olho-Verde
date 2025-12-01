require('dotenv').config();
const { sendEmail } = require('./services/emailService');

async function main() {
  try {
    await sendEmail({
      to: "rachelloriato@gmail.com",
      subject: "Teste de emailService",
      text: "Funcionando!",
    });

    console.log("OK - Email enviado");
  } catch (err) {
    console.error("Erro:", err);
  }
}

main();
