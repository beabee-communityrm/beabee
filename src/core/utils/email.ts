import juice from "juice";

import OptionsService from "#core/services/OptionsService";

import currentLocale from "#locale";

export function getEmailFooter(): string {
  const locale = currentLocale();
  return `
<p><br></p>
<hr>
<p><br></p>
<p><img src="${OptionsService.getText(
    "logo"
  )}" style="display:inline-block; vertical-align: middle" width="50" height="50"><span style="margin-left: 10px">${OptionsService.getText(
    "organisation"
  )}</span></p>
<p><br></p>
<p style="color: #666;">${
    locale.footer.contactUs
  } <a href="mailto:${OptionsService.getText(
    "support-email"
  )}">${OptionsService.getText("support-email")}</a>.</p>
<p style="color: #666;">${[
    [
      locale.footer.privacyPolicy,
      OptionsService.getText("footer-privacy-link-url")
    ],
    [locale.footer.terms, OptionsService.getText("footer-terms-link-url")],
    ["Impressum", OptionsService.getText("footer-impressum-link-url")]
  ]
    .filter(([text, url]) => !!url)
    .map(([text, url]) => `<a href="${url}">${text}</a>`)
    .join(", ")}</p>
`;
}

export function formatEmailBody(body: string): string {
  const styles = `
<style>p,ul,ol,h1,h2,h3,h4,h5,h6,pre,blockquote,hr { margin: 0; }</style>
  `;
  // Make empty paragraph tags visible
  body = body.replace(/<p><\/p>/g, "<p><br></p>");
  return juice(styles + body + getEmailFooter());
}
