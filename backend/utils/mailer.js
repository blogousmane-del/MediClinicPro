const nodemailer = require('nodemailer');
const { Resend } = require('resend');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const buildConfirmationEmail = (adminName, clinicName) => {
  const html = `
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
          <a href="${APP_URL}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accéder à mon espace clinique</a>
        </div>

        <p>Si vous avez des questions, notre support est à votre disposition par WhatsApp au <strong>+225 07 07 07 07 07</strong>.</p>

        <p style="margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 12px; color: #a0aec0; text-align: center;">
          Cet email est généré automatiquement, merci de ne pas y répondre directement.
        </p>
      </div>
    </div>
  `;

  const text = `Bonjour ${adminName},\n\nNous avons le plaisir de vous confirmer la création de votre compte clinique pour l'établissement "${clinicName}".\n\nVotre compte administrateur est désormais actif et vous bénéficiez dès aujourd'hui de 14 jours d'essai gratuit.\n\nAccédez à votre espace clinique à l'adresse : ${APP_URL}\n\nCordialement,\nL'équipe MediClinic Pro`;

  return { html, text };
};

/**
 * Sends a welcome/confirmation email to the clinic admin after registration.
 * Sends via Resend if RESEND_API_KEY is configured, falls back to raw SMTP,
 * and falls back to console logging in dev mode if neither is configured.
 *
 * @param {string} toEmail
 * @param {string} adminName
 * @param {string} clinicName
 */
const sendConfirmationEmail = async (toEmail, adminName, clinicName) => {
  const subject = 'Bienvenue sur MediClinic Pro ! 🏥 Confirmation de création de compte';
  const { html, text } = buildConfirmationEmail(adminName, clinicName);

  const resendApiKey = process.env.RESEND_API_KEY || '';
  const resendFrom = process.env.RESEND_FROM_EMAIL || 'MediClinic Pro <no-reply@mediclinicpro.com>';

  if (resendApiKey) {
    console.log(`[Email] Envoi via Resend à : ${toEmail}`);
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      from: resendFrom,
      to: toEmail,
      subject,
      html,
      text
    });

    if (error) {
      console.error(`[Email] Erreur Resend lors de l'envoi à ${toEmail}:`, error);
      throw error;
    }

    console.log(`[Email] Email envoyé avec succès via Resend à ${toEmail} (ID: ${data?.id})`);
    return { success: true, messageId: data?.id };
  }

  const host = process.env.SMTP_HOST || '';
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || '"MediClinic Pro" <no-reply@mediclinicpro.com>';

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
    console.log("⚠️ Aucune configuration d'envoi d'email trouvée (RESEND_API_KEY ou SMTP_HOST/SMTP_USER/SMTP_PASS).");
    console.log("L'envoi d'email réel est désactivé. Voici le contenu de l'email de confirmation simulé :");
    console.log("==================================================================================");
    console.log(`DE : ${from}`);
    console.log(`À : ${toEmail}`);
    console.log(`SUJET : ${subject}`);
    console.log(`MESSAGE :`);
    console.log(text);
    console.log("==================================================================================");
    return { simulated: true };
  }

  const mailOptions = { from, to: toEmail, subject, html, text };

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
