// Phase 0 Adversarial Security Test Matrix for UniGo Firestore Rules
// Evaluates the Dirty Dozen payloads against the Eight Pillars invariants.

export interface AdversarialTestCase {
  id: string;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: AdversarialTestCase[] = [
  {
    id: 'DD-01',
    name: 'Self-role escalation on user registration',
    collection: 'users/attacker_uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'attacker_uid', email: 'a@test.com', displayName: 'A', role: 'super_admin', walletBalance: 0 },
  },
  {
    id: 'DD-02',
    name: 'Profile role update escalation',
    collection: 'users/attacker_uid',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { role: 'franchise_admin', walletBalance: 99999 },
  },
  {
    id: 'DD-03',
    name: 'Shadow field injection on order creation',
    collection: 'orders/ord_shadow_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { orderNumber: 'UG-1', userId: 'u1', vertical: 'food', status: 'placed', total: 100, isFreeOrder: true },
  },
  {
    id: 'DD-04',
    name: 'Cross-tenant order spoofing',
    collection: 'orders/ord_spoof_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { orderNumber: 'UG-2', userId: 'victim_uid', vertical: 'food', status: 'placed', total: 250 },
  },
  {
    id: 'DD-05',
    name: 'PII snooping on users collection',
    collection: 'users/victim_uid',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    payload: {},
  },
  {
    id: 'DD-06',
    name: 'Unverified email write attempt',
    collection: 'orders/ord_unverified',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { email_verified: false },
  },
  {
    id: 'DD-07',
    name: 'Admin email spoof with unverified token',
    collection: 'catalog_items/cat_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { price: 0, tokenEmail: 'myappinhub@gmail.com', email_verified: false },
  },
  {
    id: 'DD-08',
    name: 'Path variable ID poisoning',
    collection: 'orders/invalid id with spaces and $$$',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {},
  },
  {
    id: 'DD-09',
    name: 'Terminal order state reopening',
    collection: 'orders/ord_done',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { status: 'placed' },
  },
  {
    id: 'DD-10',
    name: 'Orphaned dispatch job without matching order',
    collection: 'dispatch_jobs/orphan_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { orderId: 'orphan_1', status: 'open' },
  },
  {
    id: 'DD-11',
    name: 'Client-side timestamp forgery',
    collection: 'orders/ord_time_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    id: 'DD-12',
    name: 'Non-admin catalog price tampering',
    collection: 'catalog_items/biryani_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { price: 1 },
  },
];
