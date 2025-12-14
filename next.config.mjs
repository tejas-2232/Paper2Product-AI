/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Keep hack MVP friction low and avoid pinning deprecated eslint majors in package.json.
    ignoreDuringBuilds: true
  }
};

export default nextConfig;


