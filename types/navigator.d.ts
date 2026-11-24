/**
 * Navigator fields that some browsers have and lib.dom does not declare, merged
 * into the global interface. Optional, since a browser may lack them.
 */
interface Navigator {
  /** Network Information API (Chromium): data saver and the effective link type. */
  readonly connection?: { saveData?: boolean; effectiveType?: string };
  /** Global Privacy Control: true when the visitor asks not to be tracked. */
  readonly globalPrivacyControl?: boolean;
}
