package vn.ghr.posprinter;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

final class PosOrderHelper {
    private PosOrderHelper() {
    }

    static int getCartTotal(JSONArray cart) {
        int total = 0;
        for (int i = 0; i < cart.length(); i++) {
            JSONObject item = cart.optJSONObject(i);
            if (item == null) continue;
            int quantity = Math.max(1, item.optInt("quantity", 1));
            int price = Math.max(0, item.optInt("price", 0));
            total += quantity * price;
        }
        return Math.max(0, total);
    }

    static String buildPosOrderCode() {
        String time = new SimpleDateFormat("yyMMddHHmmss", Locale.US).format(new Date());
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 4).toUpperCase(Locale.US);
        return "POS-" + time + "-" + suffix;
    }

    static String buildShortDisplayOrderCode(String orderCode) {
        String clean = String.valueOf(orderCode == null ? "" : orderCode).replace("-", "");
        if (clean.length() <= 6) return clean.isEmpty() ? "POS" : clean;
        return "P" + clean.substring(clean.length() - 5);
    }

    static String buildIsoUtcNow() {
        SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
        return isoFormat.format(new Date());
    }

    static JSONArray buildCashOrderItemRows(String orderCode, JSONArray cartSnapshot) throws Exception {
        JSONArray rows = new JSONArray();
        for (int i = 0; i < cartSnapshot.length(); i++) {
            JSONObject item = cartSnapshot.optJSONObject(i);
            if (item == null) continue;
            int quantity = Math.max(1, item.optInt("quantity", 1));
            int price = Math.max(0, item.optInt("price", 0));

            JSONObject metadata = new JSONObject();
            metadata.put("source", "pos");
            metadata.put("cartIndex", i);

            String productId = firstText(item.optString("id", ""), item.optString("product_id", ""));
            JSONObject row = new JSONObject();
            row.put("order_id", orderCode);
            row.put("product_id", productId.isEmpty() ? JSONObject.NULL : productId);
            row.put("product_name", item.optString("name", "Món"));
            row.put("quantity", quantity);
            row.put("unit_price", price);
            row.put("line_total", quantity * price);
            row.put("spice", "");
            row.put("note", "");
            row.put("toppings", new JSONArray());
            row.put("option_groups", new JSONArray());
            row.put("kitchen_item_status", "pending");
            row.put("metadata", metadata);
            rows.put(row);
        }
        return rows;
    }

    static String buildCashReceiptText(
            String orderCode,
            String displayOrderCode,
            JSONArray cartSnapshot,
            int total,
            int receivedAmount,
            int changeAmount,
            String cashierName,
            String branchName,
            String pagerNumber,
            String customerName,
            String orderNote
    ) {
        String time = new SimpleDateFormat("HH:mm dd/MM/yyyy", new Locale("vi", "VN")).format(new Date());
        StringBuilder builder = new StringBuilder();
        builder.append("@@CENTER:GÁNH HÀNG RONG\n");
        builder.append("@@CENTER:MÃ ĐƠN POS\n");
        builder.append("@@BIG:").append(displayOrderCode).append("\n");
        builder.append("------------------------------------------\n");
        builder.append("Mã đơn: ").append(orderCode).append("\n");
        builder.append("Chi nhánh: ").append(branchName).append("\n");
        builder.append("Thu ngân: ").append(cashierName).append("\n");
        if (!firstText(pagerNumber).isEmpty()) builder.append("Thẻ rung: ").append(firstText(pagerNumber)).append("\n");
        if (!firstText(customerName).isEmpty()) builder.append("Khách: ").append(firstText(customerName)).append("\n");
        builder.append("Giờ: ").append(time).append("\n");
        builder.append("Thanh toán: Tiền mặt\n");
        if (!firstText(orderNote).isEmpty()) builder.append("Ghi chú: ").append(firstText(orderNote)).append("\n");
        builder.append("------------------------------------------\n");
        for (int i = 0; i < cartSnapshot.length(); i++) {
            JSONObject item = cartSnapshot.optJSONObject(i);
            if (item == null) continue;
            int quantity = Math.max(1, item.optInt("quantity", 1));
            int price = Math.max(0, item.optInt("price", 0));
            builder.append(quantity).append(" x ").append(item.optString("name", "Món")).append("\n");
            builder.append(receiptMoneyLine("  Thành tiền", quantity * price)).append("\n");
        }
        builder.append("------------------------------------------\n");
        builder.append(receiptMoneyLine("Tổng cần thu", total)).append("\n");
        builder.append(receiptMoneyLine("Tiền khách đưa", receivedAmount)).append("\n");
        builder.append(receiptMoneyLine("Tiền thối", changeAmount)).append("\n");
        return builder.toString();
    }

    private static String receiptMoneyLine(String label, int amount) {
        String value = String.format(new Locale("vi", "VN"), "%,dđ", Math.max(0, amount));
        int spaces = Math.max(1, 42 - label.length() - value.length());
        StringBuilder builder = new StringBuilder(label);
        for (int i = 0; i < spaces; i++) builder.append(' ');
        builder.append(value);
        return builder.toString();
    }

    private static String firstText(String... values) {
        for (String value : values) {
            String text = String.valueOf(value == null ? "" : value).trim();
            if (!text.isEmpty()) return text;
        }
        return "";
    }
}
