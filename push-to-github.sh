#!/bin/bash
cd /home/takan/concafe-app
echo "=== Git Status ==="
git status
echo ""
echo "=== Adding changes ==="
git add .
echo ""
echo "=== Committing ==="
git commit -m "update: 最新の変更を反映"
echo ""
echo "=== Pushing to GitHub ==="
git push origin main
echo ""
echo "=== Done ==="
