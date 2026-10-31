# Troubleshooting Guide

## Common Issues & Solutions

### 1. Host Blocked Error
```
Error: This host is not allowed. To allow this host, add "..." to `server.allowedHosts` in vite.config.js
```

**Solution**: Already fixed in vite.config.ts
- Wildcard pattern `.vercel.run` will allow all future preview hosts
- No further action needed

**Verification**:
```bash
cat vite.config.ts | grep -A 5 "allowedHosts"
```

---

### 2. Component Not Found Error
```
Error: Cannot find module '@/components/ui/[component-name]'
```

**Solution**: Check if component exists in src/components/ui/
```bash
ls src/components/ui/
```

All core components are created:
- ✅ button.tsx
- ✅ input.tsx
- ✅ textarea.tsx
- ✅ select.tsx
- ✅ card.tsx

---

### 3. TypeScript Compilation Errors
```
Error: Property does not exist on type
```

**Solution**: Run type check
```bash
pnpm exec tsc --noEmit
```

**Current Status**: ✅ PASSING

---

### 4. Dev Server Not Starting
```
Error: Port already in use
```

**Solution**: 
- Vite automatically tries next port
- Current ports: 8080, 8081, 8082+
- Check which port is being used:
```bash
lsof -i :8082
```

---

### 5. Routing Not Working
```
Issue: Sidebar links don't navigate
```

**Solution**:
1. Check React Router setup in App.tsx
2. Verify route paths match sidebar links
3. Ensure pages are lazy-loaded correctly

**Test**: Click sidebar items, verify URL changes

---

### 6. Mock Data Not Displaying
```
Issue: Pages showing empty data
```

**Solution**:
1. Check if mock data arrays are defined
2. Verify useState is initialized with mock data
3. Check useEffect for data loading

**Example Fix**:
```tsx
const MOCK_CLIENTS = [/* data */];
const [clients, setClients] = useState(MOCK_CLIENTS);
```

---

### 7. Styling Issues
```
Issue: Tailwind classes not applying
```

**Solution**:
1. Verify tailwind.config.ts includes all templates
2. Check globals.css imports
3. Rebuild: `npm run build`

**Current**: ✅ Light theme properly configured

---

### 8. Network/CORS Errors
```
Error: CORS policy blocked
```

**Why Not Happening**: Mock data is all local
- No external API calls
- No cross-origin requests
- Status: ✅ No CORS issues

---

### 9. localStorage Errors
```
Issue: Data not persisting
```

**Solution**: Check browser localStorage settings
```bash
# In browser console:
localStorage.getItem('clients')
```

Mock data uses localStorage for AddClient saves - works in all modern browsers

---

### 10. Performance Issues
```
Issue: App running slow
```

**Debug**:
```bash
# Check bundle size
npm run build

# Check dev performance
# Open DevTools > Performance tab
# Record and analyze
```

---

## Quick Diagnostics

### Check Everything is Working
```bash
# 1. Type check
pnpm exec tsc --noEmit

# 2. Lint check
pnpm exec eslint .

# 3. Run tests
pnpm test

# 4. Start dev
npm run dev
```

**Expected**: All pass ✅

### Verify Mock Data
```bash
# In browser console:
console.log(localStorage.getItem('clients'))

# Should show client data if saved
```

### Test Routing
```bash
# 1. Open app in browser
# 2. Click sidebar items
# 3. Verify URL changes
# 4. Verify page content loads
```

**Expected**: All pages load with correct data

---

## Reset Instructions

### Clear All Cache
```bash
# Clear npm cache
npm cache clean --force

# Clear node_modules
rm -rf node_modules
npm install

# Clear browser cache
# DevTools > Application > Clear Site Data
```

### Reset localStorage
```bash
# In browser console:
localStorage.clear()
```

---

## File Locations Reference

| Item | Location |
|------|----------|
| Vite Config | vite.config.ts |
| Routes | src/App.tsx |
| Pages | src/pages/*.tsx |
| Components | src/components/ui/*.tsx |
| Sidebar | src/components/layout/Sidebar.tsx |
| Tailwind | tailwind.config.ts |
| TypeScript | tsconfig.json |
| Mock Data | Each page file |

---

## Contact Issues

If issues persist:

1. Check the **VERIFICATION_REPORT.md** for full status
2. Review **tsconfig.json** for path mappings
3. Verify **vite.config.ts** allowedHosts
4. Check browser console for specific errors
5. Review page source for missing imports

---

Last Updated: 2026-06-16
Status: ✅ All systems operational
