export default {
    clearMocks: true,
    moduleFileExtensions: ['js', 'ts', 'json'],
    testEnvironment: 'node',
    testMatch: ['**/*.test.ts'],
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', {useESM: true}]
    },
    reporters: ['default'],
    resolver: 'ts-jest-resolver',
    verbose: true,
    coverageReporters: ['json-summary', 'text', 'lcov'],
    collectCoverage: true,
    collectCoverageFrom: ['./src/**'],
}
