import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'ghr-pos-device-mode-v1';
export const POS_DEVICE_MODES = { CASHIER: 'cashier', PHONE: 'phone' };
export async function readPosDeviceMode() {
  // Ignore the legacy saved phone mode: this app is dedicated to the cashier.
  return POS_DEVICE_MODES.CASHIER;
}
export async function savePosDeviceMode(value) {
  if (value !== POS_DEVICE_MODES.CASHIER) throw new Error('Chế độ thiết bị không hợp lệ.');
  await AsyncStorage.setItem(STORAGE_KEY, value);
}
