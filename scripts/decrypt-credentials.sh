#!/bin/bash
# Decrypt Firebase service account credentials at build time
# This allows us to store encrypted credentials in the repo and avoid the 4KB env var limit

set -e

ENCRYPTED_FILE="firebase-service-account.json.enc"
OUTPUT_FILE="firebase-service-account.json"
ENCRYPTION_KEY="${FIREBASE_ENCRYPTION_KEY}"

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "Error: FIREBASE_ENCRYPTION_KEY environment variable not set"
  exit 1
fi

if [ ! -f "$ENCRYPTED_FILE" ]; then
  echo "Error: Encrypted file $ENCRYPTED_FILE not found"
  exit 1
fi

# Decrypt the file using OpenSSL (AES-256-CBC)
echo "Decrypting Firebase service account credentials..."
echo "$ENCRYPTION_KEY" | openssl enc -aes-256-cbc -d -a -pbkdf2 -in "$ENCRYPTED_FILE" -out "$OUTPUT_FILE" -pass stdin

if [ -f "$OUTPUT_FILE" ]; then
  echo "✓ Firebase credentials decrypted successfully"
else
  echo "Error: Failed to decrypt credentials"
  exit 1
fi
