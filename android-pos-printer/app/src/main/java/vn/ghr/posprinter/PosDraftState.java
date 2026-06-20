package vn.ghr.posprinter;

import org.json.JSONObject;

final class PosDraftState {
    private String confirmedPaymentMethod = "";
    private String confirmedPaymentReference = "";
    private String confirmedPaidAt = "";
    private String confirmedBillKey = "";
    private int confirmedCashReceived = 0;
    private int confirmedChangeAmount = 0;
    private JSONObject cachedActiveShift = null;

    JSONObject getCachedActiveShift() {
        return cachedActiveShift;
    }

    void setCachedActiveShift(JSONObject shift) {
        cachedActiveShift = shift;
    }

    void confirmCashPayment(int receivedAmount, int totalAmount, String billKey, String paidAt) {
        confirmedPaymentMethod = "cash";
        confirmedPaymentReference = "CASH-" + System.currentTimeMillis();
        confirmedPaidAt = paidAt == null ? "" : paidAt;
        confirmedBillKey = billKey == null ? "" : billKey;
        confirmedCashReceived = Math.max(0, receivedAmount);
        confirmedChangeAmount = Math.max(0, receivedAmount - Math.max(0, totalAmount));
    }

    void clearConfirmedPayment() {
        confirmedPaymentMethod = "";
        confirmedPaymentReference = "";
        confirmedPaidAt = "";
        confirmedBillKey = "";
        confirmedCashReceived = 0;
        confirmedChangeAmount = 0;
    }

    boolean hasConfirmedPayment() {
        return !confirmedPaymentMethod.isEmpty();
    }

    boolean matchesBillKey(String billKey) {
        return confirmedBillKey.equals(String.valueOf(billKey == null ? "" : billKey));
    }

    String getConfirmedPaymentMethod() {
        return confirmedPaymentMethod;
    }

    String getConfirmedPaymentReference() {
        return confirmedPaymentReference;
    }

    String getConfirmedPaidAt() {
        return confirmedPaidAt;
    }

    int getConfirmedCashReceived() {
        return confirmedCashReceived;
    }

    int getConfirmedChangeAmount() {
        return confirmedChangeAmount;
    }
}
