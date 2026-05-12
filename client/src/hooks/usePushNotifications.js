import { useState, useEffect, useCallback } from 'react';
import { getDeviceId } from '../lib/deviceId';

const SERVER = import.meta.env.VITE_SOCKET_URL || '';
const SUBSCRIBED_KEY = 'callspacePushSubscribed';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

const isSupported =
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'PushManager' in window &&
  'serviceWorker' in navigator;

export function usePushNotifications() {
  const [permission, setPermission] = useState(
    isSupported ? Notification.permission : 'unsupported'
  );
  const [subscribed, setSubscribed] = useState(
    () => localStorage.getItem(SUBSCRIBED_KEY) === 'true'
  );

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return false;

    try {
      const keyRes = await fetch(`${SERVER}/vapid-public-key`);
      if (!keyRes.ok) return false;
      const { key } = await keyRes.json();

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const res = await fetch(`${SERVER}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId(), subscription }),
      });

      if (res.ok) {
        localStorage.setItem(SUBSCRIBED_KEY, 'true');
        setSubscribed(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Push subscription failed:', err);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      // Remove from server
      await fetch(`${SERVER}/subscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      });

      // Unsubscribe the browser push subscription
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
    localStorage.removeItem(SUBSCRIBED_KEY);
    setSubscribed(false);
  }, []);

  // Re-subscribe on load if permission is granted (keeps server in sync after restarts)
  useEffect(() => {
    if (isSupported && Notification.permission === 'granted' && localStorage.getItem(SUBSCRIBED_KEY) === 'true') {
      subscribe();
    }
  }, [subscribe]);

  return { isSupported, permission, subscribed, subscribe, unsubscribe };
}
