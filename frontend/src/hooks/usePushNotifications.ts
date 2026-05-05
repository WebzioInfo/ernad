import { useEffect } from 'react';
import useAuthStore from '../store/useAuthStore';
import { api } from '../api';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;
let isOneSignalInitialized = false;

/** 
 * OneSignal requires HTTPS + ServiceWorkers to function.
 * It will always fail on localhost — skip it entirely in development.
 */
const isSecureContext = (): boolean => {
  return window.location.protocol === 'https:';
};

export function usePushNotifications() {
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!ONESIGNAL_APP_ID || !currentUser) return;
    // Skip on HTTP (localhost dev) — OneSignal requires HTTPS
    if (!isSecureContext()) {
      console.log('[OneSignal] Skipping initialization: HTTPS is required for Push Notifications.');
      return;
    }

    const setupOneSignal = () => {
      // @ts-ignore
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      // @ts-ignore
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        console.log('[OneSignal] SDK Ready. Linking user:', currentUser.id);
        
        // ── Step 1: Link user identity ──
        try {
          await OneSignal.login(currentUser.id);
        } catch (loginErr: any) {
          console.warn('[OneSignal] Login failed (non-critical):', loginErr?.message);
          return;
        }

        // ── Step 2: Register push subscription token in our DB ──
        try {
          const subId = OneSignal?.User?.PushSubscription?.id;
          if (subId) {
            await api.post('/notifications/tokens', {
              userId: currentUser.id,
              token: subId,
              platform: 'web',
            });
          }
        } catch (tokenErr: any) {
          console.warn('[OneSignal] Token registration failed (non-critical):', tokenErr?.message);
        }
      });
    };

    setupOneSignal();
  }, [currentUser]);
}
