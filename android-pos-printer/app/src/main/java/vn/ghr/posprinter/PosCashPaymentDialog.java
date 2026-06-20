package vn.ghr.posprinter;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.graphics.Color;
import android.text.InputType;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

final class PosCashPaymentDialog {
    interface Listener {
        void onConfirm(int receivedAmount);
    }

    private PosCashPaymentDialog() {
    }

    static void show(Activity activity, int total, int initialReceivedAmount, Listener listener) {
        LinearLayout panel = new LinearLayout(activity);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(PosViewFactory.dp(activity, 4), PosViewFactory.dp(activity, 8), PosViewFactory.dp(activity, 4), 0);

        TextView totalText = PosViewFactory.makeInfoText(activity, "Tổng cần thu: " + formatMoney(total), Color.rgb(15, 118, 110));
        panel.addView(totalText, PosViewFactory.fullWidthParams(activity));

        EditText cashInput = PosViewFactory.makeInput(activity, "Tiền khách đưa");
        cashInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        cashInput.setText(String.valueOf(Math.max(total, initialReceivedAmount)));
        panel.addView(cashInput, PosViewFactory.fullWidthParams(activity));

        LinearLayout suggestionRow = new LinearLayout(activity);
        suggestionRow.setOrientation(LinearLayout.HORIZONTAL);
        int[] suggestions = new int[]{50000, 100000, 200000, 500000};
        for (int i = 0; i < suggestions.length; i++) {
            int value = suggestions[i];
            Button button = PosViewFactory.makeButton(activity, formatMoney(value), false);
            button.setOnClickListener(view -> cashInput.setText(String.valueOf(value)));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, PosViewFactory.dp(activity, 52), 1f);
            if (i < suggestions.length - 1) params.setMargins(0, 0, PosViewFactory.dp(activity, 6), 0);
            suggestionRow.addView(button, params);
        }
        panel.addView(suggestionRow, PosViewFactory.fullWidthParams(activity));

        TextView changeText = PosViewFactory.makeInfoText(activity, "Tiền thối: 0đ", Color.rgb(71, 85, 105));
        panel.addView(changeText, PosViewFactory.fullWidthParams(activity));

        AlertDialog dialog = new AlertDialog.Builder(activity)
                .setTitle("Thanh toán tiền mặt")
                .setView(panel)
                .setNegativeButton("Hủy", null)
                .setPositiveButton("Xác nhận", null)
                .create();

        dialog.setOnShowListener(item -> dialog.getButton(DialogInterface.BUTTON_POSITIVE).setOnClickListener(view -> {
            int received = parseMoney(cashInput.getText().toString());
            int change = received - total;
            changeText.setText("Tiền thối: " + formatMoney(Math.max(0, change)));
            if (received < total) {
                changeText.setTextColor(Color.rgb(185, 28, 28));
                return;
            }
            listener.onConfirm(received);
            dialog.dismiss();
        }));

        dialog.show();
    }

    private static int parseMoney(String value) {
        try {
            String digits = String.valueOf(value == null ? "" : value).replaceAll("[^0-9]", "");
            if (digits.isEmpty()) return 0;
            return Math.max(0, Integer.parseInt(digits));
        } catch (Exception error) {
            return 0;
        }
    }

    private static String formatMoney(int amount) {
        return String.format(new java.util.Locale("vi", "VN"), "%,dđ", Math.max(0, amount));
    }
}
