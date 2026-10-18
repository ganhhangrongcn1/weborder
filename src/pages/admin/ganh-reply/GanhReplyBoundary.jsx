import { Component } from 'react';
import { AdminButton, AdminCard } from '../ui/AdminCommon.jsx';

export default class GanhReplyBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <AdminCard><h2>Gánh Reply chưa mở được</h2><p>Anh/chị có thể mở mục quản trị khác hoặc tải lại trang để thử lại.</p><AdminButton onClick={() => window.location.reload()}>Tải lại trang</AdminButton></AdminCard>;
    }
    return this.props.children;
  }
}
