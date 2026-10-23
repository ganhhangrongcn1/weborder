import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { initializeMiniApp } from "./services/miniAppRuntime.js";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="attendance-loading"><h1>Chưa mở được ứng dụng.</h1><p>Vui lòng tải lại trang. Dữ liệu đã lưu vẫn được giữ trong trình duyệt.</p><button onClick={() => window.location.reload()}>Tải lại</button></main> : this.props.children;
  }
}
async function bootstrap() {
  const root = createRoot(document.getElementById("app"));
  try {
    await initializeMiniApp();
    root.render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
  } catch {
    root.render(<main className="attendance-loading"><h1>Chưa khởi tạo được ứng dụng</h1><p>Vui lòng kiểm tra phiên bản Zalo và mở lại ứng dụng.</p><button onClick={() => window.location.reload()}>Thử lại</button></main>);
  }
}
bootstrap();
