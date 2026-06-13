import { useEffect, useState } from "react";
import PosCartPanel from "../components/pos/PosCartPanel.jsx";
import PosLoginScreen from "../components/pos/PosLoginScreen.jsx";
import { CashPaymentModal, QrPaymentModal } from "../components/pos/PosPaymentModals.jsx";
import ProductOptionsModal from "../components/pos/ProductOptionsModal.jsx";
import { CategoryButton, PosPagerInlinePicker, PosSessionBrand, ProductCard, UtilityActionButton } from "../components/pos/PosPrimitives.jsx";
import PosRecentOrdersPanel from "../components/pos/PosRecentOrdersPanel.jsx";
import PosSettingsPanel from "../components/pos/PosSettingsPanel.jsx";
import { formatMoney, getBranchLabel, getBranchUuid } from "../components/pos/posHelpers.js";
import usePosCart from "../hooks/usePosCart.js";
import usePosCatalog from "../hooks/usePosCatalog.js";
import usePosCustomerLookup from "../hooks/usePosCustomerLookup.js";
import { startPosAutoPrint, subscribePosDraftOrderRealtime } from "../services/posAutomationService.js";
import { buildPosPaymentReference, calculateCashChange, normalizeCashReceived } from "../services/posPaymentService.js";
import { clearPosSession, getBranchValue, readPosSession } from "../services/posSessionService.js";
import {
  cancelPosOrderAsync,
  createPosOrderIdentity,
  createPosTakeawayOrder,
  getBusyPosPagerNumbersAsync,
  getPosRecentOrdersAsync,
  markPosQrOrderPaidAsync
} from "../services/posService.js";
import "../styles/pos.css";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function normalizePagerNumber(value = "") {
  const text = toText(value);
  const digits = text.replace(/\D/g, "");
  if (digits && digits.length <= 2) return digits.padStart(2, "0");
  return text;
}

