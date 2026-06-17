import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import CashPaymentModal from "../features/pos/components/CashPaymentModal";
import PosBenefitCard from "../features/pos/components/PosBenefitCard";
import PaymentBar from "../features/pos/components/PaymentBar";
import PosCashCountModal from "../features/pos/components/PosCashCountModal";
import PosCartPanel from "../features/pos/components/PosCartPanel";
import PosCustomerModal from "../features/pos/components/PosCustomerModal";
import PosCustomerSummaryCard from "../features/pos/components/PosCustomerSummaryCard";
import PosHistoryPanel from "../features/pos/components/PosHistoryPanel";
import PosIcon from "../features/pos/components/PosIcon";
import PosMenuPanel from "../features/pos/components/PosMenuPanel";
import PosPagerModal from "../features/pos/components/PosPagerModal";
import PosShiftCloseModal from "../features/pos/components/PosShiftCloseModal";
import ProductOptionsModal from "../features/pos/components/ProductOptionsModal";
import QrPaymentModal from "../features/pos/components/QrPaymentModal";
import usePosComposer from "../features/pos/hooks/usePosComposer";
import {
  getLocalPrinterConfig,
  listLocalUsbPrinters,
  printLocalTestBill,
  requestLocalUsbPrinterPermission,
  saveLocalLanPrinter,
  selectLocalUsbPrinter,
  setLocalPrinterMode
} from "../services/pos/posPrinterService";
import { formatCashBreakdownSummary } from "../services/pos/posCashBreakdownService";
import { POS_COLORS, POS_RADIUS, POS_SHADOW } from "../styles/posTheme";
import { formatMoney } from "../utils/format";

const POS_TABS = [
  { key: "sale", label: "Bán hàng", icon: "sale" },
  { key: "history", label: "Lịch sử", icon: "history" },
  { key: "shift", label: "Tổng quan ca", icon: "shift" },
  { key: "settings", label: "Thiết lập", icon: "settings" }
];

