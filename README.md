# github-actions

A collection of composite Github Actions

## gradle-check-tos

A composite action to check that Gradle Terms of Service have been approved.

The action succeeds if the pull-request contributors are recorded in the signature file, fails otherwise.

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
  gradle-check-tos:
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
        uses: gradle/github-actions/check-tos@v1.0
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

## maven/build-scan-save
A Composite action to save an unpublished Maven Build Scan®.

The action saves unpublished Build Scan® data as a workflow artifact with name `maven-build-scan-data`, which can then be published in a dependent workflow.

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
        uses: gradle/github-actions/maven/build-scan-save@v1.0
[...]```
