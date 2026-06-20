import { Pressable, StyleSheet, Text, View } from "react-native";

export function PaymentBar({
  totals,
  paymentConfirmed,
  disabled = false,
  onConfirmCash,
  onCreateOrder
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.info}>
        <Text style={styles.totalLabel}>Tong can thu</Text>
        <Text style={styles.totalValue}>{formatMoney(totals.total)}</Text>
        <Text style={styles.status}>
          {paymentConfirmed ? "Da xac nhan thanh toan" : "Chua xac nhan thanh toan"}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.secondary, disabled && styles.secondaryDisabled]}
          onPress={onConfirmCash}
          disabled={disabled}
        >
          <Text style={styles.secondaryText}>Tien mat</Text>
        </Pressable>
        <Pressable
          style={[styles.primary, (!paymentConfirmed || disabled) && styles.primaryDisabled]}
          onPress={onCreateOrder}
          disabled={!paymentConfirmed || disabled}
        >
          <Text style={styles.primaryText}>Tao don</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatMoney(amount) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(amount || 0))}d`;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#e7dccd",
    backgroundColor: "#fffaf3"
  },
  info: {
    marginBottom: 10
  },
  totalLabel: {
    color: "#7c6858"
  },
  totalValue: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "800",
    color: "#b45309"
  },
  status: {
    marginTop: 3,
    color: "#475569"
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  secondary: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d6c5b2",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52
  },
  secondaryDisabled: {
    opacity: 0.45
  },
  secondaryText: {
    color: "#1f2937",
    fontWeight: "700"
  },
  primary: {
    flex: 1.4,
    borderRadius: 14,
    backgroundColor: "#b45309",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52
  },
  primaryDisabled: {
    backgroundColor: "#c7b8a7"
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800"
  }
});

export default PaymentBar;
