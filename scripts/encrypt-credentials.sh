#!/bin/bash
# Encrypt Firebase service account credentials for safe storage in repo
# Run this locally once to create the encrypted file

set -e

INPUT_FILE="${1:-firebase-service-account.json}"
OUTPUT_FILE="firebase-service-account.json.enc"

if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: Input file $INPUT_FILE not found"
  echo "Usage: ./scripts/encrypt-credentials.sh [path-to-service-account.json]"
  exit 1
fi

# Generate a random encryption key if not provided
if [ -z "$FIREBASE_ENCRYPTION_KEY" ]; then
  ENCRYPTION_KEY=$(openssl rand -base64 32)
  echo ""
  echo "Generated encryption key (save this in Netlify env vars as FIREBASE_ENCRYPTION_KEY):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$ENCRYPTION_KEY"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
else
  ENCRYPTION_KEY="$FIREBASE_ENCRYPTION_KEY"
  echo "Using existing FIREBASE_ENCRYPTION_KEY from environment"
fi

# Encrypt the file using OpenSSL (AES-256-CBC)
echo "Encrypting $INPUT_FILE..."
echo "$ENCRYPTION_KEY" | openssl enc -aes-256-cbc -a -salt -pbkdf2 -in "$INPUT_FILE" -out "$OUTPUT_FILE" -pass stdin

if [ -f "$OUTPUT_FILE" ]; then
  echo ""
  echo "✓ File encrypted successfully: $OUTPUT_FILE"
  echo ""
  echo "Next steps:"
  echo "1. Copy the encryption key above and add it to Netlify:"
  echo "   Site settings > Environment variables > Add variable"
  echo "   Key: FIREBASE_ENCRYPTION_KEY"
  echo "   Value: [paste the key]"
  echo ""
  echo "2. Commit the encrypted file to git:"
  echo "   git add $OUTPUT_FILE"
  echo "   git commit -m \"Add encrypted Firebase service account\""
  echo ""
  echo "3. The original $INPUT_FILE is in .gitignore and will NOT be committed"
else
  echo "Error: Failed to encrypt file"
  exit 1
fi
