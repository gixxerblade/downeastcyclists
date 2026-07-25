#!/usr/bin/env sh

set -eu

for env_file in .env .env.local; do
  if [ -f "$env_file" ]; then
    set -a
    . "./$env_file"
    set +a
  fi
done

alias_name="${RESEND_ORGANIZER_ACCESS_TEMPLATE_ID:-organizer-access-granted}"
template_name="${RESEND_ORGANIZER_ACCESS_TEMPLATE_NAME:-Organizer Access Granted}"
from_address="${EMAIL_FROM:-Down East Cyclists <noreply@downeastcyclists.com>}"
support_email="${SUPPORT_EMAIL:-${ADMIN_EMAIL:-info@downeastcyclists.com}}"
subject="You now have organizer access to {{{ORG_NAME}}}"

html_file="emails/organizer-access-granted.html"
text_file="emails/organizer-access-granted.txt"

if ! command -v resend >/dev/null 2>&1; then
  echo "resend CLI is required. Install with: npm install -g resend-cli" >&2
  exit 1
fi

if resend templates get "$alias_name" --json >/dev/null 2>&1; then
  resend templates update "$alias_name" \
    --name "$template_name" \
    --alias "$alias_name" \
    --from "$from_address" \
    --subject "$subject" \
    --html-file "$html_file" \
    --text-file "$text_file" \
    --var USER_NAME:string:there \
    --var USER_EMAIL:string \
    --var ORG_NAME:string:"Down East Cyclists" \
    --var LOGIN_URL:string \
    --var DASHBOARD_URL:string \
    --var GRANTED_BY_NAME:string:"a site administrator" \
    --var SUPPORT_EMAIL:string:"$support_email" \
    --json
else
  resend templates create \
    --name "$template_name" \
    --alias "$alias_name" \
    --from "$from_address" \
    --subject "$subject" \
    --html-file "$html_file" \
    --text-file "$text_file" \
    --var USER_NAME:string:there \
    --var USER_EMAIL:string \
    --var ORG_NAME:string:"Down East Cyclists" \
    --var LOGIN_URL:string \
    --var DASHBOARD_URL:string \
    --var GRANTED_BY_NAME:string:"a site administrator" \
    --var SUPPORT_EMAIL:string:"$support_email" \
    --json
fi

resend templates publish "$alias_name" --json
