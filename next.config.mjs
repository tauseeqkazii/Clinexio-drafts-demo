/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The backend test endpoint can take 30-60s due to Sonnet latency.
  // Next.js's server route handler timeout on Vercel is 60s on the
  // free / Hobby tier, 300s on Pro. We keep maxDuration on the route
  // export rather than here.
  experimental: {
    serverActions: {
      bodySizeLimit: "32kb",
    },
  },
};

export default nextConfig;
