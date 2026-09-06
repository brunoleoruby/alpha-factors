import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cursor preview and Electron both hit this host as 127.0.0.1, not "localhost".
  // Missing entries make Next reset /_next HMR, which the browser reports as
  // ERR_EMPTY_RESPONSE on the page URL.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "0.0.0.0",
    "[::1]",
    "*.localhost",
  ],
};

export default nextConfig;
