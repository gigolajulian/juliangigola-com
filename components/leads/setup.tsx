"use client";

const SW_URL = "/admin/leads/sw.js";
/** The app is the whole origin on leads.juliangigola.com, /admin/leads on the main site. */
const swScope = () => (location.hostname.startsWith("leads.") ? "/" : "/admin/leads");

export { SW_URL, swScope };
