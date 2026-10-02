const {agentDownloadUrl, toSeconds} = await import('../src/input')

describe('Setup Docker inputs', () => {
    describe('agentDownloadUrl', () => {
        it('builds the default URL from the version', () => {
            expect(agentDownloadUrl('', '0.9.0')).toBe(
                'https://develocity-docker-build-agent.gradle.com/develocity-docker-agent-0.9.0.jar'
            )
        })

        it('uses the override as the full URL and ignores the version', () => {
            expect(agentDownloadUrl('https://mirror.example.com/tools/agent.jar?token=abc', '0.9.0')).toBe(
                'https://mirror.example.com/tools/agent.jar?token=abc'
            )
        })
    })

    describe('toSeconds', () => {
        it('falls back to the default when the input is empty', () => {
            expect(toSeconds('drain-timeout', '', 300)).toBe(300)
        })

        it('accepts 0', () => {
            expect(toSeconds('drain-timeout', '0', 300)).toBe(0)
        })

        it('falls back to the default for a value that is not a whole number of seconds', () => {
            expect(toSeconds('drain-timeout', '5m', 300)).toBe(300)
        })
    })
})
