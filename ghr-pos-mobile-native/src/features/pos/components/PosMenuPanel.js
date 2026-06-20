import React, { memo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { formatMoney } from "../../../utils/format";

const ALL_CATEGORY = "Tất cả";

const PosMenuPanel = memo(function PosMenuPanel({
  products = [],
  categories = [],
  activeCategory = ALL_CATEGORY,
  columns = 3,
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

  return (
    <View style={styles.panel}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroller}
        contentContainerStyle={styles.categoryList}
      >
        {listCategories.map((category) => {
          const active = category === activeCategory;
          return (
            <Pressable
              key={category}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => onSelectCategory?.(category)}
            >
              <Text style={[styles.categoryText, active && styles.categoryTextActive]} numberOfLines={1}>
                {category}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        style={[
          styles.pagerCard,
          pagerSelected && !pagerBusy && styles.pagerReady,
          pagerBusy && styles.pagerBusy
        ]}
        onPress={onOpenPagerPicker}
      >
        <View style={styles.pagerTop}>
          <Text style={[styles.pagerLabel, pagerSelected && styles.pagerLabelReady]}>Thẻ rung</Text>
          <Text style={[styles.pagerAction, pagerBusy && styles.pagerActionBusy]}>
            {pagerSelected ? "Đổi" : "Chọn thẻ"}
          </Text>
        </View>
        <Text style={[styles.pagerValue, pagerBusy && styles.pagerValueBusy]} numberOfLines={1}>
          {pagerSelected ? `Thẻ ${normalizedPager}` : "Chưa chọn"}
        </Text>
        <Text style={[styles.pagerHint, pagerBusy && styles.pagerHintBusy]} numberOfLines={1}>
          {pagerSelected
            ? pagerBusy
              ? `Thẻ ${normalizedPager} đang có đơn chưa hoàn tất`
              : `Thẻ ${normalizedPager} sẵn sàng`
            : busyPagers.length
              ? `${busyPagers.length} thẻ đang bận`
              : "Chọn thẻ trước khi thêm món"}
        </Text>
      </Pressable>

      <ScrollView style={styles.productFrame} showsVerticalScrollIndicator={false}>
        <View style={styles.productGrid}>
          {products.map((item) => (
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
          ))}

          {!products.length ? <Text style={styles.empty}>Chưa có món để bán.</Text> : null}
        </View>
      </ScrollView>
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
    borderRadius: POS_RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: POS_COLORS.border
  },
  categoryScroller: {
    flexGrow: 0,
    maxHeight: 58,
    borderWidth: 1,
    borderColor: POS_COLORS.softBorder,
    borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.subtleSurface
  },
  categoryList: {
    gap: 8,
    padding: 7
  },
  categoryChip: {
    minHeight: 42,
    maxWidth: 190,
    borderWidth: 1,
    borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  categoryChipActive: {
    borderColor: POS_COLORS.primary,
    backgroundColor: POS_COLORS.primarySoft
  },
  categoryText: {
    color: POS_COLORS.slate,
    fontSize: 13,
    fontWeight: "900"
  },
  categoryTextActive: {
    color: POS_COLORS.primaryDark
  },
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
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    gap: 10,
    paddingBottom: 8
  },
  productCard: {
    minHeight: 210,
    borderWidth: 1,
    borderColor: POS_COLORS.border,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_RADIUS.md,
    overflow: "hidden"
  },
  imageSlot: {
    width: "100%",
    aspectRatio: 1,
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
    minHeight: 78,
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 11,
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
