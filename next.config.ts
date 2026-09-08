import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	// pdfkit loads its AFM font metric files from disk at runtime; bundling
	// them into the server output breaks text rendering in routes.
	serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
