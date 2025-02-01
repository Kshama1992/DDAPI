/** @type {import('@ts-jest/dist/types').InitialOptionsTsJest} */
export default {
	verbose: true,
	collectCoverageFrom: ['**/*.(t|j)s'],
	coverageDirectory: '../coverage',
	testEnvironment: 'node',
	setupFiles: ['../jest.setup.ts'],
	globalTeardown: '../jest.globalTeardown.ts',
	moduleNameMapper: {
		'@src/(.*)': '<rootDir>/$1',
		'@controller/(.*)': '<rootDir>/controller/$1',
		'@services/(.*)': '<rootDir>/services/$1',
		'@entity/(.*)': '<rootDir>/entity/$1',
		'@keys/(.*)': '<rootDir>/keys/$1',
		'@utils/(.*)': '<rootDir>/utils/$1',
		'@cron/(.*)': '<rootDir>/cron/$1',
		'@helpers/(.*)': '<rootDir>/utils/helpers/$1',
	},
	rootDir: 'src',
	moduleFileExtensions: ['js', 'json', 'ts'],
	testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
	transform: {
		'^.+\\.(t|j)s$': 'ts-jest',
	},
	reporters: ['default', ['jest-junit', { outputName: 'junit-unit.xml' }]],
};