export default function PosHomeScreen() {
  const [optionProduct, setOptionProduct] = useState(null);
  const [editingCartItem, setEditingCartItem] = useState(null);
  const [pendingPagerProduct, setPendingPagerProduct] = useState(null);
  const [pagerPickerOpen, setPagerPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("sale");
  const [cashPaymentOpen, setCashPaymentOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [shiftCloseOpen, setShiftCloseOpen] = useState(false);
  const [openingCashCounterOpen, setOpeningCashCounterOpen] = useState(false);
  const [openingCashBreakdown, setOpeningCashBreakdown] = useState(null);
  const [cashReceived, setCashReceived] = useState("");
  const [printerConfig, setPrinterConfig] = useState(null);
  const [lanHost, setLanHost] = useState("");
  const [lanPort, setLanPort] = useState("9100");
  const [usbDevices, setUsbDevices] = useState([]);
  const [printerBusy, setPrinterBusy] = useState(false);
  const [printerMessage, setPrinterMessage] = useState("");
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const productColumns = width >= 1320 ? 5 : width >= 1120 ? 4 : isWide ? 3 : 2;
  const {
    email,
    setEmail,
    password,
    setPassword,
    authMessage,
    shiftMessage,
    menuMessage,
    busy,
    isSignedIn,
    branchName,
    cashierName,
    shiftLabel,
    shift,
    shiftSummary,
    shiftSummaryError,
    openingCash,
    setOpeningCash,
    pagerNumber,
    setPagerNumber,
    normalizedPager,
    pagerBusy,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerLookup,
    loyaltyBenefit,
    promotionHints,
    selectedVoucherId,
    setSelectedVoucherId,
    pointsInput,
    setPointsInput,
    products,
    allProducts,
    categories,
    activeCategory,
    setActiveCategory,
    cart,
    totals,
    paymentConfirmed,
    qrSession,
    qrPreviewIdentity,
    qrModalOpen,
    setQrModalOpen,
    qrLoading,
    qrError,
    qrPrintBusy,
    branch,
    busyPagers,
    recentOrders,
    pendingPaymentSessions,
    historyLoading,
    historyError,
    addProduct,
    updateCartItem,
    changeQuantity,
    clearCart,
    confirmCash,
    openQrPayment,
    cancelQrPayment,
    openPaymentSessionFromHistory,
    cancelPaymentSessionFromHistory,
    cancelRecentOrder,
    reprintRecentOrder,
    openRecentOrderDetail,
    refreshCurrentPosRuntime,
    confirmQrPaidManually,
    printQrReceiptNow,
    createCashOrder,
    signIn,
    signOut,
    openShiftNow,
    closeShiftNow,
    hasOpenShift
  } = usePosComposer();

  const continueAddProduct = (product) => {
    if (!product) return;
    if (Array.isArray(product?.optionGroups) && product.optionGroups.length) {
      setOptionProduct(product);
      return;
    }
    addProduct(product);
  };

  const handleProductPress = (product) => {
    if (!normalizedPager || pagerBusy) {
      setPendingPagerProduct(product);
      setPagerPickerOpen(true);
      return;
    }
    continueAddProduct(product);
  };

  const handleSubmitOptions = (product, config) => {
    if (editingCartItem?.cartId) {
      updateCartItem(editingCartItem.cartId, product, config);
      setEditingCartItem(null);
      setOptionProduct(null);
      return;
    }
    addProduct(product, config);
    setOptionProduct(null);
  };

  const handleEditCartItem = (item) => {
    if (!item?.cartId) return;
    const sourceProduct = allProducts.find((product) => product.id === item.productId) || {
      id: item.productId || item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      category: item.category,
      optionGroups: []
    };
    setEditingCartItem(item);
    setOptionProduct(sourceProduct);
  };

  const handleSelectPager = (nextPager) => {
    const nextProduct = pendingPagerProduct;
    setPagerNumber(nextPager);
    setPagerPickerOpen(false);
    setPendingPagerProduct(null);
    continueAddProduct(nextProduct);
  };

  const handleOpenCashModal = () => {
    setCashReceived(String(totals.total || ""));
    setCashPaymentOpen(true);
  };

  const handleConfirmCashPayment = () => {
    confirmCash(cashReceived);
    setCashPaymentOpen(false);
  };

  const openingCashAmount = Number(openingCash || 0);

  useEffect(() => {
    let active = true;

    const loadPrinterState = async () => {
      try {
        const [config, devices] = await Promise.all([
          getLocalPrinterConfig(),
          listLocalUsbPrinters()
        ]);
        if (!active) return;
        setPrinterConfig(config);
        setLanHost(config?.lanHost || "");
        setLanPort(String(config?.lanPort || 9100));
        setUsbDevices(Array.isArray(devices) ? devices : []);
      } catch (error) {
        if (!active) return;
        setPrinterMessage(error?.message || "Không tải được cấu hình máy in.");
      }
    };

    loadPrinterState();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hasOpenShift) {
      setOpeningCashCounterOpen(false);
      setOpeningCashBreakdown(null);
    }
  }, [hasOpenShift]);

  const refreshPrinterState = async () => {
    const [config, devices] = await Promise.all([
      getLocalPrinterConfig(),
      listLocalUsbPrinters()
    ]);
    setPrinterConfig(config);
    setLanHost(config?.lanHost || "");
    setLanPort(String(config?.lanPort || 9100));
    setUsbDevices(Array.isArray(devices) ? devices : []);
    return config;
  };

  const handleSetPrinterMode = async (mode) => {
    setPrinterBusy(true);
    setPrinterMessage("");
    try {
      const config = await setLocalPrinterMode(mode);
      setPrinterConfig(config);
      await refreshPrinterState();
    } catch (error) {
      setPrinterMessage(error?.message || "Không đổi được chế độ máy in.");
    } finally {
      setPrinterBusy(false);
    }
  };

  const handleSaveLanPrinter = async () => {
    setPrinterBusy(true);
    setPrinterMessage("");
    try {
      await saveLocalLanPrinter(lanHost, Number(lanPort || 9100));
      await refreshPrinterState();
      setPrinterMessage("Đã lưu máy in LAN/WiFi.");
    } catch (error) {
      setPrinterMessage(error?.message || "Không lưu được máy in LAN/WiFi.");
    } finally {
      setPrinterBusy(false);
    }
  };

  const handleSelectUsbPrinter = async (device) => {
    setPrinterBusy(true);
    setPrinterMessage("");
    try {
      await selectLocalUsbPrinter(device.vendorId, device.productId);
      if (!device.hasPermission) {
        await requestLocalUsbPrinterPermission(device.vendorId, device.productId);
      }
      await refreshPrinterState();
      setPrinterMessage("Đã chọn máy in USB.");
    } catch (error) {
      setPrinterMessage(error?.message || "Không chọn được máy in USB.");
    } finally {
      setPrinterBusy(false);
    }
  };

  const handlePrinterTest = async () => {
    setPrinterBusy(true);
    setPrinterMessage("");
    try {
      await printLocalTestBill();
      await refreshPrinterState();
      setPrinterMessage("Đã gửi bill test tới máy in.");
    } catch (error) {
      setPrinterMessage(error?.message || "Không in được bill test.");
    } finally {
      setPrinterBusy(false);
    }
  };

  if (!isSignedIn) {
    return (
      <View style={styles.centerPage}>
        <View style={styles.loginCard}>
          <View style={styles.loginBrand}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>GHR</Text>
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.loginTitle}>GHR POS</Text>
              <Text style={styles.loginSubtitle}>Đăng nhập POS chi nhánh</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="pos@ghr.vn"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mật khẩu</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Nhập mật khẩu"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              style={styles.input}
            />
          </View>

          {!!authMessage && <Text style={styles.errorBox}>{authMessage}</Text>}

          <Pressable
            style={[styles.submitButton, busy && styles.submitButtonDisabled]}
            onPress={signIn}
            disabled={busy}
          >
            <Text style={[styles.submitText, busy && styles.disabledText]}>
              {busy ? "Đang đăng nhập..." : "Đăng nhập"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!hasOpenShift) {
    return (
      <>
        <View style={styles.centerPage}>
          <View style={styles.shiftCard}>
            <View style={styles.shiftHead}>
              <View style={styles.flexOne}>
                <Text style={styles.label}>Mở ca bán hàng</Text>
                <Text style={styles.shiftTitle}>{branchName}</Text>
                <Text style={styles.shiftSubtitle}>{cashierName}</Text>
              </View>
              <Pressable style={styles.smallGhostButton} onPress={signOut}>
                <Text style={styles.smallGhostText}>Đổi tài khoản</Text>
              </Pressable>
            </View>

            <View style={styles.shiftSummary}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Chi nhánh</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{branchName}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Trạng thái</Text>
                <Text style={styles.summaryValue}>Chưa mở ca</Text>
              </View>
            </View>

            <View style={styles.openingShiftPanel}>
              <View style={styles.openingCashHead}>
                <View style={styles.openingCashHeading}>
                  <View style={styles.openingCashIconWrap}>
                    <PosIcon name="cash" size={14} color={POS_COLORS.primaryDark} />
                  </View>
                  <Text style={styles.label}>Tiền đầu ca</Text>
                </View>
                <Pressable
                  style={styles.openingCashAction}
                  onPress={() => setOpeningCashCounterOpen(true)}
                >
                  <Text style={styles.openingCashActionText}>
                    {openingCashAmount > 0 ? "Đếm lại" : "Đếm theo mệnh giá"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.openingCashCard}>
                <Text style={styles.openingCashValue}>
                  {openingCashAmount > 0 ? formatMoney(openingCashAmount) : "Chưa nhập tiền đầu ca"}
                </Text>
                <Text style={styles.openingCashHint}>
                  {openingCashBreakdown
                    ? formatCashBreakdownSummary(openingCashBreakdown)
                    : "Nhập số tờ đầu ca bằng popup giống phần kết ca."}
                </Text>
              </View>

              <View style={styles.openingShiftNote}>
                <PosIcon name="history" size={14} color={POS_COLORS.slate} />
                <Text style={styles.openingShiftNoteText}>
                  Kiểm tiền theo mệnh giá trước khi mở ca để tổng quan ca chính xác hơn.
                </Text>
              </View>
            </View>

            {!!shiftMessage && <Text style={styles.noticeBox}>{shiftMessage}</Text>}

            <Pressable
              style={[styles.submitButton, busy && styles.submitButtonDisabled]}
              onPress={() => {
                if (!openingCashBreakdown) {
                  setOpeningCashCounterOpen(true);
                  return;
                }
                openShiftNow({
                  openingCashCounted: openingCashAmount,
                  openingCashBreakdown
                });
              }}
              disabled={busy}
            >
              <Text style={[styles.submitText, busy && styles.disabledText]}>
                {busy ? "Đang mở ca..." : openingCashBreakdown ? "Mở ca POS" : "Kiểm tiền đầu ca"}
              </Text>
            </Pressable>
          </View>
        </View>

        <PosCashCountModal
          visible={openingCashCounterOpen}
          title="Đếm tiền đầu ca"
          subtitle="Nhập số tờ thực tế mang vào đầu ca."
          initialCounts={openingCashBreakdown}
          onClose={() => setOpeningCashCounterOpen(false)}
          onApply={({ counts, total }) => {
            setOpeningCashBreakdown(counts);
            setOpeningCash(String(total || ""));
            setOpeningCashCounterOpen(false);
          }}
        />
      </>
    );
  }

  const renderSaleWorkspace = () => (
    <View style={[styles.workspace, !isWide && styles.workspaceStack]}>
      <View style={styles.menuColumn}>
        <PosMenuPanel
          products={products}
          categories={categories}
          activeCategory={activeCategory}
          columns={productColumns}
          normalizedPager={normalizedPager}
          pagerBusy={pagerBusy}
          busyPagers={busyPagers}
          onOpenPagerPicker={() => {
            setPendingPagerProduct(null);
            setPagerPickerOpen(true);
          }}
          onSelectCategory={setActiveCategory}
          onAddProduct={handleProductPress}
        />
      </View>

        <View style={[styles.orderColumn, !isWide && styles.orderColumnStack]}>
          <View style={styles.orderTop}>
            <PosCustomerSummaryCard
            customerName={customerName}
            customerPhone={customerPhone}
            setCustomerName={setCustomerName}
            setCustomerPhone={setCustomerPhone}
            lookup={customerLookup}
            onOpen={() => setCustomerModalOpen(true)}
            onClear={() => {
              setCustomerName("");
              setCustomerPhone("");
              setSelectedVoucherId("");
              setPointsInput("");
            }}
            />

            <PosBenefitCard
              loyaltyBenefit={loyaltyBenefit}
              selectedVoucherId={selectedVoucherId}
              setSelectedVoucherId={setSelectedVoucherId}
              promotionHints={promotionHints}
              disabled={busy || Boolean(paymentConfirmed)}
            />

            {!!menuMessage && <Text style={styles.noticeBox}>{menuMessage}</Text>}
            {!!shiftMessage && <Text style={styles.noticeText}>{shiftMessage}</Text>}
        </View>

        <View style={styles.orderBody}>
          <PosCartPanel
            cart={cart}
            totals={totals}
            onChangeQuantity={changeQuantity}
            onEditItem={handleEditCartItem}
            onClear={clearCart}
            fillAvailable={!cart.length}
          />
        </View>

        {cart.length ? (
          <PaymentBar
            totals={totals}
            paymentConfirmed={paymentConfirmed}
            disabled={busy}
            onConfirmCash={handleOpenCashModal}
            onOpenQrPayment={openQrPayment}
            onCreateOrder={createCashOrder}
          />
        ) : null}
      </View>
    </View>
  );

  const formatShiftMetaTime = (value) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const renderSettingsWorkspace = () => (
    <View style={styles.secondaryPanel}>
      <Text style={styles.label}>Thiết lập</Text>
      <Text style={styles.secondaryTitle}>POS chi nhánh</Text>
      <View style={styles.shiftSummary}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Tài khoản</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>{cashierName}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Thẻ đang bận</Text>
          <Text style={styles.summaryValue}>{busyPagers.length} thẻ</Text>
        </View>
      </View>

      <View style={styles.closeShiftBox}>
        <Text style={styles.label}>Máy in bill</Text>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeButton, printerConfig?.mode === "usb" && styles.modeButtonActive]}
            onPress={() => handleSetPrinterMode("usb")}
            disabled={printerBusy}
          >
            <Text style={[styles.modeButtonText, printerConfig?.mode === "usb" && styles.modeButtonTextActive]}>USB</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, printerConfig?.mode === "lan" && styles.modeButtonActive]}
            onPress={() => handleSetPrinterMode("lan")}
            disabled={printerBusy}
          >
            <Text style={[styles.modeButtonText, printerConfig?.mode === "lan" && styles.modeButtonTextActive]}>LAN/WiFi</Text>
          </Pressable>
        </View>

        {printerConfig?.mode === "lan" ? (
          <View style={styles.field}>
            <Text style={styles.label}>IP máy in LAN/WiFi</Text>
            <TextInput
              value={lanHost}
              onChangeText={setLanHost}
              placeholder="192.168.1.50"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={lanPort}
              onChangeText={setLanPort}
              placeholder="9100"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              style={styles.input}
            />
            <Pressable style={styles.smallGhostButton} onPress={handleSaveLanPrinter} disabled={printerBusy}>
              <Text style={styles.smallGhostText}>Lưu máy in LAN</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>Máy in USB</Text>
            {usbDevices.length ? (
              usbDevices.map((device) => (
                <Pressable
                  key={`${device.vendorId}-${device.productId}`}
                  style={[styles.usbDeviceButton, device.selected && styles.usbDeviceButtonActive]}
                  onPress={() => handleSelectUsbPrinter(device)}
                  disabled={printerBusy}
                >
                  <Text style={[styles.usbDeviceText, device.selected && styles.modeButtonTextActive]}>
                    {device.label}
                  </Text>
                  <Text style={styles.usbStatusText}>
                    {device.hasPermission ? "Sẵn sàng" : "Cần cấp quyền"}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.placeholderText}>Chưa thấy máy in USB. Kiểm tra cáp OTG hoặc nguồn máy in.</Text>
            )}
          </View>
        )}

        {!!printerConfig && (
          <Text style={styles.placeholderText}>
            {printerConfig.mode === "lan"
              ? `Máy in LAN: ${printerConfig.lanHost || "chưa nhập IP"}:${printerConfig.lanPort || 9100}`
              : `Máy in USB: ${printerConfig.usbLabel || "chưa chọn"}${printerConfig.usbPermission ? " · sẵn sàng" : " · cần cấp quyền"}`}
          </Text>
        )}

        {!!printerMessage && <Text style={styles.noticeBox}>{printerMessage}</Text>}

        <View style={styles.closeShiftActions}>
          <Pressable style={styles.smallGhostButton} onPress={refreshPrinterState} disabled={printerBusy}>
            <Text style={styles.smallGhostText}>Tải lại máy in</Text>
          </Pressable>
          <Pressable style={[styles.closeShiftButton, printerBusy && styles.submitButtonDisabled]} onPress={handlePrinterTest} disabled={printerBusy}>
            <Text style={[styles.closeShiftText, printerBusy && styles.disabledText]}>In test</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.smallGhostButton} onPress={refreshCurrentPosRuntime}>
        <Text style={styles.smallGhostText}>Tải lại dữ liệu POS</Text>
      </Pressable>
    </View>
  );

  const renderShiftWorkspaceV2 = () => {
    const expectedCash = Number(shiftSummary?.expectedCash || shift?.openingCash || 0);
    const openedAtText = formatShiftMetaTime(shift?.openedAt);
    const shiftCode = shift?.id ? String(shift.id).slice(0, 8).toUpperCase() : "--";

    return (
      <View style={styles.secondaryPanel}>
        {!!shiftSummaryError && <Text style={styles.errorBox}>{shiftSummaryError}</Text>}

        <View style={styles.summaryCard}>
          <View style={styles.shiftHeroRow}>
            <View style={styles.shiftHeroMain}>
              <Text style={styles.sectionCaption}>Ca đang mở</Text>
              <Text style={styles.shiftHeroTitle} numberOfLines={1}>{branchName}</Text>
              <Text style={styles.shiftHeroMeta}>Thu ngân: {cashierName}</Text>
              <Text style={styles.shiftHeroMeta}>Mở lúc {openedAtText} • Mã ca {shiftCode}</Text>
            </View>
            <View style={styles.shiftHeroBadge}>
              <Text style={styles.shiftHeroBadgeValue}>{formatMoney(shift?.openingCash || 0)}</Text>
              <Text style={styles.shiftHeroBadgeLabel}>Tiền đầu ca</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionCaption}>Doanh thu ca</Text>
          <View style={styles.shiftSummary}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Doanh thu</Text>
              <Text style={styles.summaryValue}>{formatMoney(shiftSummary?.revenue || 0)}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Tiền mặt</Text>
              <Text style={styles.summaryValue}>{formatMoney(shiftSummary?.cashTotal || 0)}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Chuyển khoản</Text>
              <Text style={styles.summaryValue}>{formatMoney(shiftSummary?.qrTotal || 0)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionCaption}>Tình trạng đơn</Text>
          <View style={styles.shiftSummary}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Đơn đã trả</Text>
              <Text style={styles.summaryValue}>{shiftSummary?.orderCount || 0}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Đơn hủy</Text>
              <Text style={styles.summaryValue}>{shiftSummary?.cancelledOrderCount || 0}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>CK đang chờ</Text>
              <Text style={styles.summaryValue}>{shiftSummary?.pendingQrCount || 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.closeShiftBox}>
          <Text style={styles.sectionCaption}>Chốt ca</Text>
          <View style={styles.shiftClosingPreview}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Tiền mặt dự kiến</Text>
              <Text style={styles.summaryValue}>{formatMoney(expectedCash)}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>CK chưa xử lý</Text>
              <Text style={styles.summaryValue}>{shiftSummary?.pendingQrCount || 0}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Đơn hủy</Text>
              <Text style={styles.summaryValue}>{shiftSummary?.cancelledOrderCount || 0}</Text>
            </View>
          </View>
          <View style={styles.closeShiftActions}>
            <Pressable
              style={[styles.closeShiftButton, busy && styles.submitButtonDisabled]}
              onPress={() => setShiftCloseOpen(true)}
              disabled={busy}
            >
              <Text style={[styles.closeShiftText, busy && styles.disabledText]}>Kết ca</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  const renderSettingsWorkspaceV2 = () => {
    const printerReady = printerConfig?.mode === "lan"
      ? Boolean(printerConfig?.lanHost)
      : Boolean(printerConfig?.usbLabel);
    const printerStatusText = !printerConfig
      ? "Chưa có cấu hình máy in."
      : printerConfig.mode === "lan"
        ? `Máy in LAN: ${printerConfig.lanHost || "chưa nhập IP"}:${printerConfig.lanPort || 9100}`
        : `Máy in USB: ${printerConfig.usbLabel || "chưa chọn"}${printerConfig.usbPermission ? " · sẵn sàng" : " · cần cấp quyền"}`;

    return (
      <View style={styles.secondaryPanel}>
        <Text style={styles.label}>Thiết lập</Text>
        <Text style={styles.secondaryTitle}>POS chi nhánh</Text>

        <View style={styles.summaryCard}>
          <View style={styles.shiftSummary}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Tài khoản</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{cashierName}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Thẻ đang bận</Text>
              <Text style={styles.summaryValue}>{busyPagers.length} thẻ</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Chế độ in</Text>
              <Text style={styles.summaryValue}>{printerConfig?.mode === "lan" ? "LAN/WiFi" : "USB"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.closeShiftBox}>
          <Text style={styles.sectionCaption}>Máy in bill</Text>
          <View style={styles.printerStatusCard}>
            <View style={styles.printerStatusHead}>
              <Text style={styles.printerStatusTitle}>Trạng thái hiện tại</Text>
              <View style={[styles.printerBadge, printerReady ? styles.printerBadgeReady : styles.printerBadgeIdle]}>
                <Text style={[styles.printerBadgeText, printerReady ? styles.printerBadgeTextReady : styles.printerBadgeTextIdle]}>
                  {printerReady ? "Sẵn sàng" : "Chưa xong"}
                </Text>
              </View>
            </View>
            <Text style={styles.placeholderText}>{printerStatusText}</Text>
          </View>

          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeButton, printerConfig?.mode === "usb" && styles.modeButtonActive]}
              onPress={() => handleSetPrinterMode("usb")}
              disabled={printerBusy}
            >
              <Text style={[styles.modeButtonText, printerConfig?.mode === "usb" && styles.modeButtonTextActive]}>USB</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, printerConfig?.mode === "lan" && styles.modeButtonActive]}
              onPress={() => handleSetPrinterMode("lan")}
              disabled={printerBusy}
            >
              <Text style={[styles.modeButtonText, printerConfig?.mode === "lan" && styles.modeButtonTextActive]}>LAN/WiFi</Text>
            </Pressable>
          </View>

          {printerConfig?.mode === "lan" ? (
            <View style={styles.field}>
              <Text style={styles.label}>IP máy in LAN/WiFi</Text>
              <TextInput
                value={lanHost}
                onChangeText={setLanHost}
                placeholder="192.168.1.50"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                style={styles.input}
              />
              <TextInput
                value={lanPort}
                onChangeText={setLanPort}
                placeholder="9100"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                style={styles.input}
              />
              <Pressable style={styles.smallGhostButton} onPress={handleSaveLanPrinter} disabled={printerBusy}>
                <Text style={styles.smallGhostText}>Lưu máy in LAN</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>Máy in USB</Text>
              {usbDevices.length ? (
                usbDevices.map((device) => (
                  <Pressable
                    key={`${device.vendorId}-${device.productId}`}
                    style={[styles.usbDeviceButton, device.selected && styles.usbDeviceButtonActive]}
                    onPress={() => handleSelectUsbPrinter(device)}
                    disabled={printerBusy}
                  >
                    <Text style={[styles.usbDeviceText, device.selected && styles.modeButtonTextActive]}>
                      {device.label}
                    </Text>
                    <Text style={styles.usbStatusText}>
                      {device.hasPermission ? "Sẵn sàng" : "Cần cấp quyền"}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.placeholderText}>Chưa thấy máy in USB. Kiểm tra cáp OTG hoặc nguồn máy in.</Text>
              )}
            </View>
          )}

          {!!printerMessage && <Text style={styles.noticeBox}>{printerMessage}</Text>}

          <View style={styles.closeShiftActions}>
            <Pressable style={styles.smallGhostButton} onPress={refreshPrinterState} disabled={printerBusy}>
              <Text style={styles.smallGhostText}>Tải lại máy in</Text>
            </Pressable>
            <Pressable style={[styles.closeShiftButton, printerBusy && styles.submitButtonDisabled]} onPress={handlePrinterTest} disabled={printerBusy}>
              <Text style={[styles.closeShiftText, printerBusy && styles.disabledText]}>In test</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.smallGhostButton} onPress={refreshCurrentPosRuntime}>
          <Text style={styles.smallGhostText}>Tải lại dữ liệu POS</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.shell}>
        <View style={styles.workspaceFrame}>
          {activeTab === "sale" && renderSaleWorkspace()}
          {activeTab === "history" && (
            <PosHistoryPanel
              recentOrders={recentOrders}
              paymentSessions={pendingPaymentSessions}
              loading={historyLoading}
              error={historyError}
              activeShiftId={shift?.id || ""}
              onRefresh={refreshCurrentPosRuntime}
              onOpenPaymentSession={openPaymentSessionFromHistory}
              onCancelPaymentSession={cancelPaymentSessionFromHistory}
              onCancelOrder={cancelRecentOrder}
              onReprintOrder={reprintRecentOrder}
              onOpenOrderDetail={openRecentOrderDetail}
            />
          )}
          {activeTab === "shift" && renderShiftWorkspaceV2()}
          {activeTab === "settings" && renderSettingsWorkspaceV2()}
        </View>

        <View style={styles.bottomNav}>
          <View style={styles.navMark}>
            <PosIcon name="brand" size={18} color={POS_COLORS.surface} />
          </View>
          {POS_TABS.map((tab) => {
            const active = tab.key === activeTab;
            const showHistoryBadge = tab.key === "history" && pendingPaymentSessions.length > 0;
            return (
              <Pressable
                key={tab.key}
                style={[styles.navButton, active && styles.navButtonActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <View style={[styles.navIcon, active && styles.navIconActive]}>
                  <PosIcon
                    name={tab.icon}
                    size={14}
                    color={active ? POS_COLORS.primaryDark : POS_COLORS.muted}
                  />
                </View>
                <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
                {showHistoryBadge && (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>{pendingPaymentSessions.length}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          <Pressable style={styles.changeShiftButton} onPress={signOut}>
            <View style={styles.changeShiftRow}>
              <PosIcon name="settings" size={14} color={POS_COLORS.danger} />
              <Text style={styles.changeShiftText}>Đổi ca</Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ProductOptionsModal
        product={optionProduct}
        initialConfig={editingCartItem}
        submitLabel={editingCartItem ? "Lưu món" : ""}
        onClose={() => {
          setOptionProduct(null);
          setEditingCartItem(null);
        }}
        onSubmit={handleSubmitOptions}
      />
      <PosCustomerModal
        visible={customerModalOpen}
        customerName={customerName}
        setCustomerName={setCustomerName}
        customerPhone={customerPhone}
        setCustomerPhone={setCustomerPhone}
        lookup={customerLookup}
        loyaltyBenefit={loyaltyBenefit}
        selectedVoucherId={selectedVoucherId}
        setSelectedVoucherId={setSelectedVoucherId}
        pointsInput={pointsInput}
        setPointsInput={setPointsInput}
        onClear={() => {
          setCustomerName("");
          setCustomerPhone("");
          setSelectedVoucherId("");
          setPointsInput("");
        }}
        onClose={() => setCustomerModalOpen(false)}
      />
      <PosPagerModal
        visible={pagerPickerOpen}
        value={normalizedPager}
        busyPagers={busyPagers}
        onClose={() => {
          setPagerPickerOpen(false);
          setPendingPagerProduct(null);
        }}
        onSelect={handleSelectPager}
      />
      <PosShiftCloseModal
        visible={shiftCloseOpen}
        shift={shift}
        summary={shiftSummary}
        loading={busy}
        error={shiftSummaryError}
        onClose={() => setShiftCloseOpen(false)}
        onConfirm={async (payload) => {
          const ok = await closeShiftNow(payload);
          if (ok) {
            setShiftCloseOpen(false);
          }
        }}
      />
      <CashPaymentModal
        visible={cashPaymentOpen}
        amount={totals.total}
        cashReceived={cashReceived}
        setCashReceived={setCashReceived}
        processing={busy}
        onClose={() => setCashPaymentOpen(false)}
        onConfirm={handleConfirmCashPayment}
      />
      <QrPaymentModal
        visible={qrModalOpen}
        branch={branch}
        amount={qrSession?.amountExpected || totals.total}
        draftSession={qrSession}
        previewIdentity={qrPreviewIdentity}
        loading={qrLoading}
        processing={busy}
        printBusy={qrPrintBusy}
        errorMessage={qrError}
        onClose={() => setQrModalOpen(false)}
        onCancel={() => cancelQrPayment(qrSession)}
        onConfirmPaid={confirmQrPaidManually}
        onPrint={printQrReceiptNow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: POS_COLORS.background
  },
  shell: {
    flex: 1,
    gap: 10,
    padding: 10
  },
  workspaceFrame: {
    flex: 1,
    minHeight: 0
  },
  workspace: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    gap: 6
  },
  workspaceStack: {
    flexDirection: "column"
  },
  menuColumn: {
    flex: 1.08,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden"
  },
  orderColumn: {
    width: 372,
    flexShrink: 0,
    minHeight: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md
  },
  orderColumnStack: {
    width: "100%",
    flex: 1
  },
  orderTop: {
    gap: 6,
    padding: 6,
    paddingBottom: 0
  },
  orderBody: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 8
  },
  secondaryPanel: {
    flex: 1,
    gap: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 14
  },
  summaryCard: {
    gap: 8
  },
  shiftHeroRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10
  },
  shiftHeroMain: {
    flex: 1,
    gap: 4,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  shiftHeroTitle: {
    color: POS_COLORS.heading,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900"
  },
  shiftHeroMeta: {
    color: POS_COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  shiftHeroBadge: {
    width: 144,
    gap: 4,
    borderWidth: 1,
    borderColor: "#86efac",
    backgroundColor: POS_COLORS.primarySoft,
    borderRadius: POS_RADIUS.md,
    padding: 12,
    justifyContent: "center"
  },
  shiftHeroBadgeValue: {
    color: POS_COLORS.primaryDark,
    fontSize: 16,
    fontWeight: "900"
  },
  shiftHeroBadgeLabel: {
    color: POS_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  sectionCaption: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  secondaryTitle: {
    color: POS_COLORS.heading,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900"
  },
  placeholderText: {
    color: POS_COLORS.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  closeShiftBox: {
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  shiftClosingPreview: {
    flexDirection: "row",
    gap: 8
  },
  closeShiftHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  closeShiftHintText: {
    flex: 1,
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "800"
  },
  printerStatusCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  printerStatusHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  printerStatusTitle: {
    color: POS_COLORS.heading,
    fontSize: 13,
    fontWeight: "900"
  },
  printerBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  printerBadgeReady: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  printerBadgeIdle: {
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface
  },
  printerBadgeText: {
    fontSize: 10,
    fontWeight: "900"
  },
  printerBadgeTextReady: {
    color: POS_COLORS.primaryDark
  },
  printerBadgeTextIdle: {
    color: POS_COLORS.muted
  },
  closeShiftActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  closeShiftGhostButton: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  closeShiftGhostText: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  modeRow: {
    flexDirection: "row",
    gap: 8
  },
  modeButton: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  modeButtonActive: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  modeButtonText: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  modeButtonTextActive: {
    color: POS_COLORS.primaryDark
  },
  usbDeviceButton: {
    gap: 4,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  usbDeviceButtonActive: {
    borderColor: "#9fd5ae",
    backgroundColor: POS_COLORS.primarySoft
  },
  usbDeviceText: {
    color: POS_COLORS.heading,
    fontSize: 12,
    fontWeight: "900"
  },
  usbStatusText: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  closeShiftButton: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  closeShiftText: {
    color: POS_COLORS.surface,
    fontSize: 12,
    fontWeight: "900"
  },
  bottomNav: {
    flexShrink: 0,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 8
  },
  navMark: {
    width: 42,
    height: 42,
    borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  navButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 8
  },
  navButtonActive: {
    borderColor: "#86efac",
    backgroundColor: POS_COLORS.primarySoft
  },
  navIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: POS_COLORS.subtleSurface,
    alignItems: "center",
    justifyContent: "center"
  },
  navIconActive: {
    backgroundColor: "#bbf7d0"
  },
  navLabel: {
    color: POS_COLORS.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  navLabelActive: {
    color: POS_COLORS.primaryDark
  },
  navBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: POS_COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5
  },
  navBadgeText: {
    color: POS_COLORS.surface,
    fontSize: 10,
    fontWeight: "900"
  },
  changeShiftButton: {
    minWidth: 86,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  changeShiftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  changeShiftText: {
    color: POS_COLORS.danger,
    fontSize: 11,
    fontWeight: "900"
  },
  centerPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: POS_COLORS.background
  },
  loginCard: {
    width: "100%",
    maxWidth: 430,
    gap: 14,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 18,
    ...POS_SHADOW
  },
  loginBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 4
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  logoText: {
    color: POS_COLORS.surface,
    fontSize: 14,
    fontWeight: "900"
  },
  loginTitle: {
    color: POS_COLORS.heading,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "900"
  },
  loginSubtitle: {
    marginTop: 5,
    color: POS_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  shiftCard: {
    width: "100%",
    maxWidth: 480,
    gap: 14,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 18,
    ...POS_SHADOW
  },
  shiftHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  shiftTitle: {
    marginTop: 4,
    color: POS_COLORS.heading,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "900"
  },
  shiftSubtitle: {
    marginTop: 5,
    color: POS_COLORS.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  shiftSummary: {
    flexDirection: "row",
    gap: 8
  },
  summaryCell: {
    flex: 1,
    gap: 5,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 10
  },
  summaryLabel: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  summaryValue: {
    color: POS_COLORS.text,
    fontSize: 14,
    fontWeight: "900"
  },
  field: {
    gap: 7
  },
  openingShiftPanel: {
    gap: 10,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  openingCashHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  openingCashHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  openingCashIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: POS_COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  openingCashAction: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  openingCashActionText: {
    color: POS_COLORS.slate,
    fontSize: 11,
    fontWeight: "900"
  },
  openingCashCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    padding: 12
  },
  openingCashValue: {
    color: POS_COLORS.heading,
    fontSize: 18,
    fontWeight: "900"
  },
  openingCashHint: {
    color: POS_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  openingShiftNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  openingShiftNoteText: {
    flex: 1,
    color: POS_COLORS.slate,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800"
  },
  label: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    color: POS_COLORS.text,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: "800"
  },
  errorBox: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft,
    color: POS_COLORS.danger,
    borderRadius: POS_RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "800"
  },
  noticeBox: {
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    backgroundColor: POS_COLORS.subtleSurface,
    color: POS_COLORS.slate,
    borderRadius: POS_RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "800"
  },
  noticeText: {
    color: POS_COLORS.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  submitButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: POS_COLORS.primaryDark,
    backgroundColor: POS_COLORS.primary,
    borderRadius: POS_RADIUS.md,
    alignItems: "center",
    justifyContent: "center"
  },
  submitButtonDisabled: {
    borderColor: "#94a3b8",
    backgroundColor: POS_COLORS.disabled
  },
  submitText: {
    color: POS_COLORS.surface,
    fontSize: 15,
    fontWeight: "900"
  },
  disabledText: {
    color: POS_COLORS.muted
  },
  smallGhostButton: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  smallGhostText: {
    color: POS_COLORS.slate,
    fontSize: 12,
    fontWeight: "900"
  },
  flexOne: {
    flex: 1
  }
});
