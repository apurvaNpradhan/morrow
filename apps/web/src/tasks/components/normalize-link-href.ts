const SAFE_SCHEME = /^(https?:\/\/|mailto:)/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HOST_AND_PORT = /^[^/\s:]+:\d+(\/|$)/;
const EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;

/**
 * What a typed link becomes: `https://` before a bare domain, `mailto:` before
 * an email address. Only http, https and mailto are allowed; anything else
 * (`javascript:`, `data:`, `ftp:`) is rejected with null.
 */
export function normalizeLinkHref(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;

  if (SAFE_SCHEME.test(text)) return isUrl(text) ? text : null;
  if (EMAIL.test(text)) return `mailto:${text}`;
  // `example.com:8080` has a colon but no scheme; `javascript:` has one.
  if (ANY_SCHEME.test(text) && !HOST_AND_PORT.test(text)) return null;
  if (!text.includes(".") && !/^localhost(:|\/|$)/i.test(text)) return null;

  const href = `https://${text}`;
  return isUrl(href) ? href : null;
}

function isUrl(href: string) {
  try {
    new URL(href);
    return true;
  } catch {
    return false;
  }
}
