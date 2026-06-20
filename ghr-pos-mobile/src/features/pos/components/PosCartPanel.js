import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export const PosCartPanel = memo(function PosCartPanel({ cart, totals, onChangeQuantity, onClear }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Bill hien tai</Text>
        <Pressable onPress={onClear}>
          <Text style={styles.clear}>Xoa</Text>
        </Pressable>
      </View>

      {cart.length ? (
        cart.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{formatMoney(item.price * item.quantity)}</Text>
            </View>
            <View style={styles.controls}>
              <Pressable style={styles.action} onPress={() => onChangeQuantity(item.id, -1)}>
                <Text style={styles.actionText}>-</Text>
              </Pressable>
              <Text style={styles.qty}>{item.quantity}</Text>
              <Pressable style={[styles.action, styles.actionPrimary]} onPress={() => onChangeQuantity(item.id, 1)}>
                <Text style={[styles.actionText, styles.actionPrimaryText]}>+</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>Chua co mon trong bill.</Text>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Tong</Text>
        <Text style={styles.totalValue}>{formatMoney(totals.total)}</Text>
      </View>
    </View>
  );
});

function formatMoney(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount) + "d";
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fffaf3",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e7dccd"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937"
  },
  clear: {
    color: "#b91c1c",
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#efe6da"
  },
  info: {
    flex: 1,
    paddingRight: 12
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937"
  },
  meta: {
    marginTop: 4,
    color: "#7c6858"
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  action: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dccdb9",
    alignItems: "center",
    justifyContent: "center"
  },
  actionPrimary: {
    backgroundColor: "#b45309",
    borderColor: "#b45309"
  },
  actionText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937"
  },
  actionPrimaryText: {
    color: "#fff"
  },
  qty: {
    minWidth: 18,
    textAlign: "center",
    fontWeight: "700"
  },
  totalRow: {
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "700"
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#b45309"
  },
  empty: {
    color: "#7c6858",
    paddingVertical: 10
  }
});
