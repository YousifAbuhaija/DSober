#!/bin/bash
# Database Helper Script - Ensures we always work with CLOUD database

set -e

CLOUD_PROJECT_REF="ybsinrajanwhabgivsvv"
CLOUD_DASHBOARD="https://supabase.com/dashboard/project/${CLOUD_PROJECT_REF}"

echo "🌩️  Supabase Cloud Helper"
echo "========================"
echo ""

case "$1" in
  "link")
    echo "🔗 Linking to cloud project..."
    supabase link --project-ref $CLOUD_PROJECT_REF
    ;;
    
  "push")
    echo "⬆️  Pushing migrations to CLOUD..."
    echo "⚠️  This will modify your PRODUCTION database!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      supabase db push --linked
    else
      echo "Cancelled."
    fi
    ;;
    
  "status")
    echo "📊 Cloud migration status:"
    supabase migration list --linked
    ;;
    
  "dashboard")
    echo "🌐 Opening Supabase Dashboard..."
    open "${CLOUD_DASHBOARD}"
    ;;
    
  "sql")
    echo "🌐 Opening SQL Editor..."
    open "${CLOUD_DASHBOARD}/sql/new"
    ;;
    
  "editor")
    echo "🌐 Opening Table Editor..."
    open "${CLOUD_DASHBOARD}/editor"
    ;;
    
  "check-users")
    echo "👥 Checking users in CLOUD database..."
    echo "Opening Table Editor - check the 'users' table"
    open "${CLOUD_DASHBOARD}/editor"
    ;;
    
  "deploy-function")
    if [ -z "$2" ]; then
      echo "Usage: $0 deploy-function <function-name>"
      echo "Example: $0 deploy-function send-notification"
      exit 1
    fi
    echo "🚀 Deploying edge function: $2"
    supabase functions deploy "$2" --project-ref $CLOUD_PROJECT_REF
    ;;
    
  "functions")
    echo "🌐 Opening Functions Dashboard..."
    open "${CLOUD_DASHBOARD}/functions"
    ;;
    
  *)
    echo "Usage: $0 {link|push|status|dashboard|sql|editor|check-users|deploy-function|functions}"
    echo ""
    echo "Commands:"
    echo "  link                    - Link CLI to cloud project"
    echo "  push                    - Push migrations to cloud (CAREFUL!)"
    echo "  status                  - Show cloud migration status"
    echo "  dashboard               - Open Supabase Dashboard"
    echo "  sql                     - Open SQL Editor"
    echo "  editor                  - Open Table Editor"
    echo "  check-users             - Check users in cloud database"
    echo "  deploy-function <name>  - Deploy edge function to cloud"
    echo "  functions               - Open Functions Dashboard"
    echo ""
    echo "⚠️  This project uses CLOUD ONLY - no local database"
    exit 1
    ;;
esac
