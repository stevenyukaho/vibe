import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
	// Use a per-instance build directory to avoid cross-instance clobbering in dev
	// INSTANCE_NAME is provided by the instance env file
	distDir: process.env.NEXT_DIST_DIR || (process.env.INSTANCE_NAME ? `.next-${process.env.INSTANCE_NAME}` : '.next'),
	webpack: (config) => {
		config.resolve.alias = {
			...(config.resolve.alias || {}),
			'@ibm-vibe/types': path.resolve(__dirname, '../packages/types/index.ts'),
			'@ibm-vibe/config': path.resolve(__dirname, '../packages/config/src/index.ts')
		};
		return config;
	}
};

export default nextConfig;

