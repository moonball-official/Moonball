# Moonball homepage redesign

Working branch: `redesign/clearer-homepage`, based on GitHub main `8441bf5`.

## What changed
- Introduces MOON in plain language, with clear pre-launch status and a prominent waitlist action.
- Uses a wider desktop layout, readable supporting text, gold accents, and the existing moon logo.
- Moves the existing charts, calculator, drawing results, and source details to `/dashboard`.
- Replaces repeated homepage explanations with three steps, concise risks, a short team introduction, and four expandable FAQs.
- Retains the existing waitlist endpoint, analytics events, jackpot feed, protocol page, and technical paper.
- Shows the source agreement count in the oracle UI instead of a confidence badge. Reference pricing is unchanged.
- Restores the first-load and refresh loading screen, and adds the Moonball favicon.
- Aligns the dashboard, protocol, and technical paper with the homepage visual style.
- Handles feed loading/errors without displaying old hard-coded jackpot values. Supports mobile navigation, keyboard focus, Escape, browser zoom, and reduced motion.
- Adds dashboard metadata, sitemap entry, and production route/redirect handling.

## Review locally
Run `npm run build`, then `npm run preview:design` from this folder. Open http://127.0.0.1:4173.

The preview reads public jackpot/cycle data from moonball.info. Signup and analytics stay local and are simulated; no email is stored or forwarded. Use `error@example.com` to inspect the signup error state, or another example.com address for the success state. The production site continues to use its existing API.

## Validation
- TypeScript check and production build.
- Four redesign tests: verified historical-cycle coverage, confidence thresholds, metadata separation, and actual production dashboard routing/redirects/404 behavior.
- Existing consensus-selection and Texas Lottery parsing tests.
- Browser review at desktop and phone widths; navigation, FAQs, signup success/error, and live jackpot rendering.

## Release
Publish the complete application from `main` through the existing Railway deployment. No database migration or on-chain deployment is required. The local preview script is separate from the production startup command, so the live waitlist continues to use its existing API.
