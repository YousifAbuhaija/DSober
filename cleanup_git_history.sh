#!/bin/bash

# This script removes SQL and markdown files from git history
# while preserving supabase/migrations/*.sql files

echo "⚠️  WARNING: This will rewrite git history!"
echo "Make sure you have a backup and all team members are aware."
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "🧹 Removing temporary SQL files from git history..."

# Remove specific temporary SQL files
git filter-repo --invert-paths \
    --path emergency_fix.sql \
    --path test_rls_functions.sql \
    --path check_user_state.sql \
    --path check_haijayousif_requests.sql \
    --path diagnose_dd_request_issue.sql \
    --path unrevoke_user.sql \
    --force

echo ""
echo "🧹 Removing temporary markdown files from git history..."

# Remove specific temporary markdown files
git filter-repo --invert-paths \
    --path ONBOARDING_LOOP_FIX.md \
    --path REALTIME_OPTIMIZATION.md \
    --path APPLY_PROFILE_FIX.md \
    --force

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Review the changes: git log --oneline"
echo "2. Force push to remote: git push origin --force --all"
echo "3. Notify team members to re-clone the repository"
echo ""
echo "⚠️  Note: All team members will need to re-clone or reset their local repos!"
