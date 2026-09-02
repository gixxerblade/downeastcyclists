#!/usr/bin/env sh

set -eu

for env_file in .env .env.local; do
  if [ -f "$env_file" ]; then
    set -a
    . "./$env_file"
    set +a
  fi
done

template_target="${RESEND_UPCOMING_RENEWAL_TEMPLATE_ID:-membership-upcoming-renewal}"
template_alias="${RESEND_UPCOMING_RENEWAL_TEMPLATE_ALIAS:-$template_target}"
template_name="${RESEND_UPCOMING_RENEWAL_TEMPLATE_NAME:-membership-upcoming-renewal}"
from_address="${EMAIL_FROM:-Info <info@downeastcyclists.com>}"
subject="Your DEC membership renews on {{{RENEWAL_DATE}}}"

html_file="emails/membership-upcoming-renewal.html"
text_file="emails/membership-upcoming-renewal.txt"

if ! command -v resend >/dev/null 2>&1; then
  echo "resend CLI is required. Install with: npm install -g resend-cli" >&2
  exit 1
fi

if template_json="$(resend templates get "$template_target" --json 2>/dev/null)"; then
  template_id="$(printf '%s' "$template_json" | node -e "let input=''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => console.log(JSON.parse(input).id));")"
  resend templates update "$template_id" \
    --name "$template_name" \
    --alias "$template_alias" \
    --from "$from_address" \
    --subject "$subject" \
    --html-file "$html_file" \
    --text-file "$text_file" \
    --var MEMBER_NAME:string:Member \
    --var PLAN_NAME:string:"Down East Cyclists membership" \
    --var RENEWAL_DATE:string:"your membership renewal date" \
    --var PLAN_PRICE:string:'$30' \
    --var MANAGE_MEMBERSHIP_URL:string:"https://www.downeastcyclists.com/member" \
    --json
else
  resend templates create \
    --name "$template_name" \
    --alias "$template_alias" \
    --from "$from_address" \
    --subject "$subject" \
    --html-file "$html_file" \
    --text-file "$text_file" \
    --var MEMBER_NAME:string:Member \
    --var PLAN_NAME:string:"Down East Cyclists membership" \
    --var RENEWAL_DATE:string:"your membership renewal date" \
    --var PLAN_PRICE:string:'$30' \
    --var MANAGE_MEMBERSHIP_URL:string:"https://www.downeastcyclists.com/member" \
    --json
fi

resend templates publish "$template_alias" --json
