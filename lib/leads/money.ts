/**
 * What GET /api/money answers (app/api/money/route.ts), read by the money
 * desk and the Today screen. Types only, so the route and the client share it.
 */

/** One Stripe balance transaction, in cents, with who or what it was. */
export type Txn = {
  id: string;
  at: string;
  type: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  status: string;
  what: string;
};

/** A page of transactions; the first page (no `after`) also carries the balance in cents. */
export type MoneyAnswer = { available?: number; pending?: number; test?: boolean; more: boolean; txns: Txn[] };
