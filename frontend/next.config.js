/** @type {import('next').NextConfig} */
const nextConfig = {
	// Use a per-instance build directory to avoid cross-instance clobbering in dev
	// INSTANCE_NAME is provided by the instance env file
	distDir: process.env.NEXT_DIST_DIR || (process.env.INSTANCE_NAME ? `.next-${process.env.INSTANCE_NAME}` : '.next'),
};

module.exports = nextConfig;
