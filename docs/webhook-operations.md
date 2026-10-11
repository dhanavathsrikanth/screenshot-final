# Account and billing webhooks

Production application: `https://app.screenshotapi.tech`.

## Clerk account profiles

Endpoint: `POST /api/webhooks/clerk`. Configure `user.created` and `user.updated` in the production Clerk instance and store its signing secret as `CLERK_WEBHOOK_SIGNING_SECRET` in Vercel Production.

The route verifies Svix signatures with Clerk's `verifyWebhook`. It fetches the current user from the same Clerk instance before upserting `accounts.user_id`, `email` and `display_name`. Per-user transactions serialize retries. A deleted or nonexistent provider user is ignored; provider or database failures return 503 for retry. Profile events never grant a paid plan or credits. Existing synchronous account creation remains available while webhook delivery is pending.

User deletion is not implemented as financial-record deletion. Unsupported events are acknowledged without modifying the database. Existing users can be synced by replaying their real creation/update events from Clerk's dashboard.

## Dodo payment entitlements

Endpoint: `POST /api/webhook`. `DODO_PAYMENTS_WEBHOOK_KEY` verifies the raw request signature. `DODO_PAYMENTS_API_KEY` retrieves the latest provider payment/subscription before applying benefits. Environment and versioned product IDs must match the API key's mode.

Subscribe to `payment.succeeded`, `refund.succeeded`, and subscription `active`, `renewed`, `updated`, `plan_changed`, `cancelled`, `expired`, `on_hold`, `failed`, `paused`, `unpaused` events.

Tables: `accounts` stores the effective plan, prepaid balance, refund debt and customer ID; `subscriptions` stores verified provider status; `dodo_webhook_events` deduplicates deliveries; `dodo_credit_payments` tracks each payment's net credit grant. Database transactions preserve ownership and prevent duplicate grants. Product, USD price, quantity and checkout account metadata are checked. Only active subscriptions grant paid-plan access. Failed/pending payments do not grant credits. Confirmed pack refunds reduce the net grant, with debt retained when credits were already spent.

Checkout returns are verified through `/api/billing/verify`; query parameters alone cannot approve an upgrade. Both providers' routes bypass session middleware and require their own signatures. Invalid signatures return 401. Processing failures return 503 so providers retry.

Dodo currently uses **test mode**. Live payments require matching live API credentials, live products and a live webhook signing secret; test credentials cannot verify live payments.
