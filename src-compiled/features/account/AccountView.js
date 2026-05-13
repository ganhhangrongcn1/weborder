import Icon from "../../components/Icon.js";
import AccountPanel from "../../pages/customer/account/AccountPanel.js";
import AddressCard from "../../pages/customer/account/AddressCard.js";
import SettingsToggle from "../../pages/customer/account/SettingsToggle.js";
import ProfileModal from "../../pages/customer/account/ProfileModal.js";
import AccountAddressModal from "../../pages/customer/account/AccountAddressModal.js";
import AppHeader from "../../components/app/Header.js";
import AppEmptyState from "../../components/app/EmptyState.js";
import { formatMoney } from "../../utils/format.js";
import { getOrderStats } from "../../utils/pureHelpers.js";
import useAccountViewModel from "./hooks/useAccountViewModel.js";
import FlaticonCredit from "./components/FlaticonCredit.js";
import AccountNoticeModal from "./components/AccountNoticeModal.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function Account({
  navigate,
  demoUser,
  setDemoUser,
  currentPhone,
  loginOrRegisterByPhone,
  logoutDemoUser,
  demoAddresses,
  setDemoAddresses,
  demoLoyalty,
  demoOrders
}) {
  const vm = useAccountViewModel({
    navigate,
    demoUser,
    setDemoUser,
    currentPhone,
    loginOrRegisterByPhone,
    demoAddresses,
    setDemoAddresses,
    demoOrders
  });
  if (!currentPhone) {
    const lookupStats = getOrderStats(vm.lookupOrders);
    return /*#__PURE__*/_jsxs("section", {
      children: [/*#__PURE__*/_jsx(AppHeader, {
        title: "T\xE0i kho\u1EA3n",
        right: /*#__PURE__*/_jsx("button", {
          className: "top-icon",
          children: /*#__PURE__*/_jsx(Icon, {
            name: "bell",
            size: 18
          })
        })
      }), /*#__PURE__*/_jsxs("div", {
        className: "space-y-4 px-4",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "rounded-[28px] bg-white p-4 shadow-soft",
          children: [/*#__PURE__*/_jsxs("div", {
            className: "grid grid-cols-2 rounded-2xl bg-cream p-1",
            children: [/*#__PURE__*/_jsx("button", {
              onClick: () => vm.setAccountEntryTab("lookup"),
              className: `rounded-xl px-3 py-2 text-sm font-black ${vm.accountEntryTab === "lookup" ? "bg-white text-orange-600 shadow-sm" : "text-brown/55"}`,
              children: "Tra c\u1EE9u \u0111\u01A1n"
            }), /*#__PURE__*/_jsx("button", {
              onClick: () => vm.setAccountEntryTab("login"),
              className: `rounded-xl px-3 py-2 text-sm font-black ${vm.accountEntryTab === "login" ? "bg-white text-orange-600 shadow-sm" : "text-brown/55"}`,
              children: "\u0110\u0103ng nh\u1EADp"
            })]
          }), vm.accountEntryTab === "lookup" ? /*#__PURE__*/_jsxs("div", {
            className: "mt-4",
            children: [/*#__PURE__*/_jsx("h2", {
              className: "text-base font-black text-brown",
              children: "Tra c\u1EE9u b\u1EB1ng s\u1ED1 \u0111i\u1EC7n tho\u1EA1i"
            }), /*#__PURE__*/_jsx("p", {
              className: "mt-1 text-sm text-brown/60",
              children: "Nh\u1EADp s\u1ED1 \u0111i\u1EC7n tho\u1EA1i \u0111\u1EC3 xem l\u1ECBch s\u1EED \u0111\u01A1n. \u0110i\u1EC3m, \u0111\u1ECBa ch\u1EC9 v\xE0 voucher c\u1EA7n \u0111\u0103ng nh\u1EADp \u0111\u1EC3 xem \u0111\u1EA7y \u0111\u1EE7."
            }), /*#__PURE__*/_jsxs("div", {
              className: "mt-3 flex gap-2",
              children: [/*#__PURE__*/_jsx("input", {
                value: vm.authPhone,
                onChange: event => vm.setAuthPhone(event.target.value),
                placeholder: "Nh\u1EADp s\u1ED1 \u0111i\u1EC7n tho\u1EA1i",
                className: "min-w-0 flex-1 rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("button", {
                onClick: vm.handlePhoneLookup,
                className: "rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange",
                children: "Ti\u1EBFp t\u1EE5c"
              })]
            })]
          }) : vm.accountEntryTab === "login" ? /*#__PURE__*/_jsxs("div", {
            className: "mt-4",
            children: [/*#__PURE__*/_jsx("h2", {
              className: "text-base font-black text-brown",
              children: "\u0110\u0103ng nh\u1EADp t\xE0i kho\u1EA3n"
            }), /*#__PURE__*/_jsx("p", {
              className: "mt-1 text-sm text-brown/60",
              children: "Nh\u1EADp s\u1ED1 \u0111i\u1EC7n tho\u1EA1i v\xE0 m\u1EADt kh\u1EA9u \u0111\u1EC3 xem h\u1ED3 s\u01A1 v\xE0 d\u1EEF li\u1EC7u kh\xE1ch h\xE0ng."
            }), /*#__PURE__*/_jsxs("div", {
              className: "mt-3 space-y-3",
              children: [/*#__PURE__*/_jsx("input", {
                value: vm.loginDraft.phone,
                onChange: event => vm.setLoginDraft(draft => ({
                  ...draft,
                  phone: event.target.value
                })),
                placeholder: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("input", {
                type: "password",
                value: vm.loginDraft.password,
                onChange: event => vm.setLoginDraft(draft => ({
                  ...draft,
                  password: event.target.value
                })),
                placeholder: "M\u1EADt kh\u1EA9u",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("button", {
                onClick: vm.handleDirectLogin,
                className: "w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange",
                children: "\u0110\u0103ng nh\u1EADp"
              })]
            }), /*#__PURE__*/_jsx("button", {
              onClick: () => {
                vm.setAccountEntryTab("register");
                vm.setAuthMode("register");
                vm.setLookupPhone("");
                vm.setLookupOrders([]);
                vm.setAuthNotice("");
                vm.setAuthPhone(vm.loginDraft.phone);
              },
              className: "mt-3 w-full rounded-2xl bg-orange-50 px-4 py-3 text-xs font-black text-orange-600",
              children: "Ch\u01B0a c\xF3 t\xE0i kho\u1EA3n? T\u1EA1o t\xE0i kho\u1EA3n"
            }), /*#__PURE__*/_jsx("button", {
              onClick: () => {
                vm.setAccountEntryTab("forgot");
                vm.setResetDraft(draft => ({
                  ...draft,
                  phone: vm.loginDraft.phone
                }));
                vm.setResetStep("verify");
              },
              className: "mt-2 w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55",
              children: "Qu\xEAn m\u1EADt kh\u1EA9u?"
            })]
          }) : vm.accountEntryTab === "register" ? /*#__PURE__*/_jsxs("div", {
            className: "mt-4",
            children: [/*#__PURE__*/_jsx("h2", {
              className: "text-base font-black text-brown",
              children: "T\u1EA1o t\xE0i kho\u1EA3n"
            }), /*#__PURE__*/_jsx("p", {
              className: "mt-1 text-sm text-brown/60",
              children: "Nh\u1EADp s\u1ED1 \u0111i\u1EC7n tho\u1EA1i \u0111\u1EC3 t\u1EA1o t\xE0i kho\u1EA3n. N\u1EBFu s\u1ED1 n\xE0y \u0111\xE3 t\u1EEBng c\xF3 \u0111\u01A1n, app s\u1EBD y\xEAu c\u1EA7u m\xE3 \u0111\u01A1n g\u1EA7n nh\u1EA5t \u0111\u1EC3 x\xE1c minh."
            }), /*#__PURE__*/_jsxs("div", {
              className: "mt-3 space-y-3",
              children: [/*#__PURE__*/_jsx("input", {
                value: vm.authPhone,
                onChange: event => vm.setAuthPhone(event.target.value),
                placeholder: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), vm.authMode === "claimBlocked" ? /*#__PURE__*/_jsxs(_Fragment, {
                children: [/*#__PURE__*/_jsx("p", {
                  className: "rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700",
                  children: "S\u1ED1 n\xE0y \u0111\xE3 t\u1EEBng \u0111\u1EB7t h\xE0ng. B\u1EA1n nh\u1EADp m\xE3 \u0111\u01A1n g\u1EA7n nh\u1EA5t \u0111\u1EC3 x\xE1c minh \u0111\xFAng ch\u1EE7 s\u1ED1 \u0111i\u1EC7n tho\u1EA1i tr\u01B0\u1EDBc khi t\u1EA1o t\xE0i kho\u1EA3n."
                }), /*#__PURE__*/_jsxs("div", {
                  className: "flex overflow-hidden rounded-2xl border border-orange-100 bg-cream",
                  children: [/*#__PURE__*/_jsx("span", {
                    className: "grid place-items-center bg-white px-4 text-sm font-black text-orange-600",
                    children: "GHR-"
                  }), /*#__PURE__*/_jsx("input", {
                    value: vm.claimCode,
                    onChange: event => vm.setClaimCode(event.target.value.replace(/\D/g, "").slice(0, 4)),
                    inputMode: "numeric",
                    maxLength: 4,
                    placeholder: "1028",
                    className: "min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-black tracking-[0.25em] outline-none"
                  })]
                }), /*#__PURE__*/_jsx("button", {
                  onClick: vm.handleVerifyRecentOrder,
                  className: "w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange",
                  children: "X\xE1c minh m\xE3 \u0111\u01A1n"
                })]
              }) : null, /*#__PURE__*/_jsx("input", {
                value: vm.registerDraft.name,
                onChange: event => vm.setRegisterDraft(draft => ({
                  ...draft,
                  name: event.target.value
                })),
                placeholder: "T\xEAn hi\u1EC3n th\u1ECB",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("input", {
                type: "password",
                value: vm.registerDraft.password,
                onChange: event => vm.setRegisterDraft(draft => ({
                  ...draft,
                  password: event.target.value
                })),
                placeholder: "M\u1EADt kh\u1EA9u (\xEDt nh\u1EA5t 6 k\xFD t\u1EF1)",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("input", {
                type: "password",
                value: vm.registerDraft.confirmPassword,
                onChange: event => vm.setRegisterDraft(draft => ({
                  ...draft,
                  confirmPassword: event.target.value
                })),
                placeholder: "Nh\u1EADp l\u1EA1i m\u1EADt kh\u1EA9u",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("button", {
                onClick: vm.handleRegister,
                className: "w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange",
                children: "T\u1EA1o t\xE0i kho\u1EA3n"
              }), /*#__PURE__*/_jsx("button", {
                onClick: () => vm.setAccountEntryTab("login"),
                className: "w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55",
                children: "\u0110\xE3 c\xF3 t\xE0i kho\u1EA3n? \u0110\u0103ng nh\u1EADp"
              })]
            })]
          }) : /*#__PURE__*/_jsxs("div", {
            className: "mt-4",
            children: [/*#__PURE__*/_jsx("h2", {
              className: "text-base font-black text-brown",
              children: "\u0110\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u"
            }), /*#__PURE__*/_jsx("p", {
              className: "mt-1 text-sm text-brown/60",
              children: "X\xE1c minh b\u1EB1ng m\xE3 \u0111\u01A1n g\u1EA7n nh\u1EA5t \u0111\u1EC3 \u0111\u1EB7t m\u1EADt kh\u1EA9u m\u1EDBi."
            }), vm.resetStep === "verify" ? /*#__PURE__*/_jsxs("div", {
              className: "mt-3 space-y-3",
              children: [/*#__PURE__*/_jsx("input", {
                value: vm.resetDraft.phone,
                onChange: event => vm.setResetDraft(draft => ({
                  ...draft,
                  phone: event.target.value
                })),
                placeholder: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsxs("div", {
                className: "flex overflow-hidden rounded-2xl border border-orange-100 bg-cream",
                children: [/*#__PURE__*/_jsx("span", {
                  className: "grid place-items-center bg-white px-4 text-sm font-black text-orange-600",
                  children: "GHR-"
                }), /*#__PURE__*/_jsx("input", {
                  value: vm.resetDraft.code,
                  onChange: event => vm.setResetDraft(draft => ({
                    ...draft,
                    code: event.target.value.replace(/\D/g, "").slice(0, 4)
                  })),
                  inputMode: "numeric",
                  maxLength: 4,
                  placeholder: "1028",
                  className: "min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-black tracking-[0.25em] outline-none"
                })]
              }), /*#__PURE__*/_jsx("button", {
                onClick: vm.handleVerifyResetPassword,
                className: "w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange",
                children: "X\xE1c minh m\xE3 \u0111\u01A1n"
              })]
            }) : /*#__PURE__*/_jsxs("div", {
              className: "mt-3 space-y-3",
              children: [/*#__PURE__*/_jsx("input", {
                type: "password",
                value: vm.resetDraft.password,
                onChange: event => vm.setResetDraft(draft => ({
                  ...draft,
                  password: event.target.value
                })),
                placeholder: "M\u1EADt kh\u1EA9u m\u1EDBi",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("input", {
                type: "password",
                value: vm.resetDraft.confirmPassword,
                onChange: event => vm.setResetDraft(draft => ({
                  ...draft,
                  confirmPassword: event.target.value
                })),
                placeholder: "Nh\u1EADp l\u1EA1i m\u1EADt kh\u1EA9u m\u1EDBi",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("button", {
                onClick: vm.handleUpdatePasswordFromOrder,
                className: "w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange",
                children: "C\u1EADp nh\u1EADt m\u1EADt kh\u1EA9u"
              })]
            })]
          })]
        }), vm.accountEntryTab === "lookup" && /*#__PURE__*/_jsxs(_Fragment, {
          children: [vm.authNotice ? /*#__PURE__*/_jsx("div", {
            className: "rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700",
            children: vm.authNotice
          }) : null, vm.lookupPhone ? /*#__PURE__*/_jsx(AccountPanel, {
            title: "L\u1ECBch s\u1EED \u0111\u01A1n theo s\u1ED1 \u0111i\u1EC7n tho\u1EA1i",
            children: /*#__PURE__*/_jsxs("div", {
              className: "space-y-3",
              children: [/*#__PURE__*/_jsxs("div", {
                className: "rounded-[22px] bg-cream/60 p-3 text-sm font-bold text-brown/65",
                children: [vm.lookupPhone, " \xB7 ", vm.isLookupLoading ? "Đang tra cứu..." : lookupStats.totalOrders ? `${lookupStats.totalOrders} đơn · ${formatMoney(lookupStats.totalSpent)}` : "Chưa có đơn hàng"]
              }), vm.lookupOrders.slice(0, 5).map(order => /*#__PURE__*/_jsxs("div", {
                className: "rounded-[22px] border border-orange-100 bg-cream/50 p-3 text-sm",
                children: [/*#__PURE__*/_jsxs("div", {
                  className: "flex items-start justify-between gap-3",
                  children: [/*#__PURE__*/_jsxs("div", {
                    children: [/*#__PURE__*/_jsx("strong", {
                      children: String(order.orderCode || "GHR-****").replace(/GHR-\d{4}/, "GHR-****")
                    }), /*#__PURE__*/_jsx("p", {
                      className: "mt-1 text-brown/55",
                      children: new Date(order.createdAt).toLocaleString("vi-VN")
                    })]
                  }), /*#__PURE__*/_jsx("strong", {
                    className: "text-orange-600",
                    children: formatMoney(order.totalAmount || order.total || 0)
                  })]
                }), /*#__PURE__*/_jsxs("p", {
                  className: "mt-2 text-xs text-brown/45",
                  children: [(order.items || []).length, " m\xF3n \xB7 \u0110\u1ECBa ch\u1EC9 \u0111\xE3 \u0111\u01B0\u1EE3c \u1EA9n"]
                })]
              }, order.id || order.orderCode))]
            })
          }) : null, vm.lookupPhone && vm.authMode === "login" ? /*#__PURE__*/_jsx(AccountPanel, {
            title: "\u0110\u0103ng nh\u1EADp t\xE0i kho\u1EA3n",
            children: /*#__PURE__*/_jsxs("div", {
              className: "space-y-3",
              children: [/*#__PURE__*/_jsx("input", {
                type: "password",
                value: vm.authPassword,
                onChange: event => vm.setAuthPassword(event.target.value),
                placeholder: "Nh\u1EADp m\u1EADt kh\u1EA9u",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("button", {
                onClick: vm.handlePasswordLogin,
                className: "w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange",
                children: "\u0110\u0103ng nh\u1EADp"
              })]
            })
          }) : null, vm.lookupPhone && vm.authMode === "claimBlocked" ? /*#__PURE__*/_jsx(AccountPanel, {
            title: "X\xE1c minh \u0111\u1EC3 t\u1EA1o t\xE0i kho\u1EA3n",
            children: /*#__PURE__*/_jsxs("div", {
              className: "space-y-3",
              children: [/*#__PURE__*/_jsx("p", {
                className: "text-sm text-brown/60",
                children: "S\u1ED1 n\xE0y \u0111\xE3 t\u1EEBng \u0111\u1EB7t h\xE0ng, b\u1EA1n c\u1EA7n m\xE3 \u0111\u01A1n g\u1EA7n nh\u1EA5t \u0111\u1EC3 m\u1EDF \u0111\u0103ng k\xFD."
              }), /*#__PURE__*/_jsxs("div", {
                className: "flex overflow-hidden rounded-2xl border border-orange-100 bg-cream",
                children: [/*#__PURE__*/_jsx("span", {
                  className: "grid place-items-center bg-white px-4 text-sm font-black text-orange-600",
                  children: "GHR-"
                }), /*#__PURE__*/_jsx("input", {
                  value: vm.claimCode,
                  onChange: event => vm.setClaimCode(event.target.value.replace(/\D/g, "").slice(0, 4)),
                  inputMode: "numeric",
                  maxLength: 4,
                  placeholder: "1028",
                  className: "min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-black tracking-[0.25em] outline-none"
                })]
              }), /*#__PURE__*/_jsx("button", {
                onClick: vm.handleVerifyRecentOrder,
                className: "w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange",
                children: "X\xE1c minh m\xE3 \u0111\u01A1n"
              })]
            })
          }) : null, vm.lookupPhone && vm.authMode === "register" ? /*#__PURE__*/_jsx(AccountPanel, {
            title: "T\u1EA1o t\xE0i kho\u1EA3n",
            children: /*#__PURE__*/_jsxs("div", {
              className: "space-y-3",
              children: [/*#__PURE__*/_jsx("input", {
                value: vm.registerDraft.name,
                onChange: event => vm.setRegisterDraft(draft => ({
                  ...draft,
                  name: event.target.value
                })),
                placeholder: "T\xEAn hi\u1EC3n th\u1ECB",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("input", {
                type: "password",
                value: vm.registerDraft.password,
                onChange: event => vm.setRegisterDraft(draft => ({
                  ...draft,
                  password: event.target.value
                })),
                placeholder: "M\u1EADt kh\u1EA9u (\xEDt nh\u1EA5t 6 k\xFD t\u1EF1)",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("input", {
                type: "password",
                value: vm.registerDraft.confirmPassword,
                onChange: event => vm.setRegisterDraft(draft => ({
                  ...draft,
                  confirmPassword: event.target.value
                })),
                placeholder: "Nh\u1EADp l\u1EA1i m\u1EADt kh\u1EA9u",
                className: "w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none"
              }), /*#__PURE__*/_jsx("button", {
                onClick: vm.handleRegister,
                className: "w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange",
                children: "T\u1EA1o t\xE0i kho\u1EA3n"
              })]
            })
          }) : null]
        })]
      }), /*#__PURE__*/_jsx(FlaticonCredit, {}), /*#__PURE__*/_jsx(AccountNoticeModal, {
        notice: vm.accountNotice,
        onClose: () => vm.setAccountNotice(null)
      })]
    });
  }
  return /*#__PURE__*/_jsxs("section", {
    children: [/*#__PURE__*/_jsx(AppHeader, {
      title: "T\xE0i kho\u1EA3n",
      right: /*#__PURE__*/_jsx("button", {
        className: "top-icon",
        children: /*#__PURE__*/_jsx(Icon, {
          name: "bell",
          size: 18
        })
      })
    }), /*#__PURE__*/_jsxs("div", {
      className: "space-y-4 px-4",
      children: [vm.authNotice ? /*#__PURE__*/_jsx("div", {
        className: "rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700",
        children: vm.authNotice
      }) : null, /*#__PURE__*/_jsxs("div", {
        className: "account-hero",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "flex items-center gap-4",
          children: [vm.accountUser.avatarUrl ? /*#__PURE__*/_jsx("img", {
            src: vm.accountUser.avatarUrl,
            alt: vm.displayName,
            className: "h-20 w-20 rounded-full border-4 border-white/70 object-cover shadow-soft"
          }) : /*#__PURE__*/_jsx("span", {
            className: "grid h-20 w-20 place-items-center rounded-full border-4 border-white/70 bg-white text-orange-600 shadow-soft",
            children: /*#__PURE__*/_jsx(Icon, {
              name: "star",
              size: 28
            })
          }), /*#__PURE__*/_jsxs("div", {
            className: "min-w-0 flex-1",
            children: [/*#__PURE__*/_jsx("h2", {
              className: "text-xl font-black text-white",
              children: vm.displayName
            }), /*#__PURE__*/_jsx("p", {
              className: "mt-1 text-sm font-bold text-white/82",
              children: vm.accountUser.phone
            }), vm.showCustomerTier ? /*#__PURE__*/_jsx("p", {
              className: "mt-1 text-sm font-bold text-white/82",
              children: vm.rank
            }) : null]
          })]
        }), /*#__PURE__*/_jsx("button", {
          onClick: () => vm.setProfileOpen(true),
          className: "mt-5 w-full rounded-[20px] bg-white px-4 py-4 text-sm font-black text-orange-600 shadow-soft",
          children: "Ch\u1EC9nh s\u1EEDa h\u1ED3 s\u01A1"
        })]
      }), /*#__PURE__*/_jsx(AccountPanel, {
        title: "\u0110\u1ECBa ch\u1EC9 giao h\xE0ng",
        action: "Th\xEAm \u0111\u1ECBa ch\u1EC9 m\u1EDBi",
        onAction: () => vm.setAddressModal({
          receiverName: vm.displayName,
          phone: currentPhone,
          isDefault: vm.addresses.length === 0
        }),
        children: /*#__PURE__*/_jsxs("div", {
          className: "space-y-3",
          children: [vm.visibleAddresses.map(address => /*#__PURE__*/_jsx(AddressCard, {
            address: address,
            onEdit: () => vm.setAddressModal(address),
            onDelete: () => vm.handleDeleteAddress(address.id),
            onSetDefault: () => vm.handleSetDefaultAddress(address.id)
          }, address.id)), !vm.addresses.length ? /*#__PURE__*/_jsx(AppEmptyState, {
            icon: null,
            message: "B\u1EA1n ch\u01B0a c\xF3 \u0111\u1ECBa ch\u1EC9 giao h\xE0ng",
            className: "rounded-[22px] border border-orange-100 bg-cream/50 p-3 text-sm text-brown/55"
          }) : null]
        })
      }), /*#__PURE__*/_jsxs("div", {
        className: "grid grid-cols-2 gap-3",
        children: [/*#__PURE__*/_jsxs("button", {
          onClick: () => vm.navigateToTab("orders"),
          className: "account-metric",
          children: [/*#__PURE__*/_jsx("span", {
            className: "grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-orange-600",
            children: /*#__PURE__*/_jsx(Icon, {
              name: "bag",
              size: 19
            })
          }), /*#__PURE__*/_jsx("strong", {
            children: "L\u1ECBch s\u1EED \u0111\u01A1n h\xE0ng"
          }), /*#__PURE__*/_jsx("small", {
            children: vm.stats.totalOrders ? `${vm.stats.totalOrders} đơn · ${formatMoney(vm.stats.totalSpent)}` : "Chưa có đơn hàng"
          })]
        }), /*#__PURE__*/_jsxs("button", {
          onClick: () => vm.navigateToTab("rewards"),
          className: "account-metric",
          children: [/*#__PURE__*/_jsx("span", {
            className: "grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-orange-600",
            children: /*#__PURE__*/_jsx(Icon, {
              name: "star",
              size: 19
            })
          }), /*#__PURE__*/_jsx("strong", {
            children: vm.showCustomerTier ? "Điểm thưởng & Hạng" : "Điểm thưởng"
          }), /*#__PURE__*/_jsxs("small", {
            children: [demoLoyalty.totalPoints || 0, " \u0111i\u1EC3m", vm.showCustomerTier ? ` · ${vm.rank}` : ""]
          })]
        })]
      }), /*#__PURE__*/_jsx(AccountPanel, {
        title: "\u0110\u01A1n g\u1EA7n nh\u1EA5t",
        children: vm.stats.latestOrder ? /*#__PURE__*/_jsxs("div", {
          className: "rounded-[22px] border border-orange-100 bg-cream/50 p-3 text-sm",
          children: [/*#__PURE__*/_jsx("strong", {
            children: vm.stats.latestOrder.orderCode
          }), /*#__PURE__*/_jsxs("p", {
            className: "mt-1 text-brown/60",
            children: [new Date(vm.stats.latestOrder.createdAt).toLocaleString("vi-VN"), " \xB7 ", formatMoney(vm.stats.latestOrder.totalAmount)]
          }), /*#__PURE__*/_jsx("button", {
            onClick: () => vm.navigateToTab("orders"),
            className: "mt-3 rounded-2xl bg-orange-50 px-4 py-2 text-xs font-black text-orange-600",
            children: "Xem l\u1ECBch s\u1EED \u0111\u01A1n"
          })]
        }) : /*#__PURE__*/_jsx(AppEmptyState, {
          icon: null,
          message: "Ch\u01B0a c\xF3 \u0111\u01A1n h\xE0ng",
          className: "rounded-[22px] border border-orange-100 bg-cream/50 p-3 text-sm text-brown/55"
        })
      }), /*#__PURE__*/_jsx(AccountPanel, {
        title: "C\xE0i \u0111\u1EB7t th\xF4ng b\xE1o",
        children: /*#__PURE__*/_jsxs("div", {
          className: "space-y-3",
          children: [/*#__PURE__*/_jsx(SettingsToggle, {
            label: "C\u1EADp nh\u1EADt \u0111\u01A1n h\xE0ng",
            checked: true
          }), /*#__PURE__*/_jsx(SettingsToggle, {
            label: "Khuy\u1EBFn m\xE3i & \u01AFu \u0111\xE3i",
            checked: true
          }), /*#__PURE__*/_jsx(SettingsToggle, {
            label: "Tin t\u1EE9c m\u1EDBi"
          })]
        })
      }), /*#__PURE__*/_jsx("button", {
        onClick: logoutDemoUser,
        className: "w-full rounded-[24px] bg-red-50 py-4 text-sm font-black text-red-600 shadow-soft",
        children: "\u0110\u0103ng xu\u1EA5t"
      })]
    }), /*#__PURE__*/_jsx(FlaticonCredit, {}), vm.profileOpen ? /*#__PURE__*/_jsx(ProfileModal, {
      user: vm.accountUser,
      onClose: () => vm.setProfileOpen(false),
      onSave: vm.handleSaveUser
    }) : null, vm.addressModal ? /*#__PURE__*/_jsx(AccountAddressModal, {
      address: vm.addressModal,
      onClose: () => vm.setAddressModal(null),
      onSave: vm.handleSaveAddress
    }) : null, /*#__PURE__*/_jsx(AccountNoticeModal, {
      notice: vm.accountNotice,
      onClose: () => vm.setAccountNotice(null)
    })]
  });
}