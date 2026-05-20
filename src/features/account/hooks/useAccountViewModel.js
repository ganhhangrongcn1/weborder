import { useEffect, useRef, useState } from "react";
import { getCustomerKey } from "../../../services/storageService.js";
import { createUserStorage, isRegisteredUser } from "../../../services/customerService.js";
import { customerRepository } from "../../../services/repositories/customerRepository.js";
import { getDataSource } from "../../../services/repositories/dataSource.js";
import {
  getSupabaseCustomerSessionSnapshot,
  loginPhonePasswordAuth,
  registerPhonePasswordAuth,
  syncAuthProfileToCustomerRow,
  syncCustomerProfileToSupabase
} from "../../../services/supabaseAuthService.js";
import { addAddress, updateAddress, deleteAddress, setDefaultAddress } from "../../../services/addressService.js";
import { orderStorage } from "../../../services/orderService.js";
import { getPartnerOrdersByPhone, mergeCustomerLookupOrders } from "../../../services/partnerOrderService.js";
import { getMemberRank } from "../../../utils/profile.js";
import { getOrderStats } from "../../../utils/pureHelpers.js";
import { rewardFeatureFlags } from "../../../constants/featureFlags.js";
import { defaultUserDemo } from "../../../data/defaultData.js";

const userStorage = createUserStorage({
  getCustomerKey,
  defaultUserDemo
});

function isPlaceholderName(name = "") {
  const normalized = String(name || "").trim().toLowerCase();
  return !normalized || normalized === "khách" || normalized === "khách hàng" || normalized === "khach" || normalized === "khach hang";
}

function pickCustomerDisplayName(user = {}, authSessionUser = null) {
  const candidates = [
    user.name,
    user.fullName,
    user.full_name,
    user.displayName,
    user.display_name,
    user.customerName,
    user.customer_name,
    user.orderCustomerName,
    user.receiverName,
    user.lastOrderName,
    authSessionUser?.name,
    authSessionUser?.fullName,
    authSessionUser?.full_name,
    authSessionUser?.displayName,
    authSessionUser?.display_name
  ];
  return candidates.map((value) => String(value || "").trim()).find((value) => !isPlaceholderName(value)) || "Khách hàng";
}

