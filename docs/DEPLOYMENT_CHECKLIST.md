# GitHub Deployment Checklist

This checklist verifies that the codebase is ready for deployment to GitHub.

## ✅ Pre-Deployment Verification

### Security
- [x] No `.env.local` or `.env` files committed (checked - properly gitignored)
- [x] No API keys or secrets hardcoded in source code
- [x] `.gitignore` properly configured for sensitive files
- [x] No personal information or credentials in code
- [x] Test/development endpoints removed (`test-db` API route removed)

### Code Quality
- [x] No build artifacts committed (`tsconfig.tsbuildinfo` removed)
- [x] Empty directories removed (`apps/web/types/`)
- [x] Scripts verified and working from new locations
- [x] All scripts are executable and properly configured

### Documentation
- [x] README.md is complete and up-to-date
- [x] Setup instructions are clear
- [x] Documentation organized in `docs/` directory
- [x] Script paths updated in README

### Project Structure
- [x] Clean project structure
- [x] Scripts organized in `scripts/` directory
- [x] Documentation organized in `docs/` directory
- [x] No irrelevant files in root directory

### Git Status
- [x] All cleanup changes are staged/unstaged (ready to commit)
- [x] No sensitive files in git history (verify with `git log` if needed)

## 📋 Before Pushing to GitHub

### 1. Review Changes
```bash
git status
git diff
```

### 2. Stage Cleanup Changes
```bash
# Add new files
git add docs/ scripts/ 

# Add modified files
git add README.md apps/web/

# Remove deleted files (they should show as 'D' in git status)
git add -u
```

### 3. Verify No Sensitive Data
```bash
# Double-check no .env files are staged
git diff --cached --name-only | grep -E "\.env"

# Check for any secrets in staged files
git diff --cached | grep -iE "(password|secret|api[_-]?key|token)" | grep -v "NEXT_PUBLIC_" | grep -v "example" | grep -v "template"
```

### 4. Create Commit
```bash
git commit -m "chore: clean up codebase and organize files

- Remove test-db API endpoint
- Remove empty types directory
- Remove build artifacts
- Organize documentation into docs/ directory
- Move scripts to scripts/ directory
- Update README with new paths
- Verify all scripts work from new locations"
```

### 5. Optional: Create .env.example
Consider creating an `.env.example` file in `apps/web/` with placeholder values:
```bash
# Create .env.example template
cat > apps/web/.env.example << 'EOF'
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/alithos_terminal?schema=public"
NEXT_PUBLIC_PRIVY_APP_ID="your-privy-app-id"

# Optional
NEXT_PUBLIC_POLYMARKET_CLOB_API_KEY=""
NEXT_PUBLIC_POLYMARKET_SUBGRAPH_URL=""
GROK_API_KEY=""
OPENAI_API_KEY=""
TELEGRAM_BOT_TOKEN=""
EOF
```

### 6. Push to GitHub
```bash
# If this is a new repository
git remote add origin <your-github-repo-url>
git push -u origin main

# If repository already exists
git push origin main
```

## ⚠️ Important Notes

1. **Never commit `.env.local`** - It's in `.gitignore` but double-check before pushing
2. **Review all changes** - Make sure no sensitive data is included
3. **Consider adding a LICENSE** - If this is an open-source project
4. **Update repository description** - Add a clear description on GitHub
5. **Set up GitHub Actions** - Consider adding CI/CD workflows if needed

## ✅ Post-Deployment

After pushing to GitHub:
- [ ] Verify repository is accessible
- [ ] Check that sensitive files are not visible
- [ ] Test cloning the repository in a fresh directory
- [ ] Verify README instructions work for new users
- [ ] Consider adding GitHub Actions for automated testing

## 🔒 Security Best Practices

1. **Environment Variables**: All sensitive data should be in `.env.local` (gitignored)
2. **API Keys**: Never commit API keys - use environment variables
3. **Database URLs**: Never commit database connection strings
4. **Secrets**: Use GitHub Secrets for CI/CD if needed
5. **Review Commits**: Always review `git diff` before committing

## 📝 Additional Recommendations

1. **Add a LICENSE file** if this is open-source
2. **Add CONTRIBUTING.md** if accepting contributions
3. **Add .github/workflows/** for CI/CD
4. **Add issue templates** for bug reports and feature requests
5. **Consider adding a CHANGELOG.md** for version tracking

