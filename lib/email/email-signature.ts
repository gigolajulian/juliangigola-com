/**
 * Julian's email signature, the same one Gmail adds on hello@ (source of truth: ~/.claude/vault/email-signature.md).
 * Live text so mail apps can flip it in dark mode; SIG_DARK does that for the site's own templates.
 */
const A = "color:#5f5f5f;text-decoration:none";

export const SIG_HTML = `<br><table cellpadding="0" cellspacing="0" border="0" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><tr><td class="sig-n" style="font-size:24px;line-height:28px;font-weight:bold;letter-spacing:-1px;color:#141414;white-space:nowrap;">Julian Gigola</td></tr><tr><td class="sig-r" style="border-bottom:1px solid #c8c8c8;font-size:1px;line-height:1px;padding:9px 0 0;">&nbsp;</td></tr><tr><td class="sig-d" style="padding:9px 0 0;font-size:10px;line-height:17px;letter-spacing:1.5px;text-transform:uppercase;color:#5f5f5f;white-space:nowrap;"><span style="font-size:9px;letter-spacing:1.4px;">Photographer &amp; Creative Director</span><br>SF Bay Area<span class="sig-s" style="color:#b4b4b4;">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span><a class="sig-d" href="https://juliangigola.com" style="${A}">juliangigola.com</a><br><a class="sig-d" href="mailto:hello@juliangigola.com" style="${A}">hello@juliangigola.com</a></td></tr></table>`;

export const SIG_TEXT = ["", "Julian Gigola", "Photographer & Creative Director", "SF Bay Area | juliangigola.com", "hello@juliangigola.com"].join("\n");

/** Rules for a template's prefers-color-scheme: dark block. */
export const SIG_DARK = ".sig-n{color:#f1f0ed!important}.sig-d{color:#92908d!important}.sig-s{color:#5a5856!important}.sig-r{border-color:rgba(255,255,255,0.11)!important}";
