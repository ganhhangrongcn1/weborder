/* global jest, test, expect, beforeEach */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readPosDeviceMode, savePosDeviceMode } from '../src/services/pos/posDeviceModeService';
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test('cashier remains default and only a persisted phone mode changes the device', async () => {
  AsyncStorage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce('phone').mockResolvedValueOnce('unknown');
  expect(await readPosDeviceMode()).toBe('cashier');
  expect(await readPosDeviceMode()).toBe('phone');
  expect(await readPosDeviceMode()).toBe('cashier');
  await savePosDeviceMode('phone');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('ghr-pos-device-mode-v1', 'phone');
  await expect(savePosDeviceMode('invalid')).rejects.toThrow();
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
});
