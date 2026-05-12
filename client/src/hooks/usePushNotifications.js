import { useState, useEffect, useCallback } from 'react';
import { getDeviceId } from '../lib/deviceId';

const SERVER = import.meta.env.VITE_SOCKET_URL || '';

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

async function reRegisterWithServer(subscription) {
  try {
    await fetch(`${SERVER}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), subscription }),
    });
  } catch { /* server may be waking up — will retry on next load */ }
}

export function usePushNotifications() {
  const [permission, setPermission] = useState(
    isSupported ? Notification.permission : 'unsupported'
  );
  const [subscribed, setSubscribed] = useState(false);

  // On mount, check the ACTUAL browser push subscription — this is the source of truth.
  // localStorage alone is unreliable on iOS PWA across relaunches.
  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      if (existing && Notification.permission === 'granted') {
        setSubscribed(true);
        // Re-register with server on every launch so it stays in sync after server restarts
        reRegisterWithServer(existing);
      } else {
        setSubscribed(false);
      }
    });
  }, []);

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

      if (res.ok) { setSubscribed(true); return true; }
      return false;
    } catch (err) {
      console.error('Push subscription failed:', err);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      await fetch(`${SERVER}/subscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      });
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
    setSubscribed(false);
  }, []);

  return { isSupported, permission, subscribed, subscribe, unsubscribe };
}
