Deployment checklist — Vercel

1. Add environment variables in Vercel Dashboard
   - `VITE_CONVEX_URL` — Convex client URL (public, used by browser)
   - `VITE_CONVEX_SITE_URL` — (optional)
   - `CONVEX_DEPLOYMENT` — optional

2. Build settings
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. Do not expose secrets
   - Any secret used on the server must NOT start with `VITE_`. Store those values as non-prefixed env vars in Vercel and access them only in server-side functions.

4. SPA fallback
   - `vercel.json` in repo provides SPA routing (rewrites all routes to `index.html`).

5. Local verification
   - Create `.env.local` from `.env.example` (do not commit).
   - Run:
     ```bash
     npm ci
     npm run build
     npm run preview
     ```

6. Deploy
   - Connect repo to Vercel or run `vercel --prod` from your machine.

7. Post-deploy checks
   - Test upload flow, map interactions, and check browser console for errors.
