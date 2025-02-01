import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
	verbose: true,
	rootDir: 'src',
	testRegex: '.*\\.spec\\.ts$',
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
	moduleDirectories: ['node_modules', 'src'],
	moduleFileExtensions: ['ts', 'js', 'json'],
	testEnvironment: 'node',
	coverageDirectory: '../coverage',
	collectCoverageFrom: ['**/*.(t|j)s'],
	transform: {
		'^.+\\.tsx?$': 'ts-jest',
	},
	reporters: ['default', ['jest-junit', { outputName: 'junit-int.xml' }]],
};

export default config;
