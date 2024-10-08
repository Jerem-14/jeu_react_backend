import nodemailer from 'nodemailer'; // Assurez-vous d'avoir installé nodemailer

export async function sendConfirmationEmail(userEmail, htmlTemplate) {
  const transporter = nodemailer.createTransport({
    host: 'ssl0.ovh.net',
    port: 465,
    secure: true,
    auth: {
      user: 'webmaster@jeremyaubry.fr',
      pass: 'webmaster', // Utilisez des variables d'environnement pour plus de sécurité
    },
    tls: {
        ciphers: 'SSLv3' // Cela peut aider à résoudre certains problèmes de compatibilité
      }
  });

  const mailOptions = {
    from: 'webmaster@jeremyaubry.fr',
    to: userEmail,
    subject: 'Confirmation d\'email',
    html: htmlTemplate,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email envoyé avec succès');
    return null; // No errors, return null
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    return error; // Return the error
  }
}
