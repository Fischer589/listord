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
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: "https",
      hostname
    }))
  }
};

export default nextConfig;
