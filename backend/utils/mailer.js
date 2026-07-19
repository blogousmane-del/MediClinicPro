const nodemailer = require('nodemailer');

/**
 * Sends a welcome/confirmation email to the clinic admin after registration.
 * Supports real SMTP sending if configured, or falls back to console logging in dev mode.
 * 
 * @param {string} toEmail 
 * @param {string} adminName 
 * @param {string} clinicName 
 */
const sendConfirmationEmail = async (toEmail, adminName, clinicName) => {
  const host = process.env.SMTP_HOST || '';
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || '"MediClinic Pro" <no-reply@mediclinic.ci>';

  console.log(`[Email] Préparation de l'envoi de l'email de confirmation à : ${toEmail}`);

  let transporter;
  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });
  } else {
    // Development fallback to avoid registration blocking
    console.log("⚠️ Aucune configuration SMTP complète trouvée dans le fichier .env (SMTP_HOST, SMTP_USER, SMTP_PASS).");
    console.log("L'envoi d'email réel est désactivé. Voici le contenu de l'email de confirmation simulé :");
    console.log("==================================================================================");
    console.log(`DE : ${from}`);
    console.log(`À : ${toEmail}`);
    console.log(`SUJET : Bienvenue sur MediClinic Pro ! 🏥`);
    console.log(`MESSAGE :`);
    console.log(`Bonjour ${adminName},`);
    console.log(`Votre compte clinique pour l'établissement "${clinicName}" a été créé avec succès.`);
    console.log(`Profitez de vos 14 jours d'essai gratuit sur http://localhost:5173.`);
    console.log("==================================================================================");
    return { simulated: true };
  }

  // HTML content of the email (Premium styled email)
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1a202c;">
      <div style="text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 24px;">Bienvenue sur MediClinic Pro</h1>
        <p style="color: #718096; margin: 5px 0 0 0; font-size: 14px;">Votre solution de gestion clinique intelligente</p>
      </div>
      
      <div style="line-height: 1.6; font-size: 16px;">
        <p>Bonjour <strong>${adminName}</strong>,</p>
        
        <p>Nous avons le plaisir de vous confirmer la création de votre compte clinique pour l'établissement <strong>"${clinicName}"</strong>.</p>
        
        <p>Votre compte administrateur est désormais actif et vous bénéficiez dès aujourd'hui de <strong>14 jours d'essai gratuit</strong> avec accès complet à toutes les fonctionnalités (Dossier patient, Agenda, Pharmacie, Labo et Comptabilité).</p>
        
        <div style="background-color: #f7fafc; border-left: 4px solid #0d9488; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #2d3748; font-size: 16px;">Vos prochaines étapes :</h3>
          <ol style="margin-bottom: 0; padding-left: 20px;">
            <li>Complétez la configuration de votre établissement (adresse, horaires).</li>
            <li>Ajoutez les praticiens, secrétaires ou pharmaciens de votre équipe.</li>
            <li>Activez les modules dont vous avez besoin au quotidien.</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:5173" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accéder à mon espace clinique</a>
        </div>
        
        <p>Si vous avez des questions, notre support est à votre disposition par WhatsApp au <strong>+225 07 07 07 07 07</strong>.</p>
        
        <p style="margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 12px; color: #a0aec0; text-align: center;">
          Cet email est généré automatiquement, merci de ne pas y répondre directement.
        </p>
      </div>
    </div>
  `;

  const mailOptions = {
    from,
    to: toEmail,
    subject: 'Bienvenue sur MediClinic Pro ! 🏥 Confirmation de création de compte',
    html: htmlContent,
    text: `Bonjour ${adminName},\n\nNous avons le plaisir de vous confirmer la création de votre compte clinique pour l'établissement "${clinicName}".\n\nVotre compte administrateur est désormais actif et vous bénéficiez dès aujourd'hui de 14 jours d'essai gratuit.\n\nAccédez à votre espace clinique à l'adresse : http://localhost:5173\n\nCordialement,\nL'équipe MediClinic Pro`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Email de confirmation envoyé avec succès à ${toEmail} (MessageID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email] Erreur lors de l'envoi de l'email à ${toEmail}:`, error);
    throw error;
  }
};

module.exports = {
  sendConfirmationEmail
};
