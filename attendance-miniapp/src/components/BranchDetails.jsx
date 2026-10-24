import BranchLinks from "./BranchLinks.jsx";
import ContactActions from "./ContactActions.jsx";
import { DEMO_BRANCH } from "../data/demo.js";
export default function BranchDetails({ navigation }) {
  const exists = navigation.branch === DEMO_BRANCH.id;
  return <section className="card"><h2>{exists ? DEMO_BRANCH.name : "Chưa tìm thấy chi nhánh"}</h2><p>{exists ? DEMO_BRANCH.address : "Liên kết chưa có chi nhánh tương ứng trong bản trải nghiệm. Vui lòng kiểm tra lại đường dẫn."}</p><p>Liên kết chỉ mở thông tin; không thay đổi nơi được phân công hoặc quyền chấm công.</p>{exists && <BranchLinks key={navigation.branch + "-links"} branchId={navigation.branch}/>}{exists && <ContactActions key={navigation.branch} branchId={navigation.branch}/>}<button onClick={() => navigation.navigate("checkin")}>Về chấm công</button></section>;
}
