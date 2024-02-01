import * as githubUtils from '../utils/github'

export async function deleteWorkflowArtifacts(artifactIds: number[]): Promise<void> {
    for (const artifactId of artifactIds) {
        await githubUtils.deleteWorkflowArtifacts(artifactId)
    }
}
