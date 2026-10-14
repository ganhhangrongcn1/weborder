/* global jest, test, expect */
jest.mock('../src/services/supabase/client', () => ({ supabase: null }));
import { buildPrintPayload } from '../src/services/pos/posPrintStationService';
test('one phone cash job prints preparation plus a paid customer bill, with cash rounding', () => {
  const receipt = { id: 'test', displayOrderCode: 'TEST', paymentMethod: 'cash', paymentStatus: 'paid', paidAt: '2026-10-07T00:00:00Z',
    totalAmount: 25500, subtotal: 25500, paymentAmount: 25000, originalPaymentAmount: 25500,
    cashRoundingDiscount: 500, cashReceived: 30000, cashChange: 5000,
    items: [{ name: 'Món thử', quantity: 1, price: 25500, lineTotal: 25500 }] };
  const payload = buildPrintPayload({ source_type: 'qr_order_bundle', job_type: 'customer_bill',
    payload: { text: '@@CENTER:PHIẾU LÀM MÓN', order: receipt, secondaryOrder: receipt } });
  expect(payload.text).toBe('@@CENTER:PHIẾU LÀM MÓN');
  expect(payload.footerText).toBe('');
  expect(payload.secondaryReceipt.text).toContain('Món thử');
  expect(payload.secondaryReceipt.text).toContain('25.000');
  expect(payload.secondaryReceipt.text).not.toContain('CHƯA THANH TOÁN');
});
