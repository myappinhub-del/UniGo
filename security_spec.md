# UniGo Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity Integrity**: Every user document (`users/{userId}`), partner document (`partners/{partnerId}`), order (`orders/{orderId}`), and notification (`notifications/{notificationId}`) must bind ownership (`uid` / `userId`) strictly to `request.auth.uid`.
2. **Privilege Isolation**: Users cannot self-assign `super_admin` or `franchise_admin` roles on creation or profile update; only verified administrators (`myappinhub@gmail.com` or `admins/{uid}`) may alter `role` or `walletBalance` or write `catalog_items` and `franchise_zones`.
3. **PII Isolation**: Customer email, phone, and exact street addresses live in `users/{userId}` (owner/admin only) and `orders/{orderId}` (owner, assigned partner, or admin only). Open partner discovery uses non-PII `dispatch_jobs/{jobId}`.
4. **Atomic Job Sync**: Every `dispatch_jobs/{jobId}` creation requires `existsAfter(/databases/$(database)/documents/orders/$(jobId))`, ensuring no orphaned dispatch jobs.
5. **Terminal State Lock**: Orders and dispatch jobs in `delivered`, `completed`, or `cancelled` states cannot be reopened or mutated by non-admin callers.
6. **Temporal & Size Bounds**: Every string field enforces strict `.size()` limits, document IDs match `^[a-zA-Z0-9_\-]+$`, and `createdAt`/`updatedAt` match `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Role Escalation**: Authenticated user creates `users/{uid}` with `role: "super_admin"`. -> `PERMISSION_DENIED`.
2. **Profile Role Tampering**: Authenticated user updates `users/{uid}` with `affectedKeys: ["role"]`. -> `PERMISSION_DENIED`.
3. **Shadow Field Injection**: User creates order with extra undocumented key `isFreeOrder: true`. -> `PERMISSION_DENIED`.
4. **Cross-Tenant Order Spoofing**: User A creates `orders/order_1` with `userId: "user_B"`. -> `PERMISSION_DENIED`.
5. **PII Snooping via List**: User A lists `users` or `orders` where `userId != uid`. -> `PERMISSION_DENIED`.
6. **Unverified Email Write**: Token with `email_verified: false` attempts write to `orders`. -> `PERMISSION_DENIED`.
7. **Admin Email Spoof**: User with `email: "myappinhub@gmail.com"` and `email_verified: false` attempts catalog write. -> `PERMISSION_DENIED`.
8. **ID Poisoning**: Caller attempts `orders/` write with 300-char ID containing `/../` or spaces. -> `PERMISSION_DENIED`.
9. **Terminal State Reopen**: Partner attempts to change `orders/{id}` from `delivered` back to `placed`. -> `PERMISSION_DENIED`.
10. **Orphaned Dispatch Job**: Caller creates `dispatch_jobs/job_fake` without atomic batch `orders/job_fake`. -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Caller creates `orders/{id}` with backdated `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`.
12. **Catalog Price Tampering**: Non-admin customer updates `catalog_items/item_1` setting `price: 1`. -> `PERMISSION_DENIED`.
