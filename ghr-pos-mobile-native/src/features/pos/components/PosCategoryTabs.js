import React, { memo, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { POS_COLORS, POS_RADIUS } from "../../../styles/posTheme";
import { buildBalancedCategoryRows, getCategoryRowWidth } from "../../../shared/pos/posCategoryLayout";

export default memo(function PosCategoryTabs({ categories, activeCategory, onSelectCategory, singleRow = false }) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [widths, setWidths] = useState({});
  const rows = useMemo(() => singleRow ? [categories] : buildBalancedCategoryRows(categories, widths), [categories, widths, singleRow]);
  const availableWidth = Math.max(0, viewportWidth - 16);
  const contentWidth = Math.max(availableWidth, ...rows.map((row) => getCategoryRowWidth(row, widths)));
  const canScroll = contentWidth > availableWidth + 1;

  const measureLabel = (category, textWidth) => {
    const chipWidth = Math.ceil(textWidth) + 30;
    setWidths((current) => current[category] === chipWidth ? current : { ...current, [category]: chipWidth });
  };

  return (
    <ScrollView
      horizontal
      scrollEnabled={canScroll}
      showsHorizontalScrollIndicator={canScroll}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      style={[styles.scroller, { height: rows.length * 50 + 8 }]}
      contentContainerStyle={styles.list}
    >
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { width: contentWidth }]}>
          {row.map((category) => {
            const active = category === activeCategory;
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityLabel={category}
                accessibilityState={{ selected: active }}
                style={[styles.chip, { minWidth: widths[category] || 190 }, active && styles.chipActive]}
                onPress={() => onSelectCategory?.(category)}
              >
                <Text
                  style={[styles.text, active && styles.textActive]}
                  onLayout={(event) => measureLabel(category, event.nativeEvent.layout.width)}
                  numberOfLines={1}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroller: {
    flexGrow: 0, flexShrink: 0, borderWidth: 1,
    borderColor: POS_COLORS.softBorder, borderRadius: POS_RADIUS.md,
    backgroundColor: POS_COLORS.subtleSurface
  },
  list: { flexDirection: "column", gap: 8, padding: 7 },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    minHeight: 42, flexGrow: 1, flexShrink: 0,
    borderWidth: 1, borderColor: POS_COLORS.inputBorder,
    backgroundColor: POS_COLORS.surface, borderRadius: POS_RADIUS.md,
    paddingHorizontal: 14, alignItems: "center", justifyContent: "center"
  },
  chipActive: { borderColor: POS_COLORS.primary, backgroundColor: POS_COLORS.primarySoft },
  text: { maxWidth: 160, color: POS_COLORS.slate, fontSize: 13, fontWeight: "900" },
  textActive: { color: POS_COLORS.primaryDark }
});
