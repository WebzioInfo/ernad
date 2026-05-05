import { useEffect } from 'react';
import OneSignal from 'react-onesignal';
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

    const setupOneSignal = async () => {
      // ── Step 1: Initialize SDK ──
      if (!isOneSignalInitialized) {
        try {
          await OneSignal.init({ appId: ONESIGNAL_APP_ID });
          isOneSignalInitialized = true;
        } catch (initErr: any) {
          if (initErr?.message?.includes('already initialized')) {
            isOneSignalInitialized = true;
          } else {
            console.warn('[OneSignal] Init failed:', initErr?.message);
            return;
          }
        }
      }

      // ── Step 2: Link user identity ──
      try {
        if (isOneSignalInitialized && OneSignal.User) {
          await OneSignal.login(currentUser.id);
        }
      } catch (loginErr: any) {
        console.warn('[OneSignal] Login failed (non-critical):', loginErr?.message);
        return;
      }

      // ── Step 3: Register push subscription token in our DB ──
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
    };

    setupOneSignal();
  }, [currentUser]);
}
