import { useState } from "react";
import { BRANCH_CONTACTS } from "../constants/contactConfig.js";
import { phoneHref, zaloHref } from "../services/navigationService.js";
export default function ContactActions({ branchId }) {
  const [message, setMessage] = useState("");
  const contact = BRANCH_CONTACTS[branchId] || {};
  const phone = phoneHref(contact.phone);
  const zalo = zaloHref(contact.zaloUrl);
  return <div className="contact-actions"><h3>Liên hệ cửa hàng</h3><div className="button-row">
    {phone ? <a className="file-link" href={phone}>Gọi điện thoại</a> : <button onClick={() => setMessage("Chưa cấu hình số điện thoại cửa hàng.")}>Gọi điện thoại</button>}
    {zalo ? <a className="file-link" href={zalo} target="_blank" rel="noopener noreferrer">Liên hệ Zalo</a> : <button onClick={() => setMessage("Chưa cấu hình liên kết Zalo của cửa hàng.")}>Liên hệ Zalo</button>}
    </div>{message && <p role="status">{message}</p>}<p className="small">Liên hệ Zalo mở trang trò chuyện; bạn chủ động chọn gọi trong Zalo.</p></div>;
}
