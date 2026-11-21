import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  isSupabaseConfigured,
  sbDeleteAd,
  sbDeleteCatalogItem,
  sbDeleteOrderCascade,
  sbDeleteStaff,
  sbDeleteUserCascade,
  sbDeleteZone,
  sbInsertNotification,
  sbMarkNotificationRead,
  sbUpdateDispatchJob,
  sbUpdateOrderStatus,
  sbUpdateUserFields,
  sbUpsertAds,
  sbUpsertCatalogItems,
  sbUpsertDispatchJob,
  sbUpsertOrder,
  sbUpsertPartner,
  sbUpsertStaff,
  sbUpsertUser,
  sbUpsertZones,
} from './src/lib/supabaseServer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8')
) as {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
};

interface VerifiedCaller {
  uid: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string;
}

async function verifyFirebaseBearerToken(authHeader?: string): Promise<VerifiedCaller | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length < 20) return null;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    users?: Array<{
      localId?: string;
      email?: string;
      emailVerified?: boolean;
      phoneNumber?: string;
    }>;
  };
  const user = data.users?.[0];
  if (!user?.localId) return null;
  return {
    uid: user.localId,
    email: (user.email || '').toLowerCase(),
    emailVerified: Boolean(user.emailVerified),
    phoneNumber: user.phoneNumber || '',
  };
}

async function fetchFirestoreDoc(
  collectionPath: string,
  docId: string,
  idToken: string
): Promise<Record<string, { stringValue?: string; booleanValue?: boolean }> | null> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(docId)) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(
    firebaseConfig.firestoreDatabaseId
  )}/documents/${collectionPath}/${encodeURIComponent(docId)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    fields?: Record<string, { stringValue?: string; booleanValue?: boolean }>;
  };
  return json.fields ?? null;
}

