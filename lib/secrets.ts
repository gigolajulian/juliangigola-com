/** A JSON secret from the Worker's env. JSON.parse quotes the text it chokes on, so its error never leaves here: a secret must not reach a log. */
export function secretJson<T>(secret: string, name: string): T {
  try {
    return JSON.parse(secret) as T;
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}
