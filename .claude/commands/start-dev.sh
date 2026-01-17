#!/bin/bash

# Start dev server with optional timeout
# Usage: ./start-dev.sh [timeout_in_seconds]
# Example: ./start-dev.sh 30  (runs for 30 seconds then stops)
# Example: ./start-dev.sh     (runs indefinitely)

TIMEOUT=${1:-0}

if [ "$TIMEOUT" -gt 0 ]; then
    echo "Starting dev server for $TIMEOUT seconds..."
    echo "================================================"

    # Start pnpm dev in background and capture its PID
    pnpm dev &
    DEV_PID=$!

    # Wait for specified timeout
    sleep "$TIMEOUT"

    echo ""
    echo "================================================"
    echo "Timeout reached ($TIMEOUT seconds). Stopping dev server..."

    # Kill the dev server process group
    kill -TERM -$DEV_PID 2>/dev/null || kill -TERM $DEV_PID 2>/dev/null

    # Give it a moment to gracefully shut down
    sleep 2

    # Force kill if still running
    kill -9 -$DEV_PID 2>/dev/null || kill -9 $DEV_PID 2>/dev/null

    echo "Dev server stopped."
else
    echo "Starting dev server (no timeout)..."
    echo "Press Ctrl+C to stop."
    echo "================================================"
    pnpm dev
fi
