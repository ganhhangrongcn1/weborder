export function getHistoryPaymentOrderId(session = {}) {
  return String(session.orderId || session.checkoutSnapshot?.existingOrderId || session.checkoutSnapshot?.websiteOrderId || '').trim();
}

export function mergePosHistoryOrders(posOrders = [], pickupOrders = [], limit = 160) {
  const records = new Map();
  for (const order of [...posOrders, ...pickupOrders]) {
    if (order?.id && !records.has(order.id)) records.set(order.id, order);
  }
  return [...records.values()].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, limit);
}

export function getUnlinkedHistoryPayments(sessions = [], orders = []) {
  const ids = new Set(orders.map(order => String(order.id)));
  return sessions.filter(session => !ids.has(getHistoryPaymentOrderId(session)));
}

export function countPhoneOrderAttention(orders = [], pickupOrders = []) {
  return mergePosHistoryOrders(orders, pickupOrders).filter(order => {
    const status = String(order.status || '').toLowerCase();
    const kitchen = String(order.kitchenStatus || '').toLowerCase();
    return order.metadata?.deviceMode === 'phone'
      && !['done', 'completed', 'complete', 'cancelled', 'canceled', 'expired'].includes(status)
      && !['done', 'completed', 'complete', 'cancelled', 'canceled'].includes(kitchen);
  }).length;
}

export default mergePosHistoryOrders;
