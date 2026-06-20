package vn.ghr.posprinter;

import android.app.Activity;
import android.app.AlertDialog;

final class PosCreateOrderConfirmDialog {
    private PosCreateOrderConfirmDialog() {
    }

    static void show(Activity activity, String summary, Runnable onConfirm) {
        new AlertDialog.Builder(activity)
                .setTitle("Xác nhận tạo đơn")
                .setMessage(summary)
                .setNegativeButton("Quay lại", null)
                .setPositiveButton("Tạo đơn + in bill", (dialog, which) -> onConfirm.run())
                .show();
    }
}
