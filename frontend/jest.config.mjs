import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
	dir: './'
});

const customJestConfig = {
	testEnvironment: 'jsdom',
	setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1'
	},
	testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
	collectCoverageFrom: [
		'src/lib/**/*.ts',
		'src/lib/**/*.tsx',
		'!src/lib/**/*.d.ts',
		'!src/lib/**/__tests__/**'
	],
	coverageThreshold: {
		global: {
			branches: 90,
			functions: 90,
			lines: 90,
			statements: 90
		}
	}
};

export default createJestConfig(customJestConfig);
