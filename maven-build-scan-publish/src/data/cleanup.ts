import * as core from '@actions/core'
import * as github from '@actions/github'

import * as githubInternal from '../shared/github'

export async function deleteWorkflowArtifacts(artifactId: number): Promise<void> {
    core.debug(`Deleting artifact with id ${artifactId}`)
    await githubInternal.getOctokit().rest.actions.deleteArtifact({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        artifact_id: artifactId
    })
}
