#!/usr/bin/env sh
set -eu

# Create only: never overwrite later edits made in the Resend dashboard.
# The Resend CLI can use its saved login or RESEND_API_KEY from the environment.
resend templates create \
  --name 'Liability Waiver Invitation' \
  --alias liability-waiver-invitation \
  --from "${EMAIL_FROM:-Down East Cyclists <noreply@downeastcyclists.com>}" \
  --subject 'Action required: sign your Down East Cyclists liability waiver' \
  --html-file emails/liability-waiver-invitation.html \
  --text-file emails/liability-waiver-invitation.txt \
  --var MEMBER_NAME:string:Member \
  --var WAIVER_TITLE:string \
  --var SIGN_URL:string \
  --var INTRO:string \
  --var MEMBER_NAME_HTML:string:Member \
  --var WAIVER_TITLE_HTML:string \
  --var SIGN_URL_HTML:string \
  --var INTRO_HTML:string \
  --json

resend templates publish liability-waiver-invitation --json
