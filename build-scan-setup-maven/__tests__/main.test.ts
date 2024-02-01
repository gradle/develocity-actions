import * as github from '@actions/github'

process.env['GITHUB_REPOSITORY'] = 'foo/bar'
process.env['RUNNER_TEMP'] = '/tmp'

import * as main from '../src/main'

const runMock = jest.spyOn(main, 'run')

describe('Main Setup Maven', () => {
    beforeEach(() => {
        Object.defineProperty(github, 'context', {
            value: {
                repo: {
                    owner: 'foo',
                    repo: 'bar'
                },
                issue: {
                    number: 42
                }
            }
        })
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Setup build scan action adds MAVEN_OPTS when not configured', async () => {
        // given
        process.env['MAVEN_OPTS'] = ''

        // when
        await main.run()

        // then
        expect(runMock).toHaveReturned()
        expect(process.env['MAVEN_OPTS']).toMatch(/^-Dmaven.ext.class.path=.*$/)
    })

    it('Setup build scan action extends MAVEN_OPTS when already configured', async () => {
        // given
        process.env['MAVEN_OPTS'] = 'foo bar'

        // when
        await main.run()

        // then
        expect(runMock).toHaveReturned()
        expect(process.env['MAVEN_OPTS']).toMatch(/^foo bar -Dmaven.ext.class.path=.*$/)
    })

    it('Setup build scan action merges MAVEN_OPTS when already configured with -Dmaven.ext.class.path', async () => {
        // given
        process.env['MAVEN_OPTS'] = 'foo -Dmaven.ext.class.path=a:b:c bar'

        // when
        await main.run()

        // then
        expect(runMock).toHaveReturned()
        expect(process.env['MAVEN_OPTS']).toMatch(/^foo -Dmaven.ext.class.path=.*:a:b:c bar$/)
    })

})
