import { getDeviceId } from '../config/firebase';

export function useAuth() {
  return { uid: getDeviceId(), loading: false };
}
