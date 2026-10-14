import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'ghr-pos-device-mode-v1';
export const POS_DEVICE_MODES = { CASHIER: 'cashier', PHONE: 'phone' };
export async function readPosDeviceMode() {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return value === POS_DEVICE_MODES.PHONE ? value : POS_DEVICE_MODES.CASHIER;
}
export async function savePosDeviceMode(value) {
  if (!Object.values(POS_DEVICE_MODES).includes(value)) throw new Error('Chế độ thiết bị không hợp lệ.');
  await AsyncStorage.setItem(STORAGE_KEY, value);
}
