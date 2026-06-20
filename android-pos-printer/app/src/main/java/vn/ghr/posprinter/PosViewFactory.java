package vn.ghr.posprinter;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

final class PosViewFactory {
    private PosViewFactory() {
    }

    static Button makeButton(Context context, String label, boolean primary) {
        Button button = new Button(context);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(16);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setTextColor(primary ? Color.WHITE : Color.rgb(15, 23, 42));
        button.setMinHeight(dp(context, 58));
        button.setBackground(makeRoundRect(
                primary ? Color.rgb(20, 184, 166) : Color.WHITE,
                dp(context, 8),
                dp(context, 1),
                primary ? Color.rgb(15, 118, 110) : Color.rgb(203, 213, 225)
        ));
        return button;
    }

    static EditText makeInput(Context context, String hint) {
        EditText input = new EditText(context);
        input.setSingleLine(true);
        input.setHint(hint);
        input.setTextSize(18);
        input.setMinHeight(dp(context, 62));
        input.setPadding(dp(context, 14), 0, dp(context, 14), 0);
        input.setBackground(makeRoundRect(Color.WHITE, dp(context, 8), dp(context, 1), Color.rgb(203, 213, 225)));
        return input;
    }

    static TextView makeSectionTitle(Context context, String text) {
        TextView title = new TextView(context);
        title.setText(text);
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setTextSize(15);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(0, dp(context, 18), 0, dp(context, 8));
        return title;
    }

    static TextView makeInfoText(Context context, String text, int color) {
        TextView view = new TextView(context);
        view.setText(text);
        view.setTextColor(color);
        view.setTextSize(13);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setPadding(dp(context, 12), dp(context, 8), dp(context, 12), dp(context, 8));
        view.setBackground(makeRoundRect(Color.WHITE, dp(context, 8), dp(context, 1), Color.rgb(226, 232, 240)));
        return view;
    }

    static LinearLayout.LayoutParams fullWidthParams(Context context) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(context, 8));
        return params;
    }

    static LinearLayout.LayoutParams tallButtonParams(Context context) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(context, 58)
        );
        params.setMargins(0, 0, 0, dp(context, 8));
        return params;
    }

    static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    private static GradientDrawable makeRoundRect(int color, int radiusPx, int strokeWidthPx, int strokeColor) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radiusPx);
        if (strokeWidthPx > 0) drawable.setStroke(strokeWidthPx, strokeColor);
        return drawable;
    }
}
