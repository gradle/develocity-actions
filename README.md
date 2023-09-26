# github-actions

A collection of composite Github Actions

## terms-of-service-acceptance/run

A composite action to verify that Develocity Terms of Service have been accepted.

This action checks if the user submitting a pull-request has accepted the Terms of Service.
If the user has previously accepted the terms, then the action succeeds.
If not, a comment is made on the pull-request asking the user to accept and the action fails. The user can then accept the Terms of Service by responding with a specific comment on the pull-request.

See the [cla-assistant-lite documentation](https://github.com/marketplace/actions/cla-assistant-lite) for more details.

**Dependencies**:

- [cla-assistant-lite](https://github.com/marketplace/actions/cla-assistant-lite)

**Event Triggers**:

This action should be configured to respond to the following event triggers:
- `pull_request_target`: to check if the user has previously accepted the Terms of Service when submitting the pull-request.
- `issue-comment`: to check if any new pull-request comment is accepting the Terms of Service.

**Permissions**:

The following permissions are required for this action to operate:
- `contents: write`: to create/edit the signature file
- `pull-requests: write`: to comment the pull-request
- `actions: write`: to update the pull-request status check
- `statuses: write`: to update the pull-request status check

**Action inputs**:

| Name                                     | Description                                                                                    | Default                                                                                                                                                      |
|------------------------------------------|------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `tos-location`                           | Terms Of Service location (URL)                                                                |                                                                                                                                                              |
| `signature-branch`                       | *Optional*: Git branch where the signature file will be stored                                 | `${{ github.event.repository.default_branch }}`                                                                                                              |
| `signature-location`                     | *Optional*: Signature file location                                                            | `.github/develocity-tos.json`                                                                                                                                |
| `pr-comment-tos-acceptance-missing`      | *Optional*: pull-request comment added when Terms of Service have not previously been accepted | `Please accept [Develocity Terms Of Service]({0}) to get your pull-request Build Scan published by commenting this pull-request with the following message:` |
| `pr-comment-tos-acceptance-request`      | *Optional*: pull-request comment to accept the Terms of Service                                | `I have read Develocity Terms Of Service and I hereby accept the Terms`                                                                                      |
| `pr-comment-tos-acceptance-confirmation` | *Optional*: pull-request comment added when Terms of Service are accepted                      | `All Contributors have accepted Develocity Terms Of Service.`                                                                                                |
| `white-list`                             | *Optional*: CSV List of users not required to accept the Terms of Service                      | `''`                                                                                                                                                         |
| `github-token`                           | *Optional*: Github token                                                                       | `${{ github.token }}`                                                                                                                                        |

**Usage**:

```yaml
name: Gradle - Terms of Service acceptance verification

on:
  # issue_comment event is triggered when a pull-request is commented
  issue_comment:
    types: [ created ]
  pull_request_target:

jobs:
  run-terms-of-service-acceptance:
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
      - name: Run Terms of Service acceptance verification
        uses: gradle/github-actions/terms-of-service-acceptance/run@v1.0
        with:
          # tos-location can also point to a file in a Github repository with this syntax: /<owner>/<repo>/blob/<branch>/tos.html
          tos-location: 'https://foo.bar/tos.html'
          # Optional inputs
          #pr-comment-tos-acceptance-missing: 'Please accept [Develocity Terms Of Service]({0}) to get your pull-request Build Scan published by commenting this pull-request with the following message:'
          #pr-comment-tos-acceptance-request: 'I have read Develocity Terms Of Service and I hereby accept the Terms'
          #pr-comment-tos-acceptance-validation: 'All Contributors have accepted Develocity Terms Of Service.'
          #signature-branch: 'main'
          #signature-location: '.github/develocity-tos.json'
          #white-list: 'bot1,bot2'
          #github-token: ${{ secrets.MY_PAT }}
```

## maven-build-scan/save
A Composite action to save an unpublished Maven Build Scan®.

The action saves unpublished Build Scan® data as a workflow artifact with name `maven-build-scan-data`, which can then be published in a dependent workflow.

Use this action in your existing pull-request workflows to allow Build Scan® to be published. Since these workflows are running in an untrusted context, they do not have access to the required secrets to publish the Build Scan® directly.

Since the Develocity Maven Extension only saves the Build Scan® data for the most recent Maven execution, a step using this action must be inserted after each Maven execution step in the workflow.

**Dependencies**:

- [actions/upload-artifact](https://github.com/marketplace/actions/upload-a-build-artifact)

**Event Triggers**:

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
        uses: gradle/github-actions/maven-build-scan/save@v1.0
[...]
```

## maven-build-scan/publish

This action will publish all Maven Build Scans® that have been saved as workflow artifacts by the `maven-build-scan/save` action.

Use this action in a separate workflow with a `workflow_run` event trigger, that will run after an existing pull-request workflow has completed. The action will download any saved Build Scan® and publish them to Develocity.
This event allows access to the repository secrets (_Develocity Access Key_) which is required to publish a Build Scan® to Gradle Enterprise when authentication is enabled.

The Build Scan® publication requires the Gradle Terms of Service to be accepted, this can be achieved by adding a workflow using the `terms-of-service-acceptance/run` action.
The `terms-of-service-acceptance/verify` action is used to ensure this workflow passed successfully. 

**Dependencies**:

- [dawidd6/action-download-artifact](https://github.com/marketplace/actions/download-workflow-artifact)

**Event Triggers**:

This action should be configured to respond to the following event trigger:
- `workflow_run`: to run after the pull-request workflow.

**Permissions**:

The following permissions are required for this action to operate:
- `pull-requests: write`: to comment the pull-request

**Action inputs**:

| Name                          | Description                                   | Default               |
|-------------------------------|-----------------------------------------------|-----------------------|
| `develocity-url`              | Develocity URL                                |                       |
| `develocity-access-key`       | *Optional*: Develocity access key             |                       |
| `develocity-allow-untrusted`  | *Optional*: Develocity allow-untrusted flag   | `false`               |
| `github-token`                | *Optional*: Github token                      | `${{ github.token }}` |

**Usage**:

_Note:_
Some parameters need to be adjusted here:
- The workflow name (here `PR Check`) has to be adjusted to the `name` used in the workflow run to validate pull-requests
- The workflow-job-name (here `run-terms-of-service-acceptance`) has to be adjusted to the job `name` used in the workflow to verify the Terms of Service approval.
- The Develocity URL (here `https://<MY_DEVELOCITY_URL>`)
- The secret name holding the Develocity access key (here `<DEVELOCITY_ACCESS_KEY>`)

```yaml
name: Publish Maven Build Scans

on:
  workflow_run:
    workflows: [ "PR Check" ]
    types: [ completed ]

jobs:

  publish-build-scans:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - name: Verify Terms of Service acceptance job passed
        uses: gradle/github-actions/terms-of-service-acceptance/verify@v1.0
        with:
          terms-of-service-acceptance-workflow-job-name: 'run-terms-of-service-acceptance'
      - name: Publish Maven Build Scans
        uses: gradle/github-actions/maven-build-scan/publish@v1.0
        with:
          develocity-url: 'https://<MY_DEVELOCITY_URL>'
          develocity-access-key: ${{ secrets.<DEVELOCITY_ACCESS_KEY> }}
```
