# GHR POS Mobile

React Native / Expo app scaffold for the new native POS APK.

## Goal

- Native mobile POS app
- No WebView
- Reuse POS business logic and Supabase contract from the web POS
- Add printer bridge later as a native module

## First run

```bash
npm install
npm run start
```

## Environment

Create `.env` in this folder:

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## Current scope

- Expo app shell
- POS home screen scaffold
- Cart/menu/payment composer hook
- Shared POS payment and order identity helpers copied from web POS

## Next steps

- Wire real Supabase login and shift session
- Port recent orders, busy pagers, cancel order
- Port `createPosTakeawayOrder` flow into mobile service layer
- Add printer bridge for Android POS devices
