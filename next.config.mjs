const supabaseHostname = (() => {
  try {
    const value =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    return value ? new URL(value).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const imageHosts = [
  "images.unsplash.com",
  ...(supabaseHostname ? [supabaseHostname] : [])
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Serve stable source URLs directly to avoid Vercel image transformations
    // and image-cache writes. next/image still preserves layout and lazy loading.
    unoptimized: true,
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: "https",
      hostname
    }))
  },
  async redirects() {
    return [
      {
        source: "/busco-trabajo",
        destination: "/trabajadores/registro",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
