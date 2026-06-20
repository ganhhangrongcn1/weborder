import { useEffect, useRef, useState } from "react";
import { getCustomerKey } from "../../../services/storageService.js";
import { createUserStorage, isRegisteredUser } from "../../../services/customerService.js";
import { customerRepository } from "../../../services/repositories/customerRepository.js";
import { getDataSource } from "../../../services/repositories/dataSource.js";
import {
  getSupabaseCustomerSessionSnapshot,
  changeLoggedInCustomerPasswordAuth,
  loginPhonePasswordAuth,
  requestCustomerPasswordResetEmailAuth,
  registerPhonePasswordAuth,
  syncAuthProfileToCustomerRow,
  syncCustomerProfileToSupabase,
  updateRecoveryPasswordAuth
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
const POST_LOGIN_REDIRECT_KEY = "ghr_post_login_redirect";

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function isRealEmail(email = "") {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && !normalized.endsWith("@phone.ghr.vn");
}

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
    authSessionUser?.name,
    authSessionUser?.fullName,
    authSessionUser?.full_name,
    authSessionUser?.displayName,
    authSessionUser?.display_name
  ];
  return candidates.map((value) => String(value || "").trim()).find((value) => !isPlaceholderName(value)) || "Khách hàng";
}

function readPendingPostLoginRedirect() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function consumePendingPostLoginRedirect() {
  const pending = readPendingPostLoginRedirect();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    } catch {
    }
  }
  return pending;
}

async function refreshCustomerUserFromRemote(phone) {
  const key = getCustomerKey(phone);
  if (!key) return null;
  try {
    await userStorage.hydrateFromRemote?.();
  } catch {
  }
  return userStorage.findByPhone(key) || null;
}

