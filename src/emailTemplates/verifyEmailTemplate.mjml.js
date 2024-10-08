import mjml2html from 'mjml';

export function generateEmailTemplate(confirmationLink) {
  const mjmlTemplate = `
    <mjml>
      <mj-head>
        <mj-title>Confirmation d'email</mj-title>
      </mj-head>
      <mj-body>
        <mj-section>
          <mj-column>
            <mj-text align="center" font-size="20px" color="#4A4A4A">
              Bonjour !
            </mj-text>
            <mj-text font-size="16px" color="#4A4A4A">
              Merci de vous être inscrit. Veuillez confirmer votre adresse e-mail en cliquant sur le bouton ci-dessous.
            </mj-text>
            <mj-button href="${confirmationLink}" background-color="#007BFF" color="white">
              Confirmer mon email
            </mj-button>
            <mj-text font-size="14px" color="#4A4A4A" align="center" padding-top="20px">
              Si vous n'avez pas créé de compte, veuillez ignorer cet email.
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;

  const { html } = mjml2html(mjmlTemplate);
  

  return html;
}
