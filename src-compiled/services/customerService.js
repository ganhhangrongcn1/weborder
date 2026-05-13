import { customerRepository } from "./repositories/customerRepository.js";

export function createUserStorage({ getCustomerKey, defaultUserDemo }) {
  let legacyUserIndex = null;
  let legacySingleUser = null;

  function getLegacyUsersIndex() {
    if (legacyUserIndex) return legacyUserIndex;
    const legacyUsers = customerRepository.getLegacyUsers([]);
    const legacyList = Array.isArray(legacyUsers) ? legacyUsers : Object.values(legacyUsers || {});
    legacyUserIndex = legacyList.reduce((acc, user) => {
      const key = getCustomerKey(user?.phone);
      if (key) acc[key] = user;
      return acc;
    }, {});
    return legacyUserIndex;
  }

  function getLegacySingle() {
    if (legacySingleUser !== null) return legacySingleUser;
    legacySingleUser = customerRepository.getLegacyUser(null);
    return legacySingleUser;
  }

  return {
    getAll() {
      return customerRepository.getUsers();
    },
    saveAll(users) {
      const normalized = Array.isArray(users)
        ? users.reduce(
            (map, user) => ({
              ...map,
              [getCustomerKey(user.phone)]: user
            }),
            {}
          )
        : users;
      return customerRepository.saveUsers(normalized);
    },
    findByPhone(phone) {
      const key = getCustomerKey(phone);
      const users = customerRepository.getUsers();
      if (users[key]) return users[key];
      const legacyUser = getLegacyUsersIndex()[key];
      if (legacyUser) {
        return this.upsertUser({
          ...legacyUser,
          phone: key,
          registered: Boolean(legacyUser.registered || legacyUser.passwordDemo)
        });
      }
      const singleLegacyUser = getLegacySingle();
      if (singleLegacyUser && getCustomerKey(singleLegacyUser.phone) === key) {
        return this.upsertUser({
          ...singleLegacyUser,
          phone: key,
          registered: Boolean(singleLegacyUser.registered || singleLegacyUser.passwordDemo)
        });
      }
      return null;
    },
    upsertUser(user) {
      const now = new Date().toISOString();
      const key = getCustomerKey(user.phone);
      const users = customerRepository.getUsers();
      const existing = users[key];
      const mergedCandidate = {
        ...defaultUserDemo,
        ...existing,
        ...user,
        phone: key,
        createdAt: existing?.createdAt || user.createdAt || now
      };
      if (existing) {
        const hasMeaningfulChange = [
          "name",
          "email",
          "avatarUrl",
          "passwordDemo",
          "registered",
          "totalOrders",
          "totalSpent",
          "memberRank"
        ].some((field) => String(existing?.[field] ?? "") !== String(mergedCandidate?.[field] ?? ""));
        if (!hasMeaningfulChange) {
          return existing;
        }
      }
      const nextUser = {
        ...mergedCandidate,
        updatedAt: now
      };
      this.saveAll({
        ...users,
        [key]: nextUser
      });
      return nextUser;
    },
    get() {
      const phone = customerRepository.getCurrentPhone();
      return phone ? this.findByPhone(phone) || { ...defaultUserDemo, phone } : defaultUserDemo;
    },
    save(user) {
      return this.upsertUser(user);
    },
    saveCurrentPhone(phone) {
      return customerRepository.saveCurrentPhone(phone);
    },
    clearCurrentPhone() {
      return customerRepository.clearCurrentPhone();
    },
    getCurrentPhone() {
      return customerRepository.getCurrentPhone();
    },
    async hydrateFromRemote() {
      return customerRepository.hydrateUsersFromRemote();
    }
  };
}

export function isRegisteredUser(user) {
  return Boolean(user?.registered);
}

export function getCurrentRegisteredPhone({ userStorage }) {
  const phone = userStorage.getCurrentPhone?.() || customerRepository.getCurrentPhone();
  const user = phone ? userStorage.findByPhone(phone) : null;
  if (isRegisteredUser(user)) return phone;
  // In Supabase mode, local users cache may not be hydrated yet on first load.
  // Keep current phone and let runtime hydration resolve profile/registration.
  if (phone && !user) return phone;
  if (phone) userStorage.clearCurrentPhone?.();
  return "";
}

export function initDemoData({ getCurrentRegisteredPhone, userStorage, defaultUserDemo, addressStorage, loyaltyByPhoneStorage, defaultLoyaltyData, orderStorage }) {
  const now = new Date().toISOString();
  const currentPhone = getCurrentRegisteredPhone();
  const normalizedUser = currentPhone
    ? userStorage.findByPhone(currentPhone) ||
      userStorage.upsertUser({
        ...defaultUserDemo,
        phone: currentPhone,
        createdAt: now,
        updatedAt: now
      })
    : defaultUserDemo;
  return {
    user: normalizedUser,
    addresses: currentPhone ? addressStorage.getAll(currentPhone) : [],
    loyalty: currentPhone ? loyaltyByPhoneStorage.getByPhone(currentPhone) : defaultLoyaltyData,
    orders: currentPhone ? orderStorage.getByPhone(currentPhone) : []
  };
}

export function updateUserProfile(user, patch, userStorage) {
  return userStorage.save({
    ...user,
    ...patch
  });
}
