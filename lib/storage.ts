/* Browser storage that never throws: reads give null and writes are dropped when storage is off. */

/** sessionStorage that never throws (private mode, storage off, a sandboxed frame): null when it cannot read. */
export const sessionGet = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

/** sessionStorage that never throws: a write it cannot make is dropped. */
export const sessionSet = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
};

/** sessionStorage that never throws: a removal it cannot make is dropped. */
export const sessionRemove = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {}
};

/** A JSON value kept in sessionStorage: null when missing, unreadable or not JSON. */
export const sessionJson = <T>(key: string): T | null => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
};

/** localStorage that never throws: null when it cannot read. */
export const localGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** localStorage that never throws: a write it cannot make is dropped. */
export const localSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

/** localStorage that never throws: a removal it cannot make is dropped. */
export const localRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {}
};
