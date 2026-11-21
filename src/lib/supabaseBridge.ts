import { auth } from './firebase';

export type SupabaseSyncAction =
  | 'upsert_user'
  | 'update_user_fields'
  | 'upsert_partner'
  | 'create_order'
  | 'cancel_order'
  | 'accept_dispatch'
  | 'advance_order'
  | 'insert_notification'
  | 'mark_notification_read'
  | 'upsert_catalog'
  | 'delete_catalog'
  | 'upsert_zone'
  | 'delete_zone'
  | 'upsert_ad'
  | 'delete_ad'
  | 'upsert_staff'
  | 'delete_staff'
  | 'admin_update_order'
  | 'admin_delete_order'
  | 'admin_update_user_role'
  | 'admin_delete_user'
  | 'bulk_seed';

export async function syncToSupabase(
  action: SupabaseSyncAction,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    if (!token) return;

    await fetch('/api/supabase/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, payload }),
    });
  } catch {
    // Non-blocking sync: primary app flow stays uninterrupted
  }
}
