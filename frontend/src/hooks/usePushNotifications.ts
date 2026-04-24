import { useEffect } from 'react';
import OneSignal from 'react-onesignal';
import useAuthStore from '../store/useAuthStore';
import { api } from '../api';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;
let isOneSignalInitialized = false;

export function usePushNotifications() {
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!ONESIGNAL_APP_ID || !currentUser) return;

    const setupOneSignal = async () => {
      try {
        if (!isOneSignalInitialized) {
          try {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            await OneSignal.init({
              appId: ONESIGNAL_APP_ID,
              allowLocalhostAsSecureOrigin: isLocalhost,
            });
            isOneSignalInitialized = true;
          } catch (initErr: any) {
            // If it's already initialized, we can safely proceed
            if (initErr.message?.includes('already initialized')) {
              isOneSignalInitialized = true;
            } else {
              console.warn('[OneSignal] Initialization warning (check dashboard Site URL):', initErr.message);
              // We don't re-throw here to prevent crashing the hook, but we mark as not initialized
              return; 
            }
          }
        }

        // Link the current device to the user's DB ID
        // This sets their "external_id" in OneSignal, allowing the backend to target them directly
        await OneSignal.login(currentUser.id);

        console.info('[OneSignal] Logged in user:', currentUser.id);

        // Optionally store the subscription ID in our own DB for analytics/tracking
        const subId = OneSignal.User.PushSubscription.id;
        if (subId) {
          await api.post('/notifications/tokens', {
            userId: currentUser.id,
            token: subId,
            platform: 'web',
          });
        }

      } catch (err) {
        console.error('[OneSignal] Setup failed:', err);
      }
    };

    setupOneSignal();

    // Cleanup logic: If the user logs out, we should logout from OneSignal
    return () => {
      // We don't logout immediately on unmount because the user is still active
      // Logout from OneSignal is handled in the actual authentication logout flow
    };
  }, [currentUser]);
}
