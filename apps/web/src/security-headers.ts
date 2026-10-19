/** Response security headers (proxy.ts). Pure so the policy is unit-tested. */
export function securityHeaders(o: { nonce: string; secure: boolean }): Record<string, string> {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${o.nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    // The app uses no device APIs; deny them to every frame and script.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), display-capture=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    // HSTS only when the app is served over HTTPS (COOKIE_SECURE); on plain HTTP it would be ignored or harmful.
    ...(o.secure ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
}
