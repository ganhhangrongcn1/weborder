import { Component } from "react";
import AdminAuthGate from "./AdminAuthGate.jsx";

export default class AdminAppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[admin][render] Giao diện Admin gặp lỗi.", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <AdminAuthGate
          mode="error"
          onRetry={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}
