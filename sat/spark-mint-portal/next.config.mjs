import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // set root ke folder di atas app (…/sat) biar Next nggak bingung lockfile
  outputFileTracingRoot: path.resolve(__dirname, "..")
};
export default nextConfig;
