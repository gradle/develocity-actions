const {agentRequirement} = await import('../src/input')

describe('Setup Python inputs', () => {
    describe('agentRequirement', () => {
        it('pins the default wheel to its known checksum', () => {
            expect(agentRequirement('', '0.10.1', '')).toBe(
                'develocity-agent @ https://develocity-python-pkgs.gradle.com/develocity_agent-0.10.1-py3-none-any.whl#sha256=2bfc48f29b1c437daac718bb3d5c726b74ec60cf33723986341d9a262e6f4896'
            )
        })

        it('leaves an unknown version unverified unless a checksum is given', () => {
            expect(agentRequirement('', '0.11.0', '')).toBe(
                'develocity-agent @ https://develocity-python-pkgs.gradle.com/develocity_agent-0.11.0-py3-none-any.whl'
            )
            expect(agentRequirement('', '0.11.0', 'abc')).toBe(
                'develocity-agent @ https://develocity-python-pkgs.gradle.com/develocity_agent-0.11.0-py3-none-any.whl#sha256=abc'
            )
        })

        it('uses the override as the full URL and ignores the version and its known checksum', () => {
            expect(agentRequirement('https://mirror.example.com/agent.whl', '0.10.1', '')).toBe(
                'develocity-agent @ https://mirror.example.com/agent.whl'
            )
        })
    })
})
