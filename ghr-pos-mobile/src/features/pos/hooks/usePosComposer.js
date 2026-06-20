import { useEffect, useMemo, useState } from "react";

import { calculateCashChange } from "../../../shared/pos/posPayment";
import {
  restorePosSession,
  signInPosOperator,
  signOutPosOperator
} from "../../../services/auth/posAuthService";
import { createPosTakeawayOrderMobile } from "../../../services/pos/posOrderService";
import { fetchPosProducts } from "../../../services/pos/posProductService";
import { fetchActivePosShift, openPosShift } from "../../../services/pos/posShiftService";

const seedProducts = [
  { id: "pho-bo", name: "Pho bo", price: 45000, category: "Pho" },
  { id: "bun-bo", name: "Bun bo", price: 50000, category: "Bun" },
  { id: "tra-dao", name: "Tra dao", price: 28000, category: "Nuoc" }
];

export function usePosComposer() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [shift, setShift] = useState(null);
  const [openingCash, setOpeningCash] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [shiftMessage, setShiftMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pagerNumber, setPagerNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [products, setProducts] = useState(seedProducts);
  const [cart, setCart] = useState([]);
  const [paymentConfirmed, setPaymentConfirmed] = useState(null);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
      subtotal,
      total: subtotal
    };
  }, [cart]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const productResult = await fetchPosProducts();
      if (active && productResult.ok && productResult.products.length) {
        setProducts(productResult.products);
      }

      const restored = await restorePosSession();
      if (!active || !restored.ok) {
        return;
      }

      setSession(restored.session);
      setProfile(restored.profile);

      const shiftResult = await fetchActivePosShift({
        branchUuid: restored.profile.branchUuid
      });
      if (active && shiftResult.ok) {
        setShift(shiftResult.shift);
      }
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const addProduct = (product) => {
    setCart((current) => {
      const index = current.findIndex((item) => item.id === product.id);
      if (index < 0) {
        return [...current, { ...product, quantity: 1 }];
      }
      return current.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    });
  };

  const changeQuantity = (productId, delta) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setPaymentConfirmed(null);
  };

  const signIn = async () => {
    setBusy(true);
    setAuthMessage("");
    setShiftMessage("");

    const result = await signInPosOperator({ email, password });
    setBusy(false);

    if (!result.ok) {
      setAuthMessage(result.message || "Dang nhap that bai.");
      return;
    }

    setSession(result.session);
    setProfile(result.profile);
    setPassword("");
    setAuthMessage(`Da dang nhap: ${result.profile.branchName || result.profile.name}`);

    const [shiftResult, productResult] = await Promise.all([
      fetchActivePosShift({ branchUuid: result.profile.branchUuid }),
      fetchPosProducts()
    ]);

    if (shiftResult.ok) {
      setShift(shiftResult.shift);
    }
    if (productResult.ok && productResult.products.length) {
      setProducts(productResult.products);
    }
  };

  const signOut = async () => {
    await signOutPosOperator();
    setSession(null);
    setProfile(null);
    setShift(null);
    setOpeningCash("");
    setAuthMessage("");
    setShiftMessage("");
    clearCart();
  };

  const openShiftNow = async () => {
    if (!profile || !session?.user?.id) {
      setShiftMessage("Vui long dang nhap chi nhanh truoc.");
      return;
    }

    setBusy(true);
    setShiftMessage("");

    const result = await openPosShift({
      branchUuid: profile.branchUuid,
      branchName: profile.branchName,
      registerKey: "main",
      cashierName: profile.name || profile.email,
      profileId: profile.id,
      authUserId: session.user.id,
      openingCash: Number(openingCash || 0),
      openingNote: ""
    });

    setBusy(false);
    setShift(result.shift || null);
    setShiftMessage(result.message || "");
  };

  const confirmCash = () => {
    if (!totals.total) {
      return;
    }

    setPaymentConfirmed({
      method: "cash",
      amount: totals.total,
      received: totals.total,
      change: calculateCashChange(totals.total, totals.total)
    });
  };

  const createCashOrder = async () => {
    if (!paymentConfirmed || !profile || !shift?.id) {
      setShiftMessage("Can dang nhap va mo ca truoc khi tao don.");
      return;
    }

    const result = await createPosTakeawayOrderMobile({
      cart,
      totals,
      pagerNumber,
      customerName,
      branch: {
        branchUuid: profile.branchUuid,
        branchName: profile.branchName
      },
      orderNote,
      shift,
      cashierName: profile.name || profile.email,
      paymentMethod: paymentConfirmed.method,
      paymentStatus: "paid",
      paymentAmount: paymentConfirmed.amount,
      paymentReference: paymentConfirmed.reference || `CASH-${Date.now()}`,
      paidAt: new Date().toISOString(),
      posShiftId: shift.id
    });

    setShiftMessage(result.message || "");
    if (!result.ok) {
      return;
    }

    setCart([]);
    setPaymentConfirmed(null);
    setOrderNote("");
    setCustomerName("");
    setPagerNumber("");
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    authMessage,
    shiftMessage,
    busy,
    isSignedIn: Boolean(session && profile),
    branchName: profile?.branchName || profile?.branchAlias || "Chi nhanh POS mobile",
    shiftLabel: shift?.id ? `Ca dang mo: ${shift.cashierName || "Thu ngan"}` : "Chua mo ca",
    openingCash,
    setOpeningCash,
    pagerNumber,
    setPagerNumber,
    customerName,
    setCustomerName,
    orderNote,
    setOrderNote,
    products,
    cart,
    totals,
    paymentConfirmed,
    addProduct,
    changeQuantity,
    clearCart,
    confirmCash,
    createCashOrder,
    signIn,
    signOut,
    openShiftNow,
    hasOpenShift: Boolean(shift?.id)
  };
}

export default usePosComposer;
