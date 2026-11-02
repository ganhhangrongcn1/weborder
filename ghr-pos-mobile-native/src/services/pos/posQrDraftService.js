import AsyncStorage from "@react-native-async-storage/async-storage";
import { createPosOrderIdentity } from "../../shared/pos/posOrderIdentity";

// Persist before the first network write. An unchanged bill reuses its identity
// after timeout, app closure or a manual retry, rather than making a second bill.
export async function getPosQrDraftIdentity({ branchUuid, fingerprint, recover }) {
  const key = `ghr_pos_qr_draft_${branchUuid}`;
  let previous;
  try { previous = JSON.parse(await AsyncStorage.getItem(key) || "null"); } catch { previous = null; }
  if (previous?.fingerprint === fingerprint && previous.identity?.orderCode) return previous.identity;
  if (previous?.identity?.orderCode) {
    const requestKey = `pos:sepay:${branchUuid}:${previous.identity.orderCode}`;
    const result = await recover(requestKey);
    if (!result.ok || (result.session && !["cancelled", "expired", "failed", "converted"].includes(result.session.status))) {
      throw new Error("Bill QR trước chưa kết thúc. Anh/chị mở Lịch sử để tiếp tục hoặc hủy QR trước khi tạo bill khác.");
    }
  }
  const identity = createPosOrderIdentity(new Date());
  await AsyncStorage.setItem(key, JSON.stringify({ fingerprint, identity }));
  return identity;
}

export async function forgetPosQrDraft(branchUuid, reference = "") {
  if (!branchUuid) return;
  const key = `ghr_pos_qr_draft_${branchUuid}`;
  if (reference) {
    const saved = JSON.parse(await AsyncStorage.getItem(key) || "null");
    if (saved?.identity?.orderCode !== reference) return;
  }
  await AsyncStorage.removeItem(key);
}
