#!/usr/bin/env bash

total_lines=$(find src -name "*.js" | xargs wc -l | tail -n 1 | awk '{print $1}')
echo "======================================"
echo "🐈 Jared Core Agent Lines of Code: $total_lines"
echo "======================================"
echo "We are staying ultra-lightweight (under 3,000 LOC target)!"