async function getCallerRoles(caller: VerifiedCaller, idToken: string) {
  const isBootstrappedAdmin =
    caller.emailVerified && caller.email === 'myappinhub@gmail.com';
  if (isBootstrappedAdmin) {
    return { isSuperAdmin: true, isFranchiseAdmin: false };
  }
  const [adminDoc, franchiseDoc] = await Promise.all([
    fetchFirestoreDoc('admins', caller.uid, idToken),
    fetchFirestoreDoc('franchise_admins', caller.uid, idToken),
  ]);
  return {
    isSuperAdmin: Boolean(adminDoc),
    isFranchiseAdmin: Boolean(franchiseDoc),
  };
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  // Public runtime configuration for Maps JS API
  app.get('/api/config', (_req, res) => {
    const googleMapsApiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ googleMapsApiKey });
  });

  // Search Grounding endpoint (live local & product facts via Google Search)
  app.post('/api/ai/search-grounding', async (req, res) => {
    try {
      const { query, city } = req.body as { query?: string; city?: string };
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'Gemini service is not configured.' });
      }

      const locationContext = city ? ` in ${city}, India` : ' in India';
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Provide concise, practical, up-to-date consumer information for "${query.trim()}"${locationContext} (availability, typical pricing in INR, popular brands/venues, or local tips). Keep it concise and structured in plain bullet points.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks
        .filter((c: any) => c?.web?.uri)
        .map((c: any) => ({
          uri: String(c.web.uri),
          title: String(c.web.title || c.web.uri),
        }))
        .slice(0, 6);

      res.json({
        text: response.text ?? 'No live web summary available.',
        sources,
      });
    } catch (error: any) {
      console.error('Search grounding error:', error);
      res.status(error?.status || 500).json({
        error: error?.message || 'Unable to fetch live search results.',
      });
    }
  });

  // Maps Grounding endpoint (nearby places & verified Google Maps links)
  app.post('/api/ai/maps-grounding', async (req, res) => {
    try {
      const { query, lat, lng } = req.body as {
        query?: string;
        lat?: number;
        lng?: number;
      };
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.status(400).json({ error: 'Location query is required.' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'Gemini service is not configured.' });
      }

      const latitude = typeof lat === 'number' ? lat : 12.9716;
      const longitude = typeof lng === 'number' ? lng : 77.5946;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Find verified local places matching "${query.trim()}" near these coordinates. Summarize top options with ratings, specialties, and why locals choose them.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude, longitude },
            },
          },
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const places = chunks
        .filter((c: any) => c?.maps?.uri)
        .map((c: any) => ({
          uri: String(c.maps.uri),
          title: String(c.maps.title || 'View on Google Maps'),
          reviewSnippets: Array.isArray(c.maps.placeAnswerSources?.reviewSnippets)
            ? c.maps.placeAnswerSources.reviewSnippets.slice(0, 2)
            : [],
        }))
        .slice(0, 8);

      res.json({
        text: response.text ?? 'No nearby place summary returned.',
        places,
      });
    } catch (error: any) {
      console.error('Maps grounding error:', error);
      res.status(error?.status || 500).json({
        error: error?.message || 'Unable to fetch Google Maps recommendations.',
      });
    }
  });

  // High-Thinking Multi-Service Errand & Logistics Planner
  app.post('/api/ai/errand-planner', async (req, res) => {
    try {
      const { goal, zone, budgetInr } = req.body as {
        goal?: string;
        zone?: string;
        budgetInr?: number;
      };
      if (!goal || typeof goal !== 'string' || goal.trim().length < 4) {
        return res.status(400).json({ error: 'Please describe your errand or event goal.' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'Gemini service is not configured.' });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are UniGo's logistics planner for ${zone || 'Bengaluru'}. The user wants to accomplish: "${goal.trim()}"${budgetInr ? ` with an estimated budget of ₹${budgetInr}` : ''}.
Break this down into a crisp, realistic step-by-step execution plan across UniGo's 7 verticals (Food Delivery, 10-min Groceries, Shopping, Bike/Auto/Car Rides, Home Services, Rentals, Parcel Delivery) with realistic INR cost estimates, timing sequence, and practical tips.`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      res.json({
        planText: response.text ?? 'Unable to generate an errand plan right now.',
      });
    } catch (error: any) {
      console.error('Errand planner error:', error);
      res.status(error?.status || 500).json({
        error: error?.message || 'Unable to compute errand plan.',
      });
    }
  });

  // Payment Gateway Verification Endpoint
  app.post('/api/payments/verify', (req, res) => {
    const { method, amount, upiId, cardLast4 } = req.body as {
      method?: string;
      amount?: number;
      upiId?: string;
      cardLast4?: string;
    };

    if (!method || typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ error: 'Invalid payment payload.' });
    }

    if (method === 'UPI' && (!upiId || !upiId.includes('@'))) {
      return res.status(400).json({ error: 'Please enter a valid UPI ID (e.g., name@okaxis).' });
    }

    if (method === 'Card' && (!cardLast4 || !/^\d{4}$/.test(cardLast4))) {
      return res.status(400).json({ error: 'Please enter valid card details.' });
    }

    const txCode = `UGPAY_${Date.now().toString(36).toUpperCase()}_${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    res.json({
      verified: true,
      transactionId: txCode,
      receipt: `rcpt_${txCode}`,
      method,
      amount,
      status: method === 'Cash on Delivery' ? 'cod' : 'paid',
      verifiedAt: new Date().toISOString(),
    });
  });

  // Authenticated Supabase Dual-Write Sync Route
  app.post('/api/supabase/sync', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const caller = await verifyFirebaseBearerToken(authHeader);
      if (!caller || !authHeader) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      const idToken = authHeader.slice(7).trim();

      if (!isSupabaseConfigured()) {
        return res.json({ ok: true, configured: false });
      }

      const { action, payload } = req.body as {
        action?: string;
        payload?: Record<string, unknown>;
      };
      if (!action || typeof action !== 'string' || !payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Invalid sync payload.' });
      }

      const { isSuperAdmin, isFranchiseAdmin } = await getCallerRoles(caller, idToken);
      const isAnyAdmin = isSuperAdmin || isFranchiseAdmin;

      switch (action) {
        case 'upsert_user': {
          const targetUid = String(payload.uid || '');
          if (!targetUid || (targetUid !== caller.uid && !isSuperAdmin)) {
            return res.status(403).json({ error: 'Forbidden.' });
          }
          let safeRole: 'customer' | 'partner' | 'franchise_admin' | 'super_admin' = 'customer';
          if (isSuperAdmin) {
            const reqRole = String(payload.role || 'customer');
            if (
              reqRole === 'customer' ||
              reqRole === 'partner' ||
              reqRole === 'franchise_admin' ||
              reqRole === 'super_admin'
            ) {
              safeRole = reqRole;
            }
          } else {
            const staffDoc = await fetchFirestoreDoc('staff_directory', targetUid, idToken);
            const staffActive = staffDoc?.active?.booleanValue === true;
            const staffRole = staffDoc?.role?.stringValue;
            if (
              staffActive &&
              (staffRole === 'partner' ||
                staffRole === 'franchise_admin' ||
                staffRole === 'super_admin')
            ) {
              safeRole = staffRole;
            }
          }

          await sbUpsertUser({
            uid: targetUid,
            email: typeof payload.email === 'string' ? payload.email : caller.email,
            displayName: String(payload.displayName || 'UniGo User'),
            phone: typeof payload.phone === 'string' ? payload.phone : caller.phoneNumber,
            role: safeRole,
            franchiseZone:
              typeof payload.franchiseZone === 'string'
                ? payload.franchiseZone
                : 'Indiranagar, Bengaluru',
            walletBalance: typeof payload.walletBalance === 'number' ? payload.walletBalance : 1500,
            savedAddresses: Array.isArray(payload.savedAddresses) ? payload.savedAddresses : [],
            wishlistIds: Array.isArray(payload.wishlistIds)
              ? payload.wishlistIds.map(String)
              : [],
          });
          break;
        }

        case 'update_user_fields': {
          const targetUid = String(payload.uid || '');
          if (!targetUid || (targetUid !== caller.uid && !isSuperAdmin)) {
            return res.status(403).json({ error: 'Forbidden.' });
          }
          await sbUpdateUserFields(targetUid, {
            displayName: typeof payload.displayName === 'string' ? payload.displayName : undefined,
            phone: typeof payload.phone === 'string' ? payload.phone : undefined,
            franchiseZone:
              typeof payload.franchiseZone === 'string' ? payload.franchiseZone : undefined,
            savedAddresses: Array.isArray(payload.savedAddresses)
              ? payload.savedAddresses
              : undefined,
            wishlistIds: Array.isArray(payload.wishlistIds)
              ? payload.wishlistIds.map(String)
              : undefined,
          });
          break;
        }

        case 'upsert_partner': {
          const partner = (payload.partner || payload) as Record<string, unknown>;
          const targetUid = String(partner.uid || '');
          if (!targetUid || (targetUid !== caller.uid && !isSuperAdmin)) {
            return res.status(403).json({ error: 'Forbidden.' });
          }
          await sbUpsertPartner(partner);
          break;
        }

        case 'create_order': {
          const order = payload.order as Record<string, unknown> | undefined;
          const dispatchJob = payload.dispatchJob as Record<string, unknown> | undefined;
          const notification = payload.notification as Record<string, unknown> | undefined;
          if (!order || !dispatchJob || String(order.userId || '') !== caller.uid) {
            return res.status(403).json({ error: 'Forbidden.' });
          }
          await sbUpsertOrder(order);
          await sbUpsertDispatchJob(dispatchJob);
          if (notification && String(notification.userId || '') === caller.uid) {
            await sbInsertNotification(notification);
          }
          break;
        }

        case 'cancel_order': {
          const orderId = String(payload.orderId || '');
          if (!orderId) return res.status(400).json({ error: 'Missing orderId.' });
          if (!isAnyAdmin) {
            const orderDoc = await fetchFirestoreDoc('orders', orderId, idToken);
            if (!orderDoc || orderDoc.userId?.stringValue !== caller.uid) {
              return res.status(403).json({ error: 'Forbidden.' });
            }
          }
          await sbUpdateOrderStatus(orderId, { status: 'cancelled' });
          await sbUpdateDispatchJob(orderId, { status: 'cancelled' });
          break;
        }

        case 'accept_dispatch': {
          const orderId = String(payload.orderId || '');
          const partnerUid = String(payload.partnerUid || '');
          const partnerName = String(payload.partnerName || '');
          if (!orderId || partnerUid !== caller.uid) {
            return res.status(403).json({ error: 'Forbidden.' });
          }
          const orderDoc = await fetchFirestoreDoc('orders', orderId, idToken);
          if (!orderDoc || orderDoc.partnerId?.stringValue !== caller.uid) {
            return res.status(403).json({ error: 'Forbidden.' });
          }
          await sbUpdateDispatchJob(orderId, { partnerId: partnerUid, status: 'accepted' });
          await sbUpdateOrderStatus(orderId, {
            partnerId: partnerUid,
            partnerName,
            status: 'confirmed',
          });
          if (payload.notification && typeof payload.notification === 'object') {
            const notif = payload.notification as Record<string, unknown>;
            if (String(notif.userId || '') === orderDoc.userId?.stringValue) {
              await sbInsertNotification(notif);
            }
          }
          break;
        }

        case 'advance_order': {
          const orderId = String(payload.orderId || '');
          const nextStatus = String(payload.nextStatus || '');
          const jobStatus = String(payload.jobStatus || '');
          const partner = payload.partner as Record<string, unknown> | undefined;
          if (!orderId || !partner || String(partner.uid || '') !== caller.uid) {
            return res.status(403).json({ error: 'Forbidden.' });
          }
          const orderDoc = await fetchFirestoreDoc('orders', orderId, idToken);
          if (!isSuperAdmin && (!orderDoc || orderDoc.partnerId?.stringValue !== caller.uid)) {
            return res.status(403).json({ error: 'Forbidden.' });
          }
          await sbUpdateOrderStatus(orderId, { status: nextStatus });
          await sbUpdateDispatchJob(orderId, { status: jobStatus });
          if (jobStatus === 'completed') {
            await sbUpsertPartner(partner);
          }
          if (payload.notification && typeof payload.notification === 'object') {
            const notif = payload.notification as Record<string, unknown>;
            if (isSuperAdmin || String(notif.userId || '') === orderDoc?.userId?.stringValue) {
              await sbInsertNotification(notif);
            }
          }
          break;
        }

        case 'insert_notification': {
          const notif = (payload.notification || payload) as Record<string, unknown>;
          if (String(notif.userId || '') !== caller.uid && !isSuperAdmin) {
            return res.status(403).json({ error: 'Forbidden.' });
          }
          await sbInsertNotification(notif);
          break;
        }

        case 'mark_notification_read': {
          const id = String(payload.id || '');
          if (!id) return res.status(400).json({ error: 'Missing notification id.' });
          const notifDoc = await fetchFirestoreDoc('notifications', id, idToken);
          if (!notifDoc || (notifDoc.userId?.stringValue !== caller.uid && !isSuperAdmin)) {
            return res.status(403).json({ error: 'Forbidden.' });
          }
          await sbMarkNotificationRead(id);
          break;
        }

        case 'upsert_catalog': {
          if (!isAnyAdmin) return res.status(403).json({ error: 'Admin role required.' });
          const item = (payload.item || payload) as Record<string, unknown>;
          await sbUpsertCatalogItems([item]);
          break;
        }

        case 'delete_catalog': {
          if (!isAnyAdmin) return res.status(403).json({ error: 'Admin role required.' });
          await sbDeleteCatalogItem(String(payload.id || ''));
          break;
        }

        case 'upsert_zone': {
          if (!isSuperAdmin) return res.status(403).json({ error: 'Super Admin role required.' });
          const zone = (payload.zone || payload) as Record<string, unknown>;
          await sbUpsertZones([zone]);
          break;
        }

        case 'delete_zone': {
          if (!isSuperAdmin) return res.status(403).json({ error: 'Super Admin role required.' });
          await sbDeleteZone(String(payload.id || ''));
          break;
        }

        case 'upsert_ad': {
          if (!isSuperAdmin) return res.status(403).json({ error: 'Super Admin role required.' });
          const ad = (payload.ad || payload) as Record<string, unknown>;
          await sbUpsertAds([ad]);
          break;
        }

        case 'delete_ad': {
          if (!isSuperAdmin) return res.status(403).json({ error: 'Super Admin role required.' });
          await sbDeleteAd(String(payload.id || ''));
          break;
        }

        case 'upsert_staff': {
          if (!isSuperAdmin) return res.status(403).json({ error: 'Super Admin role required.' });
          if (payload.staff && typeof payload.staff === 'object') {
            await sbUpsertStaff(payload.staff as Record<string, unknown>);
          }
          if (payload.user && typeof payload.user === 'object') {
            await sbUpsertUser(payload.user as unknown as Parameters<typeof sbUpsertUser>[0]);
          }
          if (payload.partner && typeof payload.partner === 'object') {
            await sbUpsertPartner(payload.partner as Record<string, unknown>);
          }
          break;
        }

        case 'delete_staff': {
          if (!isSuperAdmin) return res.status(403).json({ error: 'Super Admin role required.' });
          const uid = String(payload.uid || '');
          await sbDeleteStaff(uid);
          await sbDeleteUserCascade(uid);
          break;
        }

        case 'admin_update_order': {
          if (!isAnyAdmin) return res.status(403).json({ error: 'Admin role required.' });
          const orderId = String(payload.orderId || '');
          await sbUpdateOrderStatus(orderId, { status: String(payload.status || 'placed') });
          await sbUpdateDispatchJob(orderId, { status: String(payload.jobStatus || 'open') });
          break;
        }

        case 'admin_delete_order': {
          if (!isSuperAdmin) return res.status(403).json({ error: 'Super Admin role required.' });
          await sbDeleteOrderCascade(String(payload.orderId || ''));
          break;
        }

        case 'admin_update_user_role': {
          if (!isSuperAdmin) return res.status(403).json({ error: 'Super Admin role required.' });
          const role = String(payload.role || 'customer') as
            | 'customer'
            | 'partner'
            | 'franchise_admin'
            | 'super_admin';
          await sbUpdateUserFields(String(payload.uid || ''), {
            role,
            franchiseZone:
              typeof payload.franchiseZone === 'string' ? payload.franchiseZone : undefined,
          });
          break;
        }

        case 'admin_delete_user': {
          if (!isSuperAdmin) return res.status(403).json({ error: 'Super Admin role required.' });
          await sbDeleteUserCascade(String(payload.uid || ''));
          break;
        }

        case 'bulk_seed': {
          if (!isSuperAdmin) return res.status(403).json({ error: 'Super Admin role required.' });
          if (Array.isArray(payload.catalogItems)) {
            await sbUpsertCatalogItems(payload.catalogItems as Record<string, unknown>[]);
          }
          if (Array.isArray(payload.zones)) {
            await sbUpsertZones(payload.zones as Record<string, unknown>[]);
          }
          if (Array.isArray(payload.ads)) {
            await sbUpsertAds(payload.ads as Record<string, unknown>[]);
          }
          break;
        }

        default:
          return res.status(400).json({ error: 'Unsupported sync action.' });
      }

      return res.json({ ok: true, configured: true });
    } catch (error: unknown) {
      console.error('Supabase sync error:', error);
      return res.status(500).json({ error: 'Unable to sync with Supabase.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UniGo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start UniGo server:', err);
  process.exit(1);
});
