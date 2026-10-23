import { mergePosHistoryOrders, getUnlinkedHistoryPayments, countPhoneOrderAttention } from '../src/services/pos/posHistoryDisplayService';

test('history deduplicates true ids, retains different orders with the same display code and hides linked QR rows', () => {
  const order = { id: 'full-1', displayOrderCode: 'GHR-1', status: 'pending_payment', metadata: { deviceMode: 'phone' } };
  const other = { ...order, id: 'full-2', status: 'cancelled' };
  const merged = mergePosHistoryOrders([order, other], [order]);
  expect(merged).toHaveLength(2);
  expect(getUnlinkedHistoryPayments([{ id: 'qr', orderId: order.id }, { id: 'unlinked' }], merged)).toEqual([{ id: 'unlinked' }]);
  expect(countPhoneOrderAttention([order, other], [order])).toBe(1);
});

