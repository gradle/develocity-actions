# github-actions
A collection of reusable and composite Github Actions

## gradle-check-tos
A reusable action to check that Gradle Terms of Service have been approved.

The action succeeds if the PR contributor(s) are recorded in the signature file, fails otherwise.

**Dependencies**:

- [cla-assistant-lite](https://github.com/marketplace/actions/cla-assistant-lite)

**Event Trigger**:
- `pull_request_target`
- `issue-comment`

**Action inputs**:

| Name                                   | Description                                                                | Default                                                                                                                                                    |
|----------------------------------------|----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `tos-location`                         | Terms Of Service location (URL or relative file)                           |                                                                                                                                                            |
| `signature-branch`                     | *Optional*: Git branch where the signature file will be stored             | `main`                                                                                                                                                     |
| `signature-location`                   | *Optional*: Signature file location                                        | `.github/gradle-enterprise-tos.json`                                                                                                                       |
| `pr-comment-tos-approval-missing`      | *Optional*: PR comment added when Terms of Service are not approved        | `Please accept [Gradle Enterprise Terms Of Service](<tos-location>) to get your PR Build Scan published by commenting this PR with the following message:` |
| `pr-comment-tos-approval-request`      | *Optional*: PR comment to approve the Terms of Service                     | `I have read Gradle Enterprise Terms Of Service and I hereby accept the Terms`                                                                             |
| `pr-comment-tos-approval-confirmation` | *Optional*: PR comment added when Terms of Service are approved            | `All Contributors have accepted Gradle Enterprise Terms Of Service.`                                                                                       |
| `white-list`                           | *Optional*: CSV List of users not required to approve the Terms of Service |                                                                                                                                                            |


**Usage**:

```yaml
name: Gradle - Terms of Service approval verification

on:
  issue_comment:
    types: [created]
  pull_request_target:

permissions:
  # required to update signature file
  contents: write
  # required to comment PR
  pull-requests: write
  # required to update PR status check
  actions: write
  statuses: write

jobs:
  gradle-check-tos:
    uses: gradle/github-actions/.github/workflows/check-tos.yml@v1.0
    with:
      # tos-location can point to a file in the repository with this syntax tos-location: /<owner>/<repo>/blob/<branch>/tos.html
      tos-location: 'https://foo.bar/tos.html'
      # Optional inputs
      #pr-comment-tos-approval-missing: 'Please accept [Gradle Enterprise Terms Of Service](<tos-location>) to get your PR build scan published by commenting this PR with the following message:'
      #pr-comment-tos-approval-request: 'I have read Gradle Enterprise Terms Of Service and I hereby accept the Terms'
      #pr-comment-tos-approval-validation: 'All Contributors have accepted Gradle Enterprise Terms Of Service.'
      #signature-branch: 'main'
      #signature-location: '.github/gradle-enterprise-tos.json'
      #white-list: 'bot1,bot2'
```
