const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig');

/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */
export default {
	// Indicates whether the coverage information should be collected while executing the test
	collectCoverage: true,

	// https://joshtronic.com/2017/10/24/configuring-jest-to-show-code-coverage-for-all-of-your-files/
	collectCoverageFrom: ['src/**/*.{js,ts}'],

	// https://stackoverflow.com/questions/48813882/testing-typescript-interface-with-jest
	coveragePathIgnorePatterns: [
		"<rootDir>/src/logging/index\.ts",
		"<rootDir>/src/persistence/mongodb\.ts",
		"<rootDir>/src/persistence/entity/comment\.entity\.ts",
		"<rootDir>/src/persistence/entity/site\.entity\.ts",
		"<rootDir>/src/persistence/entity/user\.entity\.ts",
		"<rootDir>/src/remark42/api/admin\.api\.ts",
		"<rootDir>/src/remark42/api/image\.api\.ts",
		"<rootDir>/src/remark42/api/store\.api\.ts",
		"<rootDir>/src/web/controller/index\.ts",
		"<rootDir>/src/web/jrpc/endpoint\.ts",
		"<rootDir>/src/web/jrpc/request\.ts",
		"<rootDir>/src/web/jrpc/response\.ts",		
		"<rootDir>/src/web/server/options\.ts",		
		"<rootDir>/src/index\.ts"
	],

	// The directory where Jest should output its coverage files
	coverageDirectory: "coverage",

	// Indicates which provider should be used to instrument code for coverage
	coverageProvider: "v8",

	// A preset that is used as a base for Jest's configuration
	preset: '@shelf/jest-mongodb',

	// The test environment that will be used for testing
	// testEnvironment: "jest-environment-node",

	// The glob patterns Jest uses to detect test files
	testMatch: [
	  "**/test/**/*.test.ts",
	],

	// A map from regular expressions to paths to transformers
	transform: {
		'^.+\\.ts?$': 'ts-jest',
	},

	// An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
	transformIgnorePatterns: [
	  "\\\\node_modules\\\\",
	  "\\.pnp\\.[^\\\\]+$"
	],

	watchPathIgnorePatterns: ['globalConfig'],

	// https://stackoverflow.com/questions/51080947/how-to-use-path-alias-in-a-react-project-with-typescript-jest	
	moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' })	
};
