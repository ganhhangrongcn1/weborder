# POS Mobile React Native Plan

## Direction

Build a brand new native POS app with React Native / Expo.

Do not reuse the current Java APK as the main product path.

## Reuse from web POS

- `src/services/posService.js`
- `src/services/posPaymentService.js`
- Supabase contracts for:
  - `orders`
  - `order_items`
  - `pos_shifts`
  - payment session flow
  - print job flow

## Do not reuse directly

- Web JSX UI
- CSS
- React Router page layout
- DOM-only modal patterns

## Mobile app path

- `ghr-pos-mobile/`
- Native stack navigation
- POS composer hook
- Shared pure helpers for:
  - cash normalization
  - cash change
  - payment reference
  - order identity

## Delivery phases

1. Scaffold Expo app and POS home shell
2. Port login + branch session + active shift
3. Port cart + pager + cash payment flow
4. Port recent orders + busy pager guard
5. Port QR payment session flow
6. Add Android printer bridge
