#!/usr/bin/env bash

# This script safely deletes the persistent SQLite memory database.
# Jared will automatically recreate a fresh, empty database on the next spin-up.

DB_PATH="./.jared/memory.db"

echo "Attempting to reset Jared's memory..."

if [ -f "$DB_PATH" ]; then
  rm "$DB_PATH"
  echo "🧹 Success! Jared's memory has been completely wiped!"
else
  echo "ℹ️ No memory database found at $DB_PATH. Jared's mind is already clear."
fi
