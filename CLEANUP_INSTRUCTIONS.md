# Git Cleanup Instructions

## Option 1: Remove from Current Commit Only (Recommended)

This is the simplest approach - just remove the files from the current state and future commits:

```bash
cd DSober

# Remove temporary SQL files (keep migrations)
git rm emergency_fix.sql
git rm test_rls_functions.sql
git rm check_user_state.sql
git rm check_haijayousif_requests.sql
git rm diagnose_dd_request_issue.sql
git rm unrevoke_user.sql

# Remove temporary markdown files
git rm ONBOARDING_LOOP_FIX.md
git rm REALTIME_OPTIMIZATION.md
git rm APPLY_PROFILE_FIX.md

# Commit the removal
git commit -m "chore: remove temporary SQL and markdown files"

# Push to remote
git push origin main
```

The `.gitignore` has been updated to prevent these files from being committed in the future.

---

## Option 2: Remove from Git History (Advanced)

⚠️ **WARNING**: This rewrites git history and requires all team members to re-clone!

### Prerequisites
Install git-filter-repo:
```bash
# macOS
brew install git-filter-repo

# Or using pip
pip3 install git-filter-repo
```

### Steps

1. **Backup your repository first!**
   ```bash
   cd ..
   cp -r DSober DSober-backup
   cd DSober
   ```

2. **Remove files from history:**
   ```bash
   # Remove temporary SQL files
   git filter-repo --invert-paths \
       --path emergency_fix.sql \
       --path test_rls_functions.sql \
       --path check_user_state.sql \
       --path check_haijayousif_requests.sql \
       --path diagnose_dd_request_issue.sql \
       --path unrevoke_user.sql \
       --force
   
   # Remove temporary markdown files
   git filter-repo --invert-paths \
       --path ONBOARDING_LOOP_FIX.md \
       --path REALTIME_OPTIMIZATION.md \
       --path APPLY_PROFILE_FIX.md \
       --force
   ```

3. **Force push to remote:**
   ```bash
   git remote add origin <your-repo-url>
   git push origin --force --all
   git push origin --force --tags
   ```

4. **Notify team members:**
   All team members must either:
   - Re-clone the repository, OR
   - Run: `git fetch origin && git reset --hard origin/main`

---

## Option 3: Using BFG Repo-Cleaner (Alternative)

BFG is faster than git-filter-repo for large repos:

```bash
# Install BFG
brew install bfg

# Remove files
bfg --delete-files emergency_fix.sql
bfg --delete-files test_rls_functions.sql
bfg --delete-files check_user_state.sql
bfg --delete-files check_haijayousif_requests.sql
bfg --delete-files diagnose_dd_request_issue.sql
bfg --delete-files unrevoke_user.sql
bfg --delete-files ONBOARDING_LOOP_FIX.md
bfg --delete-files REALTIME_OPTIMIZATION.md
bfg --delete-files APPLY_PROFILE_FIX.md

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

---

## What's Been Updated

### .gitignore
The `.gitignore` file has been updated to:
- ✅ Keep `supabase/migrations/*.sql` (important for database schema)
- ❌ Ignore temporary SQL files (check_*.sql, diagnose_*.sql, etc.)
- ❌ Ignore temporary markdown files (*_FIX.md, *_OPTIMIZATION.md, etc.)

### Files to Remove
**Temporary SQL files:**
- emergency_fix.sql
- test_rls_functions.sql
- check_user_state.sql
- check_haijayousif_requests.sql
- diagnose_dd_request_issue.sql
- unrevoke_user.sql

**Temporary markdown files:**
- ONBOARDING_LOOP_FIX.md
- REALTIME_OPTIMIZATION.md
- APPLY_PROFILE_FIX.md

**Files to KEEP:**
- ✅ All files in `supabase/migrations/` (database migrations)
- ✅ README.md, ARCHITECTURE.md, PROJECT_STRUCTURE.md (documentation)

---

## Recommendation

For most cases, **Option 1** is sufficient. It removes the files from the current state and prevents them from being committed in the future. The old commits will still have these files, but they won't appear in new commits.

Only use **Option 2 or 3** if:
- The files contain sensitive information
- You need to reduce repository size significantly
- You're okay with rewriting history and coordinating with your team
