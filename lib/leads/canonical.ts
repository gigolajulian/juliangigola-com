/* A lead's address in one spelling, so the sealed id (`lib/seal.ts`) and
 * the desk match the same person however they typed it. */

/** One person's address, however they spell it. A lead
    typed gigola.julian@gmail.com whose mail came from gigolajulian@gmail.com
    never met. Gmail ignores dots and anything after "+", so the id does too. */
export function canonical(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  const [user, domain] = [e.slice(0, at), e.slice(at + 1)];
  if (at < 1 || (domain !== "gmail.com" && domain !== "googlemail.com")) return e;
  return `${user.split("+")[0].replaceAll(".", "")}@gmail.com`;
}
