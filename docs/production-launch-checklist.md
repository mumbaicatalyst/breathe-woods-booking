# Breathe Woods production launch checklist

This checklist is for the first public launch with manual payment confirmation. Complete it before enabling the public booking links.

## 1. Existing bookings reconciliation — launch blocker

- [ ] Get Prashant's current booking source: Google Calendar export, sheet, screenshots, or a combination.
- [ ] Copy every active or future stay into [`existing-bookings-import-template.csv`](./existing-bookings-import-template.csv).
- [ ] Mark each record as `confirmed_guest`, `tentative_guest`, or `owner_use`.
- [ ] Map each stay to `zen`, `bougan`, or `entire_property`; record the number of rooms whenever known.
- [ ] Treat unclear room allocation as `needs_review`; do not guess.
- [ ] Reconcile check-in/check-out dates with Prashant. Check-out must not block the following night's arrival.
- [ ] Import confirmed guest stays without guest-facing notification emails.
- [ ] Import owner use and unresolved records as availability blocks until room allocation is confirmed.
- [ ] Compare the resulting owner calendar to Prashant's source calendar and obtain his sign-off.

## 2. Production configuration — launch blocker

- [ ] Create or confirm a separate production Supabase project. Do not reuse UAT data or credentials.
- [ ] Apply the reviewed database migrations and production daily-rate calendar.
- [ ] Create Prashant's production owner profile and test owner sign-in with a non-owner account as a negative test.
- [ ] Configure the final production website and owner dashboard URLs in Supabase Auth redirect settings.
- [ ] In Netlify, set only `VITE_APP_ENV=production`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Never add a service-role key.
- [ ] Build the booking app with `VITE_APP_BASE_PATH=/book/` and serve it under `breathewoods.com/book/`.
- [ ] Add a Netlify redirect so `/book/*` serves the booking application's `index.html`, including `/book/owner`.

### Final domain hand-off: GoDaddy / Wix to Netlify

Do this only after the Netlify staging site and production data have been signed off.

- [ ] In Netlify, add `breathewoods.com` and `www.breathewoods.com`; choose one as the primary domain.
- [ ] In GoDaddy, open **My Products → Domains → Manage DNS** and first check which nameservers are authoritative.
- [ ] If GoDaddy nameservers are in use, update the root-domain `A` and `www` `CNAME` website records with the exact values Netlify provides.
- [ ] If custom/Wix nameservers are in use, make those website-record changes at the authoritative DNS provider instead. Do not change nameservers merely to move the website.
- [ ] Preserve all `MX` and `TXT` records so existing domain email, forwarding, SPF and DKIM continue working.
- [ ] Verify `breathewoods.com`, `www.breathewoods.com`, `/book/`, and `/book/owner` after propagation.
- [ ] Keep Wix active until the new domain has worked reliably for at least one to two days; then cancel only the Wix service that is no longer needed.

## 3. Guest and owner workflow — launch blocker

- [ ] Test request submission from desktop and mobile.
- [ ] Test unavailable rooms, room blocks, overlapping dates, full villas, and full-property bookings.
- [ ] Test owner request review, alternative dates/stays, 12-hour manual payment hold, confirmation, expiry, and cancellation.
- [ ] Confirm pricing remains frozen for submitted requests and payment holds after an owner changes rates or campaigns.
- [ ] Confirm the cancellation guidance is correct for ordinary, long-weekend, festive, full-villa, and group stays.
- [ ] Confirm privacy, marketing-consent, and cancellation links open without losing booking progress.

## 4. Canonical website bundle and visual sign-off — launch blocker

- [ ] Deploy the static website only from the `netlify-preview` repository's approved release commit. Do not deploy from an older local preview folder.
- [ ] Build the booking application from the matching approved `breathe-woods-booking` release commit and place that build under `/book/` in the same Netlify deployment.
- [ ] Use a Netlify deploy-preview URL as the sole sign-off environment; do not use a browser's cached localhost page as release evidence.
- [ ] At 390px, verify the homepage, stays, property, dining, explore, information, contact and cancellation pages: header, footer, horizontal mobile wordmark, navigation and booking links.
- [ ] At 768px and 1280px, verify the same pages retain the desktop/tablet wordmark, layouts and footer links.
- [ ] At 390px and 1280px, verify `/book/` and `/book/owner`: branded header alignment, return link, booking flow and owner access.
- [ ] Check browser console output for errors and test a cache-bypassing refresh on every page before sign-off.
- [ ] Record the two release commit IDs and the approved deploy-preview URL before changing the live domain records.

## 5. Notifications and operating process — launch blocker

- [ ] Switch Make.com owner notification recipient and sender to `breathewoods@gmail.com`.
- [ ] Update the dashboard URL in Supabase `booking_app_url` to the live `/book/owner` address.
- [ ] Test the owner request email and guest confirmation email from production-style data.
- [ ] Confirm Make failures are visible and that queued notification rows can be retried.
- [ ] Agree a daily owner routine: review requests, action holds, confirm manual payments, and process cancellations/refunds.

## 6. Security gap closure and resilience — launch blocker

- [ ] Close the already identified public-form abuse gap: add rate limiting and a bot-control challenge such as Turnstile before sharing the booking form widely.
- [ ] Close the deployment-configuration gap: configure HTTPS, security headers/CSP, and restrictive production Supabase CORS/Auth settings.
- [ ] Close the dependency-audit gap: run the audit with working network access and resolve any high-severity findings.
- [ ] Close the secrets-exposure gap: verify no production secret is present in the website repository, browser configuration, screenshots, or Make webhook URLs.
- [ ] Perform a targeted final Security Review against these documented open gaps and their evidence of closure; do not restart a broad review from scratch.

## 7. First-week follow-up

- [ ] Add Google Analytics and booking-funnel analytics.
- [ ] Confirm Google Calendar view-only sync once the production calendar connection is ready.
- [ ] Review conversion, abandoned requests, pending payments, and owner response times after the first week.
