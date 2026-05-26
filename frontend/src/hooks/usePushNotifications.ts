import { useEffect } from 'react';
import useAuthStore from '../modules/auth/auth.store';
import { api } from '../services/api-client';
import { ENDPOINTS } from '../constants/endpoints';

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
    if (isOneSignalInitialized) return;

    // Skip on non-HTTPS (localhost dev) — OneSignal requires HTTPS
    if (!isSecureContext()) {
      console.log('[OneSignal] Skipping initialization: HTTPS is required for Push Notifications.');
      return;
    }

    const initOneSignal = async () => {
      // @ts-ignore
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      // @ts-ignore
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        if (isOneSignalInitialized) return;

        try {
          // ── Ensure Service Worker Container is ready ──
          if ('serviceWorker' in navigator) {
            await navigator.serviceWorker.ready;
          }

          console.log('[OneSignal] SDK Initializing...');
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            allowLocalhostAsSecureOrigin: false,
            notifyButton: {
              enable: true,
              position: 'bottom-right',
              colors: {
                'circle.background': '#1A9A91',
                'circle.foreground': 'white',
              }
            },
          });

          console.log('[OneSignal] Linking user:', currentUser.id);
          await OneSignal.login(currentUser.id);
          
          isOneSignalInitialized = true;

          // ── Step 2: Register push subscription token in our DB ──
          const subId = OneSignal?.User?.PushSubscription?.id;
          if (subId) {
            await api.post(ENDPOINTS.NOTIFICATIONS.TOKENS, {
              userId: currentUser.id,
              token: subId,
              platform: 'web',
            }).catch(() => {}); // Silent fail for token reg
          }
        } catch (err: any) {
          console.warn('[OneSignal] Initialization error:', err?.message);
        }
      });
    };

    initOneSignal();
  }, [currentUser]);
}