async function syncRegisteredCustomerProfile({
  phone,
  name = "",
  email = "",
  avatarUrl = "",
  authUserId = ""
}) {
  const key = getCustomerKey(phone);
  if (!key) {
    return { ok: false, message: "Khong xac dinh duoc so dien thoai de dong bo profile.", user: null };
  }

  const syncResult = await syncCustomerProfileToSupabase({
    phone: key,
    name,
    email,
    avatarUrl,
    authUserId
  });

  const refreshedUser = await refreshCustomerUserFromRemote(key);
  return {
    ok: Boolean(syncResult?.ok),
    message: String(syncResult?.message || "").trim(),
    user: refreshedUser
  };
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
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetPasswordDraft, setResetPasswordDraft] = useState({
    password: "",
    confirmPassword: ""
  });
  const [accountEntryTab, setAccountEntryTab] = useState("login");
  const [loginDraft, setLoginDraft] = useState({
    phone: "",
    password: ""
  });
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
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search || "");
    const hash = String(window.location.hash || "");
    const isRecovery = search.get("authFlow") === "recovery" || hash.includes("type=recovery");
    if (isRecovery) {
      setAccountEntryTab("resetPassword");
      setAuthNotice("Nhập mật khẩu mới để hoàn tất đặt lại mật khẩu.");
    }
  }, []);

  useEffect(() => {
    const pending = readPendingPostLoginRedirect();
    const pendingPhone = getCustomerKey(pending?.phone || "");
    if (!pendingPhone) return;
    setAccountEntryTab("login");
    setLoginDraft((draft) => ({ ...draft, phone: pendingPhone }));
    setAuthPhone(pendingPhone);
  }, []);

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
      const authUserId = String(user?.authUserId || user?.auth_user_id || "").trim();
      const email = String(user?.email || "").trim().toLowerCase();
      return Boolean(authUserId || email.endsWith("@phone.ghr.vn"));
    }
    return false;
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
      const activePhone = accountUser?.phone || userStorage.getCurrentPhone?.() || "";
      const mergedAvatarUrl = patch.avatarUrl ?? accountUser?.avatarUrl ?? "";
      const shouldSyncViaAuth = shouldUseSupabaseAuth;
      const saved = await customerRepository.upsertCustomerByPhone(
        activePhone,
        {
          ...(accountUser || {}),
          name: patch.name ?? accountUser?.name ?? "",
          avatarUrl: mergedAvatarUrl
        },
        { writeRemote: !shouldSyncViaAuth }
      );
      if (!saved) {
        setAuthNotice("Không xác định được số điện thoại để lưu hồ sơ.");
        return;
      }

      let refreshed = saved;
      if (shouldSyncViaAuth) {
        const syncResult = await syncRegisteredCustomerProfile({
          phone: activePhone,
          name: saved.name || "",
          email: saved.email || "",
          avatarUrl: mergedAvatarUrl
        });
        if (!syncResult.ok && import.meta?.env?.DEV) {
          console.warn("[account] syncCustomerProfileToSupabase failed", syncResult.message);
        }
        refreshed = syncResult.user || saved;
      } else {
        refreshed = (await refreshCustomerUserFromRemote(activePhone)) || saved;
      }

      setRemoteUser(refreshed);
      setDemoUser(refreshed);
      setAuthNotice("Đã lưu hồ sơ.");
      setProfileOpen(false);
    } catch {
      setAuthNotice("Không thể lưu hồ sơ lúc này.");
    }
  }

  async function handleChangePassword({ currentPassword, newPassword, confirmPassword }) {
    const activePhone = accountUser?.phone || userStorage.getCurrentPhone?.() || currentPhone || "";
    if (!shouldUseSupabaseAuth) {
      return { ok: false, message: "Đổi mật khẩu cần Supabase Auth." };
    }
    if (String(newPassword || "").length < 6) {
      return { ok: false, message: "Mật khẩu mới tối thiểu 6 ký tự." };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, message: "Nhập lại mật khẩu mới chưa khớp." };
    }
    const result = await changeLoggedInCustomerPasswordAuth({
      phone: activePhone,
      currentPassword,
      newPassword,
      email: accountUser?.email || authSessionUser?.email || ""
    });
    if (result.ok) {
      setAuthNotice("Đã đổi mật khẩu thành công.");
    }
    return result;
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

  function navigateAfterLogin() {
    const pending = consumePendingPostLoginRedirect();
    if (pending?.target === "orders") {
      navigate("tracking", "orders");
      return;
    }
    navigate("home", "home");
  }

  function navigateAfterRegisterIfNeeded() {
    const pending = consumePendingPostLoginRedirect();
    if (pending?.target === "orders") {
      navigate("tracking", "orders");
    }
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
        email: isRealEmail(existingUser?.email) ? normalizeEmail(existingUser.email) : "",
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
    if (!shouldUseSupabaseAuth) {
      alert("Mật khẩu chưa đúng.");
      return;
    }
    if (shouldUseSupabaseAuth) {
      authResult = await loginPhonePasswordAuth({
        phone: lookupPhone,
        password: authPassword,
        email: lookupUser?.email || ""
      });
      if (!authResult.ok) {
        alert(authResult.message || "Đăng nhập Supabase thất bại.");
        return;
      }
      const authSyncResult = await syncAuthProfileToCustomerRow();
      if (!authSyncResult.ok && import.meta?.env?.DEV) {
        console.warn("[account] lookup syncAuthProfileToCustomerRow failed", authSyncResult.message);
      }
      const syncedUser = await refreshCustomerUserFromRemote(lookupPhone);
      if (syncedUser) {
        setLookupUser(syncedUser);
      }
    }
    const result = loginOrRegisterByPhone(lookupPhone, "", "", false, {
      hasCustomerAuthSession: Boolean(authResult?.data?.session),
      authUserId: authResult?.data?.user?.id || authResult?.data?.session?.user?.id || ""
    });
    if (!result) return;
    const freshUser = await resolveFreshUserAfterLogin(lookupPhone, result?.user || null);
    if (freshUser) {
      setDemoUser(freshUser);
      setRemoteUser(freshUser);
    }
    customerRepository.saveSessionPointer?.({
      phone: lookupPhone,
      customerId: freshUser?.id || result?.user?.id || lookupPhone,
      authUserId: authResult?.data?.user?.id || authResult?.data?.session?.user?.id || freshUser?.authUserId || ""
    });
    setAuthNotice("Đăng nhập thành công.");
    setAuthPhone("");
    setAuthPassword("");
    setAuthMode("lookup");
    navigateAfterLogin();
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
      const result = loginOrRegisterByPhone(phone, "", "", false, {
        hasCustomerAuthSession: Boolean(authResult?.data?.session),
        authUserId: authResult?.data?.user?.id || authResult?.data?.session?.user?.id || ""
      });
      if (!result) return;
      const freshUser = await resolveFreshUserAfterLogin(phone, result?.user || null);
      if (freshUser) {
        setDemoUser(freshUser);
        setRemoteUser(freshUser);
      }
      customerRepository.saveSessionPointer?.({
        phone,
        customerId: freshUser?.id || result?.user?.id || phone,
        authUserId: authResult?.data?.user?.id || authResult?.data?.session?.user?.id || freshUser?.authUserId || ""
      });
      setAuthNotice("Đăng nhập thành công.");
      setLoginDraft({ phone: "", password: "" });
      setAuthPhone("");
      navigateAfterLogin();
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
    if (true) {
      alert("Số điện thoại hoặc mật khẩu chưa đúng.");
      return;
    }
    const result = loginOrRegisterByPhone(phone);
    if (!result) return;
    setAuthNotice("Đăng nhập thành công.");
    setLoginDraft({ phone: "", password: "" });
    setAuthPhone("");
    navigateAfterLogin();
  }

  function handleVerifyResetPassword() {
    alert("Mật khẩu hiện được quản lý bằng Supabase Auth. Vui lòng liên hệ cửa hàng để đặt lại mật khẩu.");
  }

  function handleUpdatePasswordFromOrder() {
    alert("Mật khẩu hiện được quản lý bằng Supabase Auth. Vui lòng liên hệ cửa hàng để đặt lại mật khẩu.");
  }

  async function handleForgotPassword() {
    const result = await requestCustomerPasswordResetEmailAuth({
      email: forgotEmail
    });
    if (!result.ok) {
      alert(result.message || "Không thể gửi email đặt lại mật khẩu.");
      return;
    }
    setAuthNotice("Đã gửi link đặt lại mật khẩu. Bạn kiểm tra hộp thư email nhé.");
  }

  async function handleRecoveryPasswordUpdate() {
    if (resetPasswordDraft.password.length < 6) {
      alert("Mật khẩu mới tối thiểu 6 ký tự.");
      return;
    }
    if (resetPasswordDraft.password !== resetPasswordDraft.confirmPassword) {
      alert("Nhập lại mật khẩu mới chưa khớp.");
      return;
    }
    const result = await updateRecoveryPasswordAuth({
      password: resetPasswordDraft.password
    });
    if (!result.ok) {
      alert(result.message || "Không thể cập nhật mật khẩu mới.");
      return;
    }
    setResetPasswordDraft({
      password: "",
      confirmPassword: ""
    });
    setAccountEntryTab("login");
    setAuthNotice("Đã cập nhật mật khẩu mới. Bạn đăng nhập lại bằng số điện thoại và mật khẩu mới nhé.");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("authFlow");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
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
    if (!isRealEmail(registerDraft.email)) {
      alert("Vui lòng nhập email thật để lấy lại mật khẩu khi cần.");
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
        name: registerDraft.name.trim(),
        email: registerDraft.email
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
      "",
      true,
      {
        hasCustomerAuthSession: Boolean(registerAuthResult?.data?.session),
        authUserId: shouldUseSupabaseAuth ? (registerAuthResult?.data?.user?.id || registerAuthResult?.data?.session?.user?.id || "") : ""
      }
    );
    if (!result) return;
    customerRepository.saveSessionPointer?.({
      phone: registerPhone,
      customerId: result?.user?.id || registerPhone,
      authUserId: shouldUseSupabaseAuth ? (registerAuthResult?.data?.user?.id || registerAuthResult?.data?.session?.user?.id || "") : ""
    });
    if (shouldUseSupabaseAuth) {
      const syncResult = await syncRegisteredCustomerProfile({
        phone: registerPhone,
        name: registerDraft.name.trim(),
        email: normalizeEmail(registerDraft.email),
        authUserId: registerAuthResult?.data?.user?.id || registerAuthResult?.data?.session?.user?.id || ""
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
      const refreshedUser = syncResult.user || (await refreshCustomerUserFromRemote(registerPhone)) || result.user || null;
      if (refreshedUser) {
        setDemoUser(refreshedUser);
        setRemoteUser(refreshedUser);
      }
    }
    setAuthNotice("Đăng ký thành công. Dữ liệu cũ theo số điện thoại đã được liên kết.");
    setAuthPhone("");
    setAuthPassword("");
    setAuthMode("lookup");
    navigateAfterRegisterIfNeeded();
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
    forgotEmail,
    setForgotEmail,
    resetPasswordDraft,
    setResetPasswordDraft,
    accountEntryTab,
    setAccountEntryTab,
    loginDraft,
    setLoginDraft,
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
    handleChangePassword,
    handleSaveAddress,
    handleDeleteAddress,
    handleSetDefaultAddress,
    navigateToTab,
    handlePhoneLookup,
    handlePasswordLogin,
    handleDirectLogin,
    handleForgotPassword,
    handleRecoveryPasswordUpdate,
    handleRegister
  };
}