export default function PosPage({ products = [], categories = [], branches = [] }) {
  const [posSession, setPosSession] = useState(() => readPosSession());
  const [activeWorkspace, setActiveWorkspace] = useState("orders");
  const [pagerNumber, setPagerNumber] = useState("");
  const [busyPagers, setBusyPagers] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [createError, setCreateError] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [configuringProduct, setConfiguringProduct] = useState(null);
  const [cashPaymentOpen, setCashPaymentOpen] = useState(false);
  const [qrPaymentOpen, setQrPaymentOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentConfirmed, setPaymentConfirmed] = useState(null);
  const [qrDraftOrder, setQrDraftOrder] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false);
  const [recentOrdersError, setRecentOrdersError] = useState("");
  const [cancellingOrderId, setCancellingOrderId] = useState("");

  const { activeCategory, setActiveCategory, categories: posCategories, visibleProducts } = usePosCatalog({ products, categories });
  const { cart, totals, addProduct, updateQuantity, removeItem, clearCart } = usePosCart();
  const customerLookup = usePosCustomerLookup(customerPhone);

  const selectedBranch = (Array.isArray(branches) ? branches : []).find((branch, index) => getBranchValue(branch, index) === posSession?.branchValue) || null;
  const branchLabel = selectedBranch ? getBranchLabel(selectedBranch) : posSession?.branchName || "";
  const selectedBranchUuid = selectedBranch ? getBranchUuid(selectedBranch, getBranchValue) : posSession?.branchValue || "";
  const hasSelectedPager = Boolean(pagerNumber.trim());
  const selectedPagerIsBusy = hasSelectedPager &&
    busyPagers.map(normalizePagerNumber).includes(normalizePagerNumber(pagerNumber)) &&
    !qrDraftOrder;
  const draftLocked = Boolean(qrDraftOrder && !paymentConfirmed);
  const isMenuLocked = !hasSelectedPager || selectedPagerIsBusy || draftLocked;

  const resetComposer = () => {
    setPagerNumber("");
    setCustomerName("");
    setCustomerPhone("");
    setCashReceived("");
    setPaymentMethod("cash");
    setPaymentConfirmed(null);
    setQrDraftOrder(null);
    setCashPaymentOpen(false);
    setQrPaymentOpen(false);
    clearCart();
  };

  const loadBusyPagers = async () => {
    if (!posSession?.branchValue) {
      setBusyPagers([]);
      return;
    }
    try {
      const values = await getBusyPosPagerNumbersAsync({ branchValue: posSession.branchValue });
      setBusyPagers(values);
    } catch {
      setBusyPagers([]);
    }
  };

  const loadRecentOrders = async () => {
    if (!posSession?.branchValue) return;
    setRecentOrdersLoading(true);
    setRecentOrdersError("");
    try {
      const rows = await getPosRecentOrdersAsync({ branchValue: posSession.branchValue, limit: 60 });
      setRecentOrders(rows);
    } catch (error) {
      setRecentOrdersError(error?.message || "Không tải được đơn gần đây.");
    } finally {
      setRecentOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (!posSession?.branchValue) return;
    loadBusyPagers();
    loadRecentOrders();
  }, [posSession?.branchValue]);

  useEffect(() => {
    if (!posSession || !selectedBranchUuid) return undefined;

    let active = true;
    let cleanup = () => {};

    startPosAutoPrint({
      branchUuid: selectedBranchUuid,
      onFailed: (_job, result) => {
        if (active) setCreateError(result?.message || "Không in được bill tự động.");
      }
    }).then((unsubscribe) => {
      if (!active) {
        if (typeof unsubscribe === "function") unsubscribe();
        return;
      }
      cleanup = typeof unsubscribe === "function" ? unsubscribe : () => {};
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [posSession, selectedBranchUuid]);

  useEffect(() => {
    if (!qrDraftOrder?.id || paymentConfirmed) return undefined;

    let active = true;
    let cleanup = () => {};

    subscribePosDraftOrderRealtime(qrDraftOrder.id, async (updatedOrder) => {
      if (!active) return;
      if (toText(updatedOrder.paymentStatus).toLowerCase() !== "paid") return;

      resetComposer();
      await loadBusyPagers();
      await loadRecentOrders();
    }).then((unsubscribe) => {
      if (!active) {
        if (typeof unsubscribe === "function") unsubscribe();
        return;
      }
      cleanup = typeof unsubscribe === "function" ? unsubscribe : () => {};
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [paymentConfirmed, qrDraftOrder?.id]);

  useEffect(() => {
    if (!paymentConfirmed) return;
    if (paymentConfirmed.method !== "cash") return;
    if (paymentConfirmed.amount === totals.total) return;
    setPaymentConfirmed(null);
  }, [paymentConfirmed, totals.total]);

  const handleAddProduct = (product) => {
    if (!hasSelectedPager) {
      setCreateError("Nhân viên cần chọn thẻ rung trước khi thêm món.");
      return;
    }
    if (selectedPagerIsBusy) {
      setCreateError(`Thẻ rung ${pagerNumber} đang có đơn chưa hoàn thành. Vui lòng chọn thẻ khác.`);
      return;
    }
    if (draftLocked) {
      setCreateError("Đơn QR đang chờ thanh toán. Vui lòng chờ xác nhận hoặc hủy bill trước.");
      return;
    }
    setCreateError("");
    if (Array.isArray(product.optionGroups) && product.optionGroups.length) {
      setConfiguringProduct(product);
      return;
    }
    addProduct(product);
  };

  const handleSubmitProductOptions = (product, config) => {
    addProduct(product, config);
    setConfiguringProduct(null);
  };

  const handleChangeQuantity = (cartId, quantity) => {
    if (quantity <= 0) {
      removeItem(cartId);
      return;
    }
    updateQuantity(cartId, quantity);
  };

  const handleClearCart = async () => {
    if (!qrDraftOrder) {
      resetComposer();
      setCreateError("");
      return;
    }

    const confirmed = window.confirm(`Hủy đơn chờ thanh toán ${qrDraftOrder.displayOrderCode || qrDraftOrder.orderCode || qrDraftOrder.id}?`);
    if (!confirmed) return;

    const result = await cancelPosOrderAsync(qrDraftOrder, {
      cashierName: posSession?.cashierName || "Thu ngân",
      reason: "Hủy đơn QR chờ thanh toán tại POS"
    });

    if (!result.ok) {
      setCreateError(result.message || "Không hủy được đơn chờ thanh toán.");
      return;
    }

    resetComposer();
    await loadBusyPagers();
    await loadRecentOrders();
  };

  const handleOpenCashPayment = () => {
    if (!cart.length) {
      setCreateError("Chưa có món trong bill.");
      return;
    }
    if (!hasSelectedPager) {
      setCreateError("Vui lòng chọn thẻ rung trước khi thanh toán.");
      return;
    }
    if (selectedPagerIsBusy) {
      setCreateError(`Thẻ rung ${pagerNumber} đang có đơn chưa hoàn thành. Vui lòng chọn thẻ khác.`);
      return;
    }
    setPaymentMethod("cash");
    setCreateError("");
    setCashPaymentOpen(true);
  };

  const handleConfirmCash = () => {
    const received = normalizeCashReceived(cashReceived);
    if (received < totals.total) return;

    setPaymentConfirmed({
      method: "cash",
      reference: `CASH-${Date.now()}`,
      paidAt: new Date().toISOString(),
      amount: totals.total,
      meta: {
        received,
        change: calculateCashChange(totals.total, received)
      }
    });
    setCashPaymentOpen(false);
  };

  const createQrDraftOrder = async () => {
    if (!cart.length) {
      setCreateError("Chưa có món trong bill.");
      return { ok: false };
    }
    if (!hasSelectedPager) {
      setCreateError("Vui lòng chọn thẻ rung trước khi tạo QR thanh toán.");
      return { ok: false };
    }
    if (selectedPagerIsBusy) {
      setCreateError(`Thẻ rung ${pagerNumber} đang có đơn chưa hoàn thành. Vui lòng chọn thẻ khác.`);
      return { ok: false };
    }
    if (qrDraftOrder) return { ok: true, order: qrDraftOrder };

    const identity = createPosOrderIdentity(new Date());
    const result = await createPosTakeawayOrder({
      cart,
      totals,
      pagerNumber,
      customerName: customerName || customerLookup.result?.customerName || "",
      customerPhone,
      branch: selectedBranch,
      cashierName: posSession?.cashierName || "Thu ngân",
      customerLookup: customerLookup.result,
      paymentMethod: "bank_qr",
      paymentStatus: "pending",
      paymentAmount: totals.total,
      paymentReference: buildPosPaymentReference(identity, selectedBranch),
      orderIdentity: identity,
      status: "pending_payment",
      kitchenStatus: "pending"
    });

    if (!result.ok) {
      setCreateError(result.message || "Không tạo được đơn chờ thanh toán.");
      return result;
    }

    setQrDraftOrder(result.order);
    await loadBusyPagers();
    return result;
  };

  const handleOpenQrPayment = async () => {
    if (totals.total <= 0) {
      setCreateError("Bill hiện chưa có số tiền để tạo QR thanh toán.");
      return;
    }
    if (!hasSelectedPager) {
      setCreateError("Vui lòng chọn thẻ rung trước khi tạo QR thanh toán.");
      return;
    }
    if (selectedPagerIsBusy) {
      setCreateError(`Thẻ rung ${pagerNumber} đang có đơn chưa hoàn thành. Vui lòng chọn thẻ khác.`);
      return;
    }

    setPaymentMethod("bank_qr");
    setCreateError("");
    const result = await createQrDraftOrder();
    if (!result.ok) return;
    setQrPaymentOpen(true);
  };

  const handleConfirmQrPaid = async () => {
    if (!qrDraftOrder) return;

    setCreatingOrder(true);
    const result = await markPosQrOrderPaidAsync(qrDraftOrder, {
      cashierName: posSession?.cashierName || "Thu ngân",
      paymentReference: buildPosPaymentReference(qrDraftOrder, selectedBranch),
      paymentAmount: totals.total,
      paidAt: new Date().toISOString()
    });
    setCreatingOrder(false);

    if (!result.ok) {
      setCreateError(result.message || "Không xác nhận được thanh toán QR.");
      return;
    }

    resetComposer();
    await loadBusyPagers();
    await loadRecentOrders();
  };

  const handleCreateOrder = async () => {
    if (creatingOrder || !paymentConfirmed) {
      setCreateError("Vui lòng xác nhận thanh toán trước khi tạo đơn POS.");
      return;
    }

    setCreatingOrder(true);
    setCreateError("");

    const result = await createPosTakeawayOrder({
      cart,
      totals,
      pagerNumber,
      customerName: customerName || customerLookup.result?.customerName || "",
      customerPhone,
      branch: selectedBranch,
      cashierName: posSession?.cashierName || "Thu ngân",
      customerLookup: customerLookup.result,
      paymentMethod,
      paymentStatus: "paid",
      paymentAmount: totals.total,
      paymentReference: paymentConfirmed.reference,
      paidAt: paymentConfirmed.paidAt,
      paymentMeta: paymentConfirmed.meta,
      status: "pending_zalo",
      kitchenStatus: "pending"
    });

    setCreatingOrder(false);
    if (!result.ok) {
      setCreateError(result.message || "Không tạo được đơn POS.");
      return;
    }

    resetComposer();
    await loadBusyPagers();
    await loadRecentOrders();
  };

  const handleCancelRecentOrder = async (order) => {
    const confirmed = window.confirm(`Hủy đơn ${order.displayOrderCode || order.orderCode || order.id}?`);
    if (!confirmed) return;

    const orderId = toText(order.id || order.orderCode);
    setCancellingOrderId(orderId);
    const result = await cancelPosOrderAsync(order, {
      cashierName: posSession?.cashierName || "Thu ngân",
      reason: "Nhân viên hủy trên POS"
    });
    setCancellingOrderId("");

    if (!result.ok) {
      setRecentOrdersError(result.message || "Không hủy được đơn.");
      return;
    }

    await loadBusyPagers();
    await loadRecentOrders();
  };

  const handleLogout = async () => {
    await clearPosSession();
    setPosSession(null);
    resetComposer();
    setBusyPagers([]);
  };

  if (!posSession || !selectedBranch) {
    return <PosLoginScreen branches={branches} onLogin={setPosSession} />;
  }

  return (
    <main className="pos-page">
      <section className="pos-shell">
        <div className={`pos-content-grid ${activeWorkspace === "orders" ? "is-orders" : "is-secondary"}`}>
          {activeWorkspace === "orders" ? (
            <section className="pos-menu-panel">
              <div className="pos-menu-toolbar">
                <PosSessionBrand branchLabel={branchLabel} />
                <div className="pos-utility-actions">
                  <UtilityActionButton label="Lịch sử" onClick={() => setActiveWorkspace("history")} />
                  <UtilityActionButton label="Thiết lập" onClick={() => setActiveWorkspace("settings")} />
                  <UtilityActionButton label="Đổi ca" tone="danger" onClick={handleLogout} />
                </div>
              </div>
              <nav className="pos-category-list" aria-label="Danh mục POS">
                {posCategories.map((category) => (
                  <CategoryButton key={category} label={category} active={activeCategory === category} onClick={() => setActiveCategory(category)} />
                ))}
              </nav>
              <div className={`pos-product-grid ${isMenuLocked ? "is-locked" : ""}`}>
                {!hasSelectedPager ? (
                  <div className="pos-grid-lock-notice">
                    <strong>Nhân viên cần chọn thẻ rung trước khi thêm món</strong>
                  </div>
                ) : selectedPagerIsBusy ? (
                  <div className="pos-grid-lock-notice">
                    <strong>Thẻ rung {pagerNumber} đang có đơn chưa hoàn thành. Vui lòng chọn thẻ khác.</strong>
                  </div>
                ) : null}
                {visibleProducts.length ? visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} disabled={isMenuLocked} onAdd={handleAddProduct} formatMoney={formatMoney} />
                )) : (
                  <div className="pos-empty-products">
                    <strong>Không tìm thấy món phù hợp</strong>
                  </div>
                )}
              </div>
              <div className="pos-menu-footer">
                <PosPagerInlinePicker value={pagerNumber} busyPagers={busyPagers} onSelect={setPagerNumber} />
              </div>
            </section>
          ) : null}

          {activeWorkspace === "history" ? (
            <section className="pos-workspace-panel">
              <div className="pos-workspace-toolbar">
                <PosSessionBrand branchLabel={branchLabel} />
                <div className="pos-utility-actions">
                  <UtilityActionButton label="Bán hàng" onClick={() => setActiveWorkspace("orders")} />
                  <UtilityActionButton label="Thiết lập" onClick={() => setActiveWorkspace("settings")} />
                </div>
              </div>
              <PosRecentOrdersPanel
                orders={recentOrders}
                loading={recentOrdersLoading}
                error={recentOrdersError}
                cancellingOrderId={cancellingOrderId}
                onRefresh={loadRecentOrders}
                onCancelOrder={handleCancelRecentOrder}
              />
            </section>
          ) : null}

          {activeWorkspace === "settings" ? (
            <section className="pos-workspace-panel">
              <div className="pos-workspace-toolbar">
                <PosSessionBrand branchLabel={branchLabel} />
                <div className="pos-utility-actions">
                  <UtilityActionButton label="Bán hàng" onClick={() => setActiveWorkspace("orders")} />
                  <UtilityActionButton label="Lịch sử" onClick={() => setActiveWorkspace("history")} />
                </div>
              </div>
              <PosSettingsPanel branchLabel={branchLabel} cashierName={posSession?.cashierName || "Thu ngân"} />
            </section>
          ) : null}

          {activeWorkspace === "orders" ? (
            <PosCartPanel
              cart={cart}
              totals={totals}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerLookup={customerLookup}
              paymentMethod={paymentMethod}
              paymentConfirmed={paymentConfirmed}
              qrDraftOrder={qrDraftOrder}
              draftLocked={draftLocked}
              createError={createError}
              creatingOrder={creatingOrder}
              onOpenCashPayment={handleOpenCashPayment}
              onOpenQrPayment={handleOpenQrPayment}
              onQuantityChange={handleChangeQuantity}
              onRemove={removeItem}
              onClear={handleClearCart}
              onCreateOrder={handleCreateOrder}
            />
          ) : null}
        </div>
      </section>

      {configuringProduct ? (
        <ProductOptionsModal product={configuringProduct} onClose={() => setConfiguringProduct(null)} onSubmit={handleSubmitProductOptions} />
      ) : null}

      {cashPaymentOpen ? (
        <CashPaymentModal amount={totals.total} cashReceived={cashReceived} setCashReceived={setCashReceived} onClose={() => setCashPaymentOpen(false)} onConfirm={handleConfirmCash} />
      ) : null}

      {qrPaymentOpen ? (
        <QrPaymentModal branch={selectedBranch} amount={totals.total} draftOrder={qrDraftOrder} processing={creatingOrder} onClose={() => setQrPaymentOpen(false)} onConfirmPaid={handleConfirmQrPaid} />
      ) : null}
    </main>
  );
}
