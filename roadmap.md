# MoiJournal roadmap

## Done

- [x] Design system, landing page and brand icon
- [x] Signup (name, vibe, theme, username + password, recovery code) / login / recovery
- [x] Bookshelf dashboard with covers and plan limits (2/10 free, 10/50 premium)
- [x] Writing page (editable date/time, mood, scribble pad, signature)
- [x] End-to-end encryption — the server stores ciphertext only
- [x] Designed PDF export, built on the device
- [x] Render API (`server/`) plus the same-origin `/api` proxy
- [x] Deployed to Render + Vercel, with the shared secret and env vars in place
- [x] Premium by UPI: deep link, a claim filed with the payer's UPI ID, admin approval
- [x] Admin dashboard at `/admin` (payments, plans, users — never diary content)
- [x] Forgot username, recovered from the recovery code alone
- [x] Installable PWA with an App page, plus the SEO groundwork

## Next

- [ ] Package the Android APK (the site installs as a PWA today — see `/get-app`)
- [ ] Search across a book once books get long
- [ ] Email or Instagram notifications when a payment is approved
- [ ] Upload the FamPay QR image to the upgrade page
