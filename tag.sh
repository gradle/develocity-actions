#!/bin/zsh
git tag -fa -m "v0.1-ts" "v0.1-ts"
git push origin :refs/tags/v0.1-ts
git push --follow-tags -f