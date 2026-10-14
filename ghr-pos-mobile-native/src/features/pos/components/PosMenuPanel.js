import React, { memo, useCallback } from "react";
import { Image, Pressable, FlatList, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";

import PosCategoryTabs from "./PosCategoryTabs";

const ALL_CATEGORY = "Tất cả";

const PosMenuPanel = memo(function PosMenuPanel({
  products = [],
  categories = [],
  activeCategory = ALL_CATEGORY,
  columns = 3,
  compact = false,
  pagerEnabled = true,
  normalizedPager = "",
  pagerBusy = false,
  busyPagers = [],
  onOpenPagerPicker,
  onSelectCategory,
  onAddProduct
}) {
  const listCategories = categories.length ? categories : [ALL_CATEGORY];
  const safeColumns = Math.max(2, Math.min(3, Number(columns || 2)));
  const cardWidth = safeColumns === 3 ? "31.8%" : "48.7%";
  const pagerSelected = Boolean(normalizedPager);

  const renderProduct = useCallback(({ item }) => (
    <Pressable
      key={item.id}
      style={[styles.productCard, { width: cardWidth }]}
      onPress={() => onAddProduct(item)}
    >
      <View style={styles.imageSlot}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <Text style={styles.imageText}>GHR</Text>
        )}
      </View>

      <View style={styles.productBody}>
        <View style={styles.productCopy}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.productMeta} numberOfLines={1}>
            {Array.isArray(item.optionGroups) && item.optionGroups.length
              ? `${item.category} · Có tùy chọn`
              : item.category}
          </Text>
        </View>
        <Text style={styles.productPrice}>{formatMoney(item.price)}</Text>
      </View>
    </Pressable>
  ), [cardWidth, onAddProduct]);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <View>
          <Text style={styles.panelTitle}>Chọn món</Text>
          <Text style={styles.panelMeta}>{products.length} món đang hiển thị</Text>
        </View>
        <Pressable
          style={[styles.pagerInline, pagerSelected && !pagerBusy && styles.pagerReady, pagerBusy && styles.pagerBusy]}
          onPress={onOpenPagerPicker}
        >
          <Text style={styles.pagerInlineLabel}>THẺ RUNG</Text>
          <Text style={[styles.pagerInlineValue, pagerBusy && styles.pagerValueBusy]}>
            {!pagerEnabled ? "Đã tắt" : pagerSelected ? normalizedPager : "Chọn thẻ"}
          </Text>
        </Pressable>
      </View>
      <PosCategoryTabs
        singleRow={compact}
        categories={listCategories}
        activeCategory={activeCategory}
        onSelectCategory={onSelectCategory}
      />

      <FlatList
        key={safeColumns}
        data={products}
        numColumns={safeColumns}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderProduct}
        style={styles.productFrame}
        contentContainerStyle={styles.productList}
        columnWrapperStyle={styles.productRow}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={9}
        windowSize={5}
        removeClippedSubviews={false}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có món để bán.</Text>}
      />
    </View>
  );
});

export default PosMenuPanel;

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 10,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.border
  },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  panelTitle: { color: POS_COLORS.heading, fontSize: 18, fontWeight: "900" },
  panelMeta: { marginTop: 2, color: POS_COLORS.muted, fontSize: 11, fontWeight: "700" },
  pagerInline: {
    minWidth: 108,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#facc15",
    backgroundColor: POS_COLORS.warningSoft,
    borderRadius: POS_RADIUS.sm,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 11
  },
  pagerInlineLabel: { color: POS_COLORS.muted, fontSize: 9, fontWeight: "900" },
  pagerInlineValue: { marginTop: 1, color: POS_COLORS.heading, fontSize: 14, fontWeight: "900" },
  pagerCard: {
    gap: 3,
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#facc15",
    backgroundColor: "#fffbeb",
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  pagerReady: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4"
  },
  pagerBusy: {
    borderColor: "#fecaca",
    backgroundColor: POS_COLORS.dangerSoft
  },
  pagerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  pagerLabel: {
    color: POS_COLORS.warning,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  pagerLabelReady: {
    color: POS_COLORS.primaryDark
  },
  pagerAction: {
    color: POS_COLORS.warning,
    fontSize: 12,
    fontWeight: "900"
  },
  pagerActionBusy: {
    color: POS_COLORS.danger
  },
  pagerValue: {
    color: POS_COLORS.heading,
    fontSize: 17,
    lineHeight: 19,
    fontWeight: "900"
  },
  pagerValueBusy: {
    color: POS_COLORS.danger
  },
  pagerHint: {
    color: POS_COLORS.muted,
    fontSize: 10,
    fontWeight: "800"
  },
  pagerHintBusy: {
    color: POS_COLORS.danger
  },
  productFrame: {
    flex: 1,
    minHeight: 0
  },
  productList: { paddingBottom: 8 },
  productRow: { gap: 10, marginBottom: 10 },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    gap: 10,
    paddingBottom: 8
  },
  productCard: {
    minHeight: 188,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    overflow: "hidden"
  },
  imageSlot: {
    width: "100%",
    aspectRatio: 1.32,
    backgroundColor: "#edf7ef",
    alignItems: "center",
    justifyContent: "center"
  },
  productImage: {
    width: "100%",
    height: "100%"
  },
  imageText: {
    color: POS_COLORS.primary,
    fontSize: 16,
    fontWeight: "900"
  },
  productBody: {
    minHeight: 72,
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    justifyContent: "space-between"
  },
  productCopy: {
    minHeight: 44,
    gap: 4
  },
  productName: {
    minHeight: 36,
    color: POS_COLORS.heading,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  productMeta: {
    minHeight: 16,
    color: POS_COLORS.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800"
  },
  productPrice: {
    color: "#166534",
    fontSize: 15,
    fontWeight: "900"
  },
  empty: {
    color: POS_COLORS.muted,
    paddingVertical: 14,
    fontWeight: "800"
  }
});
