# github-actions

A collection of composite Github Actions

## Publish Build Scans® from forked repositories

### Description
When submitting a pull request, a Github workflow that validates the change is usually triggered, however the Develocity Build Scans® can’t be published for 2 reasons:
- The Develocity Terms of Service have not been agreed to by the contributor
- Workflows from forked repositories do not have access to secrets although an access token is required to publish a Build Scan®

This repository contains some actions which can be combined together to solve this.

### Architecture
![Architecture](./doc/architecture.png)

### Usage

**Usage**:

Insert the `Save Build Scan` step after each Maven execution step in the Github workflow called to validate a pull-request (`Build with Maven` here).

```yaml
[...]
      - name: Build with Maven
        run: mvn clean package
      - name: Save Build Scan
        uses: gradle/github-actions/maven-build-scan-save@v1
        if: always()
[...]
```

Add a workflow to publish the Build Scans® saved during the previous step

```yaml
name: Upload Build Scans

on:
  workflow_run:
    workflows: [ "Build" ]
    types: [ completed ]
  issue_comment:
    types: [ created ]

jobs:

  publish-build-scans:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      actions: write
    steps:
      - name: Publish Build Scan
        uses: gradle/github-actions/maven-build-scan-publish@v1
        with:
          build-workflow-filename: 'build.yml'
          tos-location: 'https://foo.bar/tos.html'
          develocity-url: 'https://<MY_DEVELOCITY_URL>'
          develocity-access-key: ${{ secrets.<DEVELOCITY_ACCESS_KEY> }}
```

_Note:_
Some parameters need to be adjusted here:
- The workflow name (here `Build`) triggered when a pull-request is submitted
- The build workflow filename (here `build.yml`) has to be adjusted to the filename of the workflow using `maven-build-scan-save`
- The location of the Develocity Terms of Service (here `https://foo.bar/tos.html`)
- The Develocity URL (here `https://<MY_DEVELOCITY_URL>`)
- The secret name holding the Develocity access key (here `<DEVELOCITY_ACCESS_KEY>`)

### Implementation details

#### maven-build-scan-save

The action saves unpublished Build Scan® data as a workflow artifact with name `maven-build-scan-data`, which can then be published in a dependent workflow.

Use this action in your existing pull-request workflows to allow Build Scan® to be published. Since these workflows are running in an untrusted context, they do not have access to the required secrets to publish the Build Scan® directly.

Since the Develocity Maven Extension only saves the Build Scan® data for the most recent Maven execution, a step using this action must be inserted after each Maven execution step in the workflow.

**Event Triggers**:

This action can be called from any workflow but the main use case is to save unpublished Build Scan® issued from workflows triggered on `pull_request` event

**Action inputs**:

N/A

**Usage**:

Insert the `Save Build Scan` step after each Maven execution step in the Github workflow called to validate a pull-request (`Build with Maven` here).

```yaml
[...]
      - name: Build with Maven
        run: mvn clean package
      - name: Save Build Scan
        uses: gradle/github-actions/maven-build-scan-save@v1
        if: always()
[...]
```

#### maven-build-scan-publish

The action will download any saved Build Scan® and publish them to Develocity after having checked that the Terms of Service were accepted.

If Terms of Service were not accepted, a comment is made on the pull-request asking the user to accept and the action fails. The user can then accept the Terms of Service by responding with a specific comment on the pull-request.

**Event Triggers**:

This action should be configured to respond to the following event triggers:
- `workflow_run`: to check if the user has previously accepted the Terms of Service before publishing a Build Scan®.
- `issue_comment`: to check if any new pull-request comment is accepting the Terms of Service.
  These event allows access to the repository secrets (_Develocity Access Key_) which is required to publish a Build Scan® to Develocity when authentication is enabled.

**Permissions**:

The following permissions are required for this action to operate:
- `contents: write`: to create/edit the Terms of Service acceptance file
- `pull-requests: write`: to comment the pull-request
- `actions: write`: to delete a workflow artifact

**Action inputs**:

| Name                                     | Description                                                                                             | Default                                                                                                                                                      |
|------------------------------------------|---------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `build-workflow-filename`                | Filename of the workflow using `maven-build-scan/save` (called upon pull-request submission)            |                                                                                                                                                              |
| `tos-location`                           | Terms Of Service location (URL)                                                                         |                                                                                                                                                              |
| `develocity-url`                         | Develocity URL                                                                                          |                                                                                                                                                              |
| `develocity-access-key`                  | *Optional*: Develocity access key                                                                       |                                                                                                                                                              |
| `develocity-allow-untrusted`             | *Optional*: Develocity allow-untrusted flag                                                             | `false`                                                                                                                                                      |
| `tos-acceptance-file-branch`             | *Optional*: Git branch where the Terms of Service acceptance file will be stored                        | `${{ github.event.repository.default_branch }}`                                                                                                              |
| `tos-acceptance-file`                    | *Optional*: Terms of Service acceptance file location                                                   | `.github/develocity-tos.json`                                                                                                                                |
| `pr-comment-tos-acceptance-missing`      | *Optional*: pull-request comment added when Terms of Service have not previously been accepted          | `Please accept [Develocity Terms Of Service]({0}) to get your pull-request Build Scan published by commenting this pull-request with the following message:` |
| `pr-comment-tos-acceptance-request`      | *Optional*: pull-request comment to accept the Terms of Service                                         | `I have read Develocity Terms Of Service and I hereby accept the Terms`                                                                                      |
| `pr-comment-tos-acceptance-confirmation` | *Optional*: pull-request comment added when Terms of Service are accepted                               | `All Contributors have accepted Develocity Terms Of Service.`                                                                                                |
| `white-list`                             | *Optional*: CSV List of users not required to accept the Terms of Service                               | `''`                                                                                                                                                         |
| `white-list-only`                        | *Optional*: If enabled, only users belonging to the white-list will be allowed to publish Build Scans®  | `'false'`                                                                                                                                                    |
| `github-token`                           | *Optional*: Github token                                                                                | `${{ github.token }}`                                                                                                                                        |

**Usage**:

_Note:_
Some parameters need to be adjusted here:
- The build workflow filename (here `build.yml`) has to be adjusted to the filename of the workflow using `maven-build-scan/save`
- The location of the Develocity Terms of Service (here `https://foo.bar/tos.html`)
- The Develocity URL (here `https://<MY_DEVELOCITY_URL>`)
- The secret name holding the Develocity access key (here `<DEVELOCITY_ACCESS_KEY>`)

```yaml
      - name: Publish Build Scan
        uses: gradle/github-actions/maven-build-scan-publish@v1
        with:
          build-workflow-filename: 'build.yml'
          tos-location: 'https://foo.bar/tos.html'
          develocity-url: 'https://<MY_DEVELOCITY_URL>'
          develocity-access-key: ${{ secrets.<DEVELOCITY_ACCESS_KEY> }}
```

