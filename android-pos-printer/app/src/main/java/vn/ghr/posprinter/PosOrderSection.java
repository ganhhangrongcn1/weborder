package vn.ghr.posprinter;

import android.app.Activity;
import android.graphics.Color;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

final class PosOrderSection {
    interface Listener {
        void onRefreshMenu();
        void onClearCart();
        void onCashPayment();
        void onCreateOrder();
    }

    static final class Refs {
        TextView menuStatusText;
        LinearLayout productListPanel;
        EditText pagerNumberInput;
        EditText customerNameInput;
        EditText orderNoteInput;
        TextView cartSummaryText;
        LinearLayout cartListPanel;
        TextView paymentStateText;
        Button createOrderButton;
    }

    private PosOrderSection() {
    }

    static Refs build(Activity activity, LinearLayout parent, Listener listener) {
        Refs refs = new Refs();

        parent.addView(PosViewFactory.makeSectionTitle(activity, "Món bán nhanh"));

        refs.menuStatusText = PosViewFactory.makeInfoText(activity, "Chưa tải menu POS.", Color.rgb(71, 85, 105));
        parent.addView(refs.menuStatusText, PosViewFactory.fullWidthParams(activity));

        Button refreshMenuButton = PosViewFactory.makeButton(activity, "Tải menu POS", false);
        refreshMenuButton.setOnClickListener(view -> listener.onRefreshMenu());
        parent.addView(refreshMenuButton, PosViewFactory.tallButtonParams(activity));

        refs.productListPanel = new LinearLayout(activity);
        refs.productListPanel.setOrientation(LinearLayout.VERTICAL);
        parent.addView(refs.productListPanel, PosViewFactory.fullWidthParams(activity));

        parent.addView(PosViewFactory.makeSectionTitle(activity, "Bill hiện tại"));

        refs.pagerNumberInput = PosViewFactory.makeInput(activity, "Thẻ rung");
        refs.pagerNumberInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        parent.addView(refs.pagerNumberInput, PosViewFactory.fullWidthParams(activity));

        refs.customerNameInput = PosViewFactory.makeInput(activity, "Tên khách (không bắt buộc)");
        refs.customerNameInput.setInputType(InputType.TYPE_CLASS_TEXT);
        parent.addView(refs.customerNameInput, PosViewFactory.fullWidthParams(activity));

        refs.orderNoteInput = PosViewFactory.makeInput(activity, "Ghi chú đơn (không bắt buộc)");
        refs.orderNoteInput.setInputType(InputType.TYPE_CLASS_TEXT);
        parent.addView(refs.orderNoteInput, PosViewFactory.fullWidthParams(activity));

        refs.cartSummaryText = PosViewFactory.makeInfoText(activity, "Chưa có món.", Color.rgb(71, 85, 105));
        parent.addView(refs.cartSummaryText, PosViewFactory.fullWidthParams(activity));

        refs.cartListPanel = new LinearLayout(activity);
        refs.cartListPanel.setOrientation(LinearLayout.VERTICAL);
        parent.addView(refs.cartListPanel, PosViewFactory.fullWidthParams(activity));

        refs.paymentStateText = PosViewFactory.makeInfoText(activity, "Chưa xác nhận thanh toán.", Color.rgb(71, 85, 105));
        parent.addView(refs.paymentStateText, PosViewFactory.fullWidthParams(activity));

        Button clearCartButton = PosViewFactory.makeButton(activity, "Xóa bill", false);
        clearCartButton.setOnClickListener(view -> listener.onClearCart());
        parent.addView(clearCartButton, PosViewFactory.tallButtonParams(activity));

        Button cashPaymentButton = PosViewFactory.makeButton(activity, "Xác nhận tiền mặt", true);
        cashPaymentButton.setOnClickListener(view -> listener.onCashPayment());
        parent.addView(cashPaymentButton, PosViewFactory.tallButtonParams(activity));

        refs.createOrderButton = PosViewFactory.makeButton(activity, "Tạo đơn + in bill", false);
        refs.createOrderButton.setOnClickListener(view -> listener.onCreateOrder());
        parent.addView(refs.createOrderButton, PosViewFactory.tallButtonParams(activity));

        return refs;
    }
}
