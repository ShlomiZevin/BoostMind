import { useState } from 'react';
import { getUserId, setPasscode, migrateFromDeviceId, logout } from '../config/firebase';

export function useAuth() {
  const [uid, setUid] = useState<string | null>(getUserId());

  function login(passcode: string) {
    const userId = `user_${passcode}`;
    setPasscode(passcode);
    // Migrate old device data if exists
    migrateFromDeviceId(userId).catch(console.warn);
    setUid(userId);
  }

  function doLogout() {
    logout();
    setUid(null);
  }

  return { uid, loading: false, login, logout: doLogout };
}
