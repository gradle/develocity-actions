# github-actions

A collection of composite Github Actions

## terms-of-service/verify

A composite action to verify that Gradle Terms of Service have been approved.

The action succeeds if the pull-request contributors are recorded in the signature file, fails otherwise.
Contributors can approve the Terms of Service by commenting the pull-request, explore the [cla-assistant-lite documentation](https://github.com/marketplace/actions/cla-assistant-lite) for more details.

**Dependencies**:

- [cla-assistant-lite](https://github.com/marketplace/actions/cla-assistant-lite)

**Event Trigger**:

- `pull_request_target`
- `issue-comment`

**Action inputs**:

| Name                                   | Description                                                                   | Default                                                                                                                                                             |
|----------------------------------------|-------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `tos-location`                         | Terms Of Service location (URL)                                               |                                                                                                                                                                     |
| `signature-branch`                     | *Optional*: Git branch where the signature file will be stored                | `${{ github.event.repository.default_branch }}`                                                                                                                     |
| `signature-location`                   | *Optional*: Signature file location                                           | `.github/gradle-enterprise-tos.json`                                                                                                                                |
| `pr-comment-tos-approval-missing`      | *Optional*: pull-request comment added when Terms of Service are not approved | `Please accept [Gradle Enterprise Terms Of Service]({0}) to get your pull-request Build Scan published by commenting this pull-request with the following message:` |
| `pr-comment-tos-approval-request`      | *Optional*: pull-request comment to approve the Terms of Service              | `I have read Gradle Enterprise Terms Of Service and I hereby accept the Terms`                                                                                      |
| `pr-comment-tos-approval-confirmation` | *Optional*: pull-request comment added when Terms of Service are approved     | `All Contributors have accepted Gradle Enterprise Terms Of Service.`                                                                                                |
| `white-list`                           | *Optional*: CSV List of users not required to approve the Terms of Service    | `''`                                                                                                                                                                |
| `github-token`                         | *Optional*: Github token                                                      | `${{ github.token }}`                                                                                                                                               |

**Usage**:

```yaml
name: Gradle - Terms of Service approval verification

on:
  # issue_comment event is triggered when a pull-request is commented
  issue_comment:
    types: [ created ]
  pull_request_target:

jobs:
  check-terms-of-service-approval:
    runs-on: ubuntu-latest
    permissions:
      # required to update signature file
      contents: write
      # required to comment pull-request
      pull-requests: write
      # required to update pull-request status check
      actions: write
      statuses: write
    steps:
      - name: Gradle - Terms of Service approval verification
        uses: gradle/github-actions/terms-of-service/verify@v1.0
        with:
          # tos-location can also point to a file in a Github repository with this syntax: /<owner>/<repo>/blob/<branch>/tos.html
          tos-location: 'https://foo.bar/tos.html'
          # Optional inputs
          #pr-comment-tos-approval-missing: 'Please accept [Gradle Enterprise Terms Of Service]({0}) to get your pull-request Build Scan published by commenting this pull-request with the following message:'
          #pr-comment-tos-approval-request: 'I have read Gradle Enterprise Terms Of Service and I hereby accept the Terms'
          #pr-comment-tos-approval-validation: 'All Contributors have accepted Gradle Enterprise Terms Of Service.'
          #signature-branch: 'main'
          #signature-location: '.github/gradle-enterprise-tos.json'
          #white-list: 'bot1,bot2'
          #github-token: ${{ secrets.MY_PAT }}
```

## maven/build-scan/save
A Composite action to save an unpublished Maven Build Scan®.

The action saves unpublished Build Scan® data as a workflow artifact with name `maven-build-scan-data`, which can then be published in a dependent workflow.
To simplify the Build Scan® publication process later on, a file containing the Gradle Enterprise Maven extension version(s) is saved as an additional workflow artifact with name `maven-build-scan-metadata`.

Use this action in your existing pull-request workflows to allow Build Scan® to be published. Since these workflows are running in an untrusted context, they do not have access to the required secrets to publish the Build Scan® directly.

Since the Gradle Enterprise Maven Extension only saves the Build Scan® data for the most recent Maven execution, a step using this action must be inserted after each Maven execution step in the workflow.

**Dependencies**:

- [actions/upload-artifact](https://github.com/marketplace/actions/upload-a-build-artifact)

**Event Trigger**:

This composite action can be called from any workflow but the main use case is to save unpublished Build Scan® issued from workflows triggered on `pull_request` event

**Action inputs**:

N/A

**Usage**:

Insert the `Save Build Scan` step after each Maven execution step in the Github workflow called to validate a pull-request (`Build with Maven` here).

```yaml
[...]
      - name: Build with Maven
        run: mvn clean package
      - name: Save Build Scan
        uses: gradle/github-actions/maven/build-scan/save@v1.0
[...]
```

## maven/build-scan/publish

A composite action to publish all Maven Build Scans® saved as workflow artifacts when validating a pull-request (by the `maven/build-scan/save` action). 

This action is called from a new workflow with a `workflow_run` event trigger in order to run just after the existing pull-request workflow has completed.
This event allows access to the repository secrets (_Gradle Enterprise Access Key_) which is required to publish Build Scans® to Gradle Enterprise when authentication is enabled.

The Build Scan® publication requires the Gradle Terms of Service to be approved, this can be achieved by adding a workflow using the `terms-of-service/verify` action.
The `pull-request-check/verify` action is used to ensure this workflow passed successfully. 

`dawidd6/action-download-artifact` action is used to download Artifacts uploaded by a different workflow.

**Dependencies**:

- [dawidd6/action-download-artifact](https://github.com/marketplace/actions/download-workflow-artifact)

**Event Trigger**:
- `workflow_run`

**Action inputs**:

| Name                                  | Description                                        | Default |
|---------------------------------------|----------------------------------------------------|---------|
| `gradle-enterprise-url`               | Gradle Enterprise URL                              |         |
| `gradle-enterprise-extension-version` | Gradle Enterprise Maven extension version          |         |
| `gradle-enterprise-access-key`        | *Optional*: Gradle Enterprise access key           |         |
| `gradle-enterprise-allow-untrusted`   | *Optional*: Gradle Enterprise allow-untrusted flag | `false` |

**Usage**:

_Note:_
Some parameters need to be adjusted here:
- The workflow name (here `PR Check`) has to be adjusted to the `name` used in the workflow run to validate pull-requests
- The workflow-job-name (here `check-terms-of-service-approval`) has to be adjusted to the job `name` used in the workflow to verify the Terms of Service approval.
- The Gradle Enterprise URL (here `https://<MY_GE_URL>`)
- The secret name holding the Gradle Enterprise access key (here `<GE_ACCESS_KEY>`)

```yaml
name: Publish Maven Build Scans

on:
  workflow_run:
    workflows: [ "PR Check" ]
    types: [ completed ]

jobs:

  verify-terms-of-service-approval:
    runs-on: ubuntu-latest
    steps:
      - name: Verify check terms of service approval job passed
        uses: gradle/github-actions/pull-request-check/verify@v1.0
        with:
          workflow-job-name: 'check-terms-of-service-approval'

  load-metadata:
    runs-on: ubuntu-latest
    needs: verify-terms-of-service-approval
    outputs:
      extension-versions: ${{ steps.load.outputs.extension-versions }}
    steps:
      - name: Load Gradle Enterprise extension versions to publish Build Scans for
        id: load
        uses: gradle/github-actions/maven/build-scan/load-metadata@v1.0

  publish-build-scan:
    runs-on: ubuntu-latest
    needs: load-metadata
    strategy:
      matrix:
        version: ${{ fromJson(needs.load-metadata.outputs.extension-versions) }}
    steps:
      - name: Publish Maven Build Scans
        uses: gradle/github-actions/maven/build-scan/publish@v1.0
        with:
          gradle-enterprise-url: 'https://<MY_GE_URL>'
          gradle-enterprise-extension-version: ${{ matrix.version }}
          gradle-enterprise-access-key: ${{ secrets.<GE_ACCESS_KEY> }}
```