export default function useAccountViewModel({
  navigate,
  demoUser,
  setDemoUser,
  currentPhone,
  loginOrRegisterByPhone,
  demoAddresses,
  setDemoAddresses,
  demoOrders
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [addressModal, setAddressModal] = useState(null);
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [registerDraft, setRegisterDraft] = useState({
    name: "",
    password: "",
    confirmPassword: ""
  });
  const [accountEntryTab, setAccountEntryTab] = useState("lookup");
  const [loginDraft, setLoginDraft] = useState({
    phone: "",
    password: ""
  });
  const [resetDraft, setResetDraft] = useState({
    phone: "",
    code: "",
    password: "",
    confirmPassword: ""
  });
  const [resetStep, setResetStep] = useState("verify");
  const [authMode, setAuthMode] = useState("lookup");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupOrders, setLookupOrders] = useState([]);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupUser, setLookupUser] = useState(null);
  const [authNotice, setAuthNotice] = useState("");
  const [accountNotice, setAccountNotice] = useState(null);
  const [showAllAddresses, setShowAllAddresses] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);
  const [authSessionUser, setAuthSessionUser] = useState(null);
  const [accountPartnerOrders, setAccountPartnerOrders] = useState([]);
  const remoteUserRequestRef = useRef(0);
  const shouldUseSupabaseAuth = getDataSource() === "supabase";
  const accountUser = remoteUser || demoUser || {};

  const addresses = demoAddresses || [];
  const visibleAddresses = showAllAddresses ? addresses : addresses.slice(0, 3);
  const accountOrders = currentPhone
    ? mergeCustomerLookupOrders(demoOrders || [], accountPartnerOrders)
    : demoOrders || [];
  const stats = getOrderStats(accountOrders);
  const rank = getMemberRank(stats.totalSpent);
  const showCustomerTier = rewardFeatureFlags.enableCustomerTier;
  const displayName = pickCustomerDisplayName(accountUser, authSessionUser);

  useEffect(() => {
    let disposed = false;
    remoteUserRequestRef.current += 1;
    const requestId = remoteUserRequestRef.current;
    if (!currentPhone) {
      setRemoteUser(null);
      return () => {
        disposed = true;
      };
    }

    async function loadAccountUserRemoteFirst() {
      try {
        const remote = await customerRepository.getUserByPhoneAsync(currentPhone);
        if (disposed || requestId !== remoteUserRequestRef.current) return;
        if (remote) {
          setRemoteUser(remote);
          setDemoUser(remote);
          return;
        }
        setRemoteUser(null);
      } catch {
        if (!disposed && requestId === remoteUserRequestRef.current) {
          setRemoteUser(null);
        }
      }
    }

    loadAccountUserRemoteFirst();
    return () => {
      disposed = true;
    };
  }, [currentPhone, setDemoUser]);

  useEffect(() => {
    let disposed = false;
    if (!currentPhone || !shouldUseSupabaseAuth) {
      setAuthSessionUser(null);
      return () => {
        disposed = true;
      };
    }

    async function loadAuthSessionUser() {
      const snapshot = await getSupabaseCustomerSessionSnapshot();
      if (disposed) return;
      const sessionPhone = getCustomerKey(snapshot?.phone || "");
      if (snapshot?.ok && sessionPhone === getCustomerKey(currentPhone)) {
        setAuthSessionUser(snapshot);
        return;
      }
      setAuthSessionUser(null);
    }

    loadAuthSessionUser();
    return () => {
      disposed = true;
    };
  }, [currentPhone, shouldUseSupabaseAuth]);

  useEffect(() => {
    let disposed = false;

    async function loadAccountPartnerOrders() {
      if (!currentPhone) {
        setAccountPartnerOrders([]);
        return;
      }

      try {
        const nextOrders = await getPartnerOrdersByPhone(currentPhone);
        if (!disposed) setAccountPartnerOrders(nextOrders);
      } catch {
        if (!disposed) setAccountPartnerOrders([]);
      }
    }

    loadAccountPartnerOrders();
    return () => {
      disposed = true;
    };
  }, [currentPhone]);

  async function resolveFreshUserAfterLogin(phone, fallbackUser = null) {
    const key = getCustomerKey(phone);
    if (!key) return fallbackUser;
    try {
      await userStorage.hydrateFromRemote?.();
    } catch {
    }
    const latest = userStorage.findByPhone(key);
    if (latest) return latest;
    try {
      const remote = await customerRepository.getUserByPhoneAsync?.(key);
      if (remote) {
        userStorage.upsertUser(remote);
        return remote;
      }
    } catch {
    }
    return fallbackUser;
  }

  function hasMemberAccount(user) {
    if (!user) return false;
    if (isRegisteredUser(user)) return true;
    if (shouldUseSupabaseAuth) {
      return Boolean(String(user?.email || "").trim() || String(user?.passwordDemo || "").trim());
    }
    return Boolean(String(user?.passwordDemo || "").trim());
  }

  function showWrongOrderCodeNotice() {
    setAccountNotice({
      title: "Mã đơn chưa đúng",
      message: "Để xác minh đúng bạn là chủ số điện thoại này và tránh người khác dùng nhầm số của bạn, app cần mã đơn gần nhất. Bạn kiểm tra lại tin nhắn Zalo mới nhất giúp mình nhé.",
      icon: "warning"
    });
  }

  async function handleSaveUser(patch) {
    try {
      customerRepository.suppressRemoteWrite?.(4000);
      const activePhone = accountUser?.phone || userStorage.getCurrentPhone?.() || "";
      const mergedAvatarUrl = patch.avatarUrl ?? accountUser?.avatarUrl ?? "";
      const saved = await customerRepository.upsertCustomerByPhone(
        activePhone,
        {
          ...(accountUser || {}),
          name: patch.name ?? accountUser?.name ?? "",
          avatarUrl: mergedAvatarUrl,
          ...(patch.passwordDemo ? { passwordDemo: patch.passwordDemo } : {})
        },
        { writeRemote: shouldUseSupabaseAuth }
      );
      if (!saved) {
        setAuthNotice("Không xác định được số điện thoại để lưu hồ sơ.");
        return;
      }

      if (shouldUseSupabaseAuth) {
        const syncResult = await syncCustomerProfileToSupabase({
          phone: activePhone,
          name: saved.name || "",
          email: saved.email || "",
          avatarUrl: mergedAvatarUrl
        });
        if (!syncResult.ok && import.meta?.env?.DEV) {
          console.warn("[account] syncCustomerProfileToSupabase failed", syncResult.message);
        }
        try {
          await userStorage.hydrateFromRemote?.();
        } catch {
        }
      }

      const refreshed = userStorage.findByPhone(activePhone) || saved;
      setRemoteUser(refreshed);
      setDemoUser(refreshed);
      setAuthNotice("Đã lưu hồ sơ.");
      setProfileOpen(false);
    } catch {
      setAuthNotice("Không thể lưu hồ sơ lúc này.");
    }
  }

  function handleSaveAddress(address) {
    const next = address.id
      ? updateAddress(addresses, address.id, address)
      : addAddress(addresses, {
          ...address,
          isDefault: addresses.length === 0 || address.isDefault
        });
    setDemoAddresses(
      address.isDefault || addresses.length === 0
        ? setDefaultAddress(next, address.id || next[0].id)
        : next
    );
    setAddressModal(null);
  }

  function handleDeleteAddress(addressId) {
    if (addresses.length <= 1) {
      alert("Cần giữ ít nhất 1 địa chỉ");
      return;
    }
    setDemoAddresses(deleteAddress(addresses, addressId));
  }

  function handleSetDefaultAddress(addressId) {
    setDemoAddresses(setDefaultAddress(addresses, addressId));
  }

  function navigateToTab(tabName) {
    const map = {
      orders: ["tracking", "orders"],
      rewards: ["loyalty", "rewards"],
      account: ["account", "account"]
    };
    const target = map[tabName] || map.account;
    navigate(target[0], target[1]);
  }

  async function handlePhoneLookup() {
    const phone = getCustomerKey(authPhone);
    if (!phone || phone.length < 9) {
      alert("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }
    setIsLookupLoading(true);
    try {
      const localUser = userStorage.findByPhone(phone);
      const existingUser = shouldUseSupabaseAuth
        ? (await customerRepository.getUserByPhoneAsync(phone)) || localUser
        : localUser;
      const [orders, partnerOrders] = await Promise.all([
        shouldUseSupabaseAuth
          ? orderStorage.getByPhoneAsync(phone)
          : Promise.resolve(orderStorage.getByPhone(phone)),
        getPartnerOrdersByPhone(phone)
      ]);
      const mergedOrders = mergeCustomerLookupOrders(orders, partnerOrders);
      setLookupPhone(phone);
      setLookupUser(existingUser);
      setLookupOrders(mergedOrders);
      setAuthPassword("");
      setRegisterDraft({
        name: existingUser?.name || "",
        password: "",
        confirmPassword: ""
      });
      const hasRegisteredAccount = hasMemberAccount(existingUser);
      if (hasRegisteredAccount) {
        setLoginDraft((draft) => ({ ...draft, phone }));
      }
      setAuthMode(hasRegisteredAccount ? "login" : "register");
      setAuthNotice(
        hasRegisteredAccount
          ? "Số này đã có tài khoản. Nhập mật khẩu để mở điểm, địa chỉ và voucher."
          : mergedOrders.length
            ? "Số này đã từng đặt hàng. Bạn có thể tạo tài khoản để liên kết lịch sử và điểm."
            : "Vui lòng đăng ký tài khoản để nhận điểm tích lũy, lưu voucher và xem lịch sử đơn hàng đầy đủ."
      );
    } finally {
      setIsLookupLoading(false);
    }
  }

  async function handlePasswordLogin() {
    let authResult = null;
    if (!shouldUseSupabaseAuth && (!lookupUser || lookupUser.passwordDemo !== authPassword)) {
      alert("Mật khẩu chưa đúng.");
      return;
    }
    if (shouldUseSupabaseAuth) {
      authResult = await loginPhonePasswordAuth({
        phone: lookupPhone,
        password: authPassword
      });
      if (!authResult.ok) {
        alert(authResult.message || "Đăng nhập Supabase thất bại.");
        return;
      }
      const authSyncResult = await syncAuthProfileToCustomerRow();
      if (!authSyncResult.ok && import.meta?.env?.DEV) {
        console.warn("[account] lookup syncAuthProfileToCustomerRow failed", authSyncResult.message);
      }
      try {
        await userStorage.hydrateFromRemote?.();
      } catch {
      }
      userStorage.upsertUser({
        ...(userStorage.findByPhone(lookupPhone) || {}),
        phone: lookupPhone,
        registered: true
      });
    }
    const result = loginOrRegisterByPhone(lookupPhone);
    if (!result) return;
    const freshUser = await resolveFreshUserAfterLogin(lookupPhone, result?.user || null);
    if (freshUser) {
      setDemoUser(freshUser);
      setRemoteUser(freshUser);
    }
    customerRepository.saveSessionPointer?.({
      phone: lookupPhone,
      customerId: freshUser?.id || result?.user?.id || lookupPhone,
      authUserId: authResult?.data?.user?.id || authResult?.data?.session?.user?.id || ""
    });
    setAuthNotice("Đăng nhập thành công.");
    setAuthPhone("");
    setAuthPassword("");
    setAuthMode("lookup");
    navigate("home", "home");
  }

  async function handleDirectLogin() {
    const phone = getCustomerKey(loginDraft.phone);
    if (!phone || phone.length < 9) {
      alert("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }
    if (shouldUseSupabaseAuth) {
      const authResult = await loginPhonePasswordAuth({
        phone,
        password: loginDraft.password
      });
      if (!authResult.ok) {
        alert(authResult.message || "Đăng nhập thất bại.");
        return;
      }
      const authSyncResult = await syncAuthProfileToCustomerRow();
      if (!authSyncResult.ok && import.meta?.env?.DEV) {
        console.warn("[account] syncAuthProfileToCustomerRow failed", authSyncResult.message);
      }
      try {
        await userStorage.hydrateFromRemote?.();
      } catch {
      }
      userStorage.upsertUser({
        ...(userStorage.findByPhone(phone) || {}),
        phone,
        registered: true
      });
      const result = loginOrRegisterByPhone(phone);
      if (!result) return;
      const freshUser = await resolveFreshUserAfterLogin(phone, result?.user || null);
      if (freshUser) {
        setDemoUser(freshUser);
        setRemoteUser(freshUser);
      }
      customerRepository.saveSessionPointer?.({
        phone,
        customerId: freshUser?.id || result?.user?.id || phone,
        authUserId: authResult?.data?.user?.id || authResult?.data?.session?.user?.id || ""
      });
      setAuthNotice("Đăng nhập thành công.");
      setLoginDraft({ phone: "", password: "" });
      setAuthPhone("");
      navigate("home", "home");
      return;
    }
    const user = userStorage.findByPhone(phone);
    if (!isRegisteredUser(user)) {
      setAccountEntryTab("lookup");
      setAuthPhone(phone);
      setAuthNotice(
        "Số này chưa có tài khoản. Bạn có thể tạo tài khoản mới bằng số điện thoại này."
      );
      return;
    }
    if (user.passwordDemo !== loginDraft.password) {
      alert("Số điện thoại hoặc mật khẩu chưa đúng.");
      return;
    }
    const result = loginOrRegisterByPhone(phone);
    if (!result) return;
    setAuthNotice("Đăng nhập thành công.");
    setLoginDraft({ phone: "", password: "" });
    setAuthPhone("");
    navigate("home", "home");
  }

  function handleVerifyResetPassword() {
    const phone = getCustomerKey(resetDraft.phone);
    const user = userStorage.findByPhone(phone);
    if (!phone || phone.length < 9) {
      alert("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }
    if (!isRegisteredUser(user)) {
      alert("Số điện thoại này chưa có tài khoản.");
      return;
    }
    const orders = orderStorage.getByPhone(phone);
    const latestOrder = [...orders].sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0))[0];
    const enteredCode = `GHR-${String(resetDraft.code || "").replace(/\D/g, "").slice(0, 4)}`;
    if (!latestOrder?.orderCode || String(latestOrder.orderCode).toUpperCase() !== enteredCode) {
      showWrongOrderCodeNotice();
      return;
    }
    setResetStep("password");
    setAuthNotice("Xác minh thành công. Bạn có thể tạo mật khẩu mới.");
  }

  function handleUpdatePasswordFromOrder() {
    const phone = getCustomerKey(resetDraft.phone);
    if (resetDraft.password.length < 6) {
      alert("Mật khẩu mới tối thiểu 6 ký tự.");
      return;
    }
    if (resetDraft.password !== resetDraft.confirmPassword) {
      alert("Nhập lại mật khẩu mới chưa khớp.");
      return;
    }
    const user = userStorage.findByPhone(phone);
    if (!isRegisteredUser(user)) {
      alert("Không tìm thấy tài khoản để cập nhật.");
      return;
    }
    userStorage.upsertUser({
      ...user,
      phone,
      passwordDemo: resetDraft.password,
      registered: true
    });
    setResetDraft({
      phone: "",
      code: "",
      password: "",
      confirmPassword: ""
    });
    setResetStep("verify");
    setAccountEntryTab("login");
    setAuthNotice("Đã cập nhật mật khẩu. Bạn đăng nhập lại bằng mật khẩu mới nhé.");
  }

  async function handleRegister() {
    const registerPhone = getCustomerKey(accountEntryTab === "register" ? authPhone : lookupPhone || authPhone);
    if (!registerPhone || registerPhone.length < 9) {
      alert("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }
    const localUser = userStorage.findByPhone(registerPhone);
    const existingUser = shouldUseSupabaseAuth
      ? (await customerRepository.getUserByPhoneAsync(registerPhone)) || localUser
      : localUser;
    if (hasMemberAccount(existingUser)) {
      setLoginDraft((draft) => ({ ...draft, phone: registerPhone }));
      setAccountEntryTab("login");
      setAuthNotice("Số này đã có tài khoản. Bạn đăng nhập bằng mật khẩu đã tạo nhé.");
      return;
    }
    if (!registerDraft.name.trim()) {
      alert("Vui lòng nhập tên khách.");
      return;
    }
    if (registerDraft.password.length < 6) {
      alert("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    if (registerDraft.password !== registerDraft.confirmPassword) {
      alert("Nhập lại mật khẩu chưa khớp.");
      return;
    }
    let registerAuthResult = null;
    if (shouldUseSupabaseAuth) {
      const authResult = await registerPhonePasswordAuth({
        phone: registerPhone,
        password: registerDraft.password,
        name: registerDraft.name.trim()
      });
      registerAuthResult = authResult;
      if (!authResult.ok) {
        alert(authResult.message || "Không thể tạo tài khoản Supabase.");
        return;
      }
    }
    const result = loginOrRegisterByPhone(
      registerPhone,
      registerDraft.name.trim(),
      registerDraft.password,
      true
    );
    if (!result) return;
    customerRepository.saveSessionPointer?.({
      phone: registerPhone,
      customerId: result?.user?.id || registerPhone,
      authUserId: shouldUseSupabaseAuth ? (registerAuthResult?.data?.user?.id || registerAuthResult?.data?.session?.user?.id || "") : ""
    });
    if (shouldUseSupabaseAuth) {
      const syncResult = await syncCustomerProfileToSupabase({
        phone: registerPhone,
        name: registerDraft.name.trim()
      });
      if (!syncResult.ok) {
        const message = syncResult.message || "Tạo tài khoản local thành công nhưng chưa đồng bộ customer lên Supabase.";
        setAuthNotice(message);
        if (import.meta?.env?.DEV) {
          console.warn("[account] register sync customer failed", message);
        }
      } else if (import.meta?.env?.DEV) {
        console.info("[account] register sync customer ok", registerPhone);
      }
    }
    setAuthNotice("Đăng ký thành công. Dữ liệu cũ theo số điện thoại đã được liên kết.");
    setAuthPhone("");
    setAuthPassword("");
    setAuthMode("lookup");
  }

  return {
    profileOpen,
    setProfileOpen,
    addressModal,
    setAddressModal,
    authPhone,
    setAuthPhone,
    authPassword,
    setAuthPassword,
    registerDraft,
    setRegisterDraft,
    accountEntryTab,
    setAccountEntryTab,
    loginDraft,
    setLoginDraft,
    resetDraft,
    setResetDraft,
    resetStep,
    setResetStep,
    authMode,
    setAuthMode,
    lookupPhone,
    setLookupPhone,
    lookupOrders,
    setLookupOrders,
    isLookupLoading,
    lookupUser,
    setLookupUser,
    authNotice,
    setAuthNotice,
    accountNotice,
    setAccountNotice,
    showAllAddresses,
    setShowAllAddresses,
    addresses,
    visibleAddresses,
    stats,
    rank,
    showCustomerTier,
    accountUser,
    displayName,
    handleSaveUser,
    handleSaveAddress,
    handleDeleteAddress,
    handleSetDefaultAddress,
    navigateToTab,
    handlePhoneLookup,
    handlePasswordLogin,
    handleDirectLogin,
    handleVerifyResetPassword,
    handleUpdatePasswordFromOrder,
    handleRegister
  };
}
