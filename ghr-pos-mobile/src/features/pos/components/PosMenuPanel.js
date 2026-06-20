import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";

export const PosMenuPanel = memo(function PosMenuPanel({ products, onAddProduct }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Ban nhanh</Text>
      <FlashList
        data={products}
        estimatedItemSize={84}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onAddProduct(item)}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.category}</Text>
            </View>
            <Text style={styles.price}>{formatMoney(item.price)}</Text>
          </Pressable>
        )}
      />
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
    borderColor: "#e7dccd",
    minHeight: 220
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#1f2937"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eadfcf",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8
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
    marginTop: 3,
    fontSize: 12,
    color: "#7c6858"
  },
  price: {
    fontSize: 15,
    fontWeight: "800",
    color: "#b45309"
  }
});
