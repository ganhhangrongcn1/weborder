import { useState } from "react";
import { BRANCH_CONTACTS } from "../constants/contactConfig.js";
import { externalHref } from "../services/navigationService.js";

export default function BranchLinks({ branchId }) {
  const [message, setMessage] = useState("");
  const config = BRANCH_CONTACTS[branchId] || {};
  const map = externalHref(config.mapUrl);
  return <section><h3>Đường dẫn chi nhánh</h3><div className="button-row">
    {map ? <a className="file-link" href={map} target="_blank" rel="noopener noreferrer">Mở Google Maps ↗</a> : <button onClick={() => setMessage("Chi nhánh chưa cấu hình đường dẫn Google Maps.")}>Mở Google Maps ↗</button>}
    {(config.externalLinks || []).map((link, index) => {
      const href = externalHref(link.url);
      return href && link.label ? <a key={index} className="file-link" href={href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a> : null;
    })}
  </div>{message && <p role="status">{message}</p>}<p className="small">Đường dẫn mở trang bên ngoài, giữ lại trang chấm công.</p></section>;
}
