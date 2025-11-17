#!/bin/bash

# Simple script to remove temporary SQL and markdown files from git
# This only removes them from the current commit, not from history

echo "🧹 Removing temporary files from git..."
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Remove temporary SQL files
echo "Removing temporary SQL files..."
git rm -f emergency_fix.sql 2>/dev/null
git rm -f test_rls_functions.sql 2>/dev/null
git rm -f check_user_state.sql 2>/dev/null
git rm -f check_haijayousif_requests.sql 2>/dev/null
git rm -f diagnose_dd_request_issue.sql 2>/dev/null
git rm -f unrevoke_user.sql 2>/dev/null

# Remove temporary markdown files
echo "Removing temporary markdown files..."
git rm -f ONBOARDING_LOOP_FIX.md 2>/dev/null
git rm -f REALTIME_OPTIMIZATION.md 2>/dev/null
git rm -f APPLY_PROFILE_FIX.md 2>/dev/null

# Also remove this cleanup script and instructions
git rm -f remove_temp_files.sh 2>/dev/null
git rm -f cleanup_git_history.sh 2>/dev/null
git rm -f CLEANUP_INSTRUCTIONS.md 2>/dev/null

echo ""
echo "✅ Files removed from git staging"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Commit: git commit -m 'chore: remove temporary SQL and markdown files'"
echo "3. Push: git push origin main"
echo ""
echo "Note: These files will still exist in git history, but won't be in future commits."
echo "The .gitignore has been updated to prevent them from being committed again."
