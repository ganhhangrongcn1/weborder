import { CustomerLoadingState } from "../customer/CustomerUI.jsx";

export default function LoadingState({
  label = "Đang tải...",
  className = ""
}) {
  return <CustomerLoadingState title={label} message="" className={className} />;
}
