import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// CSP: permissive for scripts/styles (unsafe-inline needed for Next.js + Tailwind),
// explicit allowlist for images so external avatar sources work in prod.
const cspHeader = [
  "default-src 'self'",
  // unsafe-eval only in dev (React error overlays use eval)
  // clerk.getthinkedin.xyz is the custom Clerk FAPI domain — loads clerk.browser.js and ui.browser.js
  // challenges.cloudflare.com is required for Clerk's Cloudflare Turnstile CAPTCHA widget
  `script-src 'self' 'unsafe-inline' https://clerk.getthinkedin.xyz https://*.clerk.accounts.dev https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://clerk.getthinkedin.xyz",
  // All avatar / image sources used across public and dashboard routes
  // www.google.com is the Google favicon service used in the web sources strip
  "img-src 'self' data: blob: https://unavatar.io https://api.dicebear.com https://randomuser.me https://i.pravatar.cc https://img.clerk.com https://www.google.com https://clerk.getthinkedin.xyz",
  "font-src 'self' data: https://clerk.getthinkedin.xyz",
  // Supabase realtime (wss) + Clerk frontend API (custom domain + fallback accounts.dev)
  // challenges.cloudflare.com is required for Turnstile token validation
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://clerk.getthinkedin.xyz https://api.clerk.com https://*.clerk.accounts.dev https://clerk.com https://challenges.cloudflare.com",
  // Clerk SignIn/SignUp render inside a hosted iframe; Turnstile CAPTCHA renders in a Cloudflare iframe
  "frame-src 'self' https://clerk.getthinkedin.xyz https://*.clerk.accounts.dev https://accounts.clerk.com https://clerk.com https://challenges.cloudflare.com",
  // Clerk and Turnstile both offload work to web workers
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://clerk.getthinkedin.xyz https://*.clerk.accounts.dev https://accounts.clerk.com",
  "frame-ancestors 'none'",
  // Upgrading subresource requests breaks local http://localhost dev because
  // the browser rewrites CSS/JS/image fetches to https://localhost.
  !isDev ? "upgrade-insecure-requests" : null,
]
  .filter((directive): directive is string => Boolean(directive))
  .join("; ");

const nextConfig: NextConfig = {
  async headers() {
    if (isDev) {
      return [];
    }

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomuser.me",
        pathname: "/api/portraits/**",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
      // Real LinkedIn profile photos via unavatar proxy (used in chat cards)
      {
        protocol: "https",
        hostname: "unavatar.io",
        pathname: "/**",
      },
      // Proof-page testimonial avatars
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
        pathname: "/**",
      },
    ],
    localPatterns: [
      {
        pathname: "/Avatars/**",
        search: "",
      },
      {
        pathname: "/avatars/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
