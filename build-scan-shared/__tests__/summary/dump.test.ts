import {jest} from '@jest/globals'

process.env['RUNNER_TEMP'] = '/tmp'

import {BuildToolType} from '../../src/buildTool/common'

const mockWriteContentToFileSync = jest.fn()

jest.unstable_mockModule('../../src/utils/io', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    writeContentToFileSync: mockWriteContentToFileSync
}))

const mockIsAddPrComment = jest.fn()
const mockIsAddJobSummary = jest.fn()

jest.unstable_mockModule('../../src/setup/input', () => ({
    isAddPrComment: mockIsAddPrComment,
    isAddJobSummary: mockIsAddJobSummary,
    isAddProjectIdInJobSummary: jest.fn().mockReturnValue(false)
}))

function job(buildTool: BuildToolType) {
    return {
        prNumber: 42,
        builds: [
            {
                projectId: 'projectId',
                workflowName: 'workflow',
                jobName: 'job',
                buildToolVersion: '42',
                requestedTasks: 'install',
                buildId: 'abcde',
                buildFailure: false,
                buildTimestamp: '0',
                isRepublished: false
            }
        ],
        buildToolType: buildTool
    }
}

const mockLoadJobMetadata = jest.fn()

jest.unstable_mockModule('../../src/metadata/load', () => ({
    loadJobMetadata: mockLoadJobMetadata
}))

const mockGitHubCommentPr = jest.fn()
const mockGitHubAddSummary = jest.fn()

jest.unstable_mockModule('../../src/utils/github', () => ({
    commentPullRequest: mockGitHubCommentPr,
    addSummary: mockGitHubAddSummary
}))

const {dump} = await import('../../src/summary/dump')

describe('dump', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it.each([BuildToolType.MAVEN, BuildToolType.NPM])(
        'Dump triggers pull request comment and summary with %s',
        async buildTool => {
            // Given
            mockLoadJobMetadata.mockReturnValue(job(buildTool))
            mockIsAddPrComment.mockReturnValue(true)
            mockIsAddJobSummary.mockReturnValue(true)
            mockGitHubCommentPr.mockReturnValue(Promise.resolve(undefined))
            mockGitHubAddSummary.mockReturnValue(Promise.resolve(undefined))

            // when
            await dump(buildTool, '', '')

            // then
            expect(mockWriteContentToFileSync).toHaveBeenCalled()
            expect(mockGitHubCommentPr).toHaveBeenCalled()
            expect(mockGitHubAddSummary).toHaveBeenCalled()
        }
    )

    it.each([BuildToolType.MAVEN, BuildToolType.NPM])(
        'Dump with add-pr-comment=false dumps output to file with %s',
        async buildTool => {
            // Given
            mockLoadJobMetadata.mockReturnValue(job(buildTool))
            mockIsAddPrComment.mockReturnValue(false)
            mockIsAddJobSummary.mockReturnValue(true)
            mockGitHubCommentPr.mockReturnValue(Promise.resolve(undefined))
            mockGitHubAddSummary.mockReturnValue(Promise.resolve(undefined))

            // when
            await dump(buildTool, '', '')

            // then
            expect(mockWriteContentToFileSync).toHaveBeenCalled()
            expect(mockGitHubCommentPr).not.toHaveBeenCalled()
            expect(mockGitHubAddSummary).toHaveBeenCalled()
        }
    )

    it.each([BuildToolType.MAVEN, BuildToolType.NPM])(
        'Dump with add-job-summary=false does not add summary with %s',
        async buildTool => {
            // Given
            mockLoadJobMetadata.mockReturnValue(job(buildTool))
            mockIsAddPrComment.mockReturnValue(false)
            mockIsAddJobSummary.mockReturnValue(false)
            mockGitHubCommentPr.mockReturnValue(Promise.resolve(undefined))
            mockGitHubAddSummary.mockReturnValue(Promise.resolve(undefined))

            // when
            await dump(buildTool, '', '')

            // then
            expect(mockWriteContentToFileSync).toHaveBeenCalled()
            expect(mockGitHubCommentPr).not.toHaveBeenCalled()
            expect(mockGitHubAddSummary).not.toHaveBeenCalled()
        }
    )

    it.each([BuildToolType.MAVEN, BuildToolType.NPM])(
        'Dump without build scan does nothing with %s',
        async buildTool => {
            // Given
            mockLoadJobMetadata.mockReturnValue({})
            mockIsAddPrComment.mockReturnValue(false)
            mockIsAddJobSummary.mockReturnValue(false)
            mockGitHubCommentPr.mockReturnValue(Promise.resolve(undefined))
            mockGitHubAddSummary.mockReturnValue(Promise.resolve(undefined))

            // when
            await dump(buildTool, '', '')

            // then
            expect(mockWriteContentToFileSync).not.toHaveBeenCalled()
            expect(mockGitHubCommentPr).not.toHaveBeenCalled()
            expect(mockGitHubAddSummary).not.toHaveBeenCalled()
        }
    )

    it.each([BuildToolType.MAVEN, BuildToolType.NPM])(
        'Dump with add-pr-comment=true and without build scan does nothing with %s',
        async buildTool => {
            // Given
            mockLoadJobMetadata.mockReturnValue({})
            mockIsAddPrComment.mockReturnValue(true)
            mockIsAddJobSummary.mockReturnValue(false)
            mockGitHubCommentPr.mockReturnValue(Promise.resolve(undefined))
            mockGitHubAddSummary.mockReturnValue(Promise.resolve(undefined))

            // when
            await dump(buildTool, '', '')

            // then
            expect(mockWriteContentToFileSync).not.toHaveBeenCalled()
            expect(mockGitHubCommentPr).not.toHaveBeenCalled()
            expect(mockGitHubAddSummary).not.toHaveBeenCalled()
        }
    )
})
