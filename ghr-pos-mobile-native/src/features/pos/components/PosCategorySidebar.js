import React, { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { POS_COLORS } from "../../../styles/posTheme";

export default memo(function PosCategorySidebar({ categories = [], activeCategory, onSelectCategory }) {
  return <View style={styles.panel}>
    <Text style={styles.heading}>Danh mục</Text>
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {categories.map(category => <Pressable key={category} accessibilityRole="button"
        accessibilityLabel={category} accessibilityState={{ selected: category === activeCategory }}
        onPress={() => onSelectCategory(category)}
        style={({ pressed }) => [styles.item, category === activeCategory && styles.active, pressed && styles.pressed]}>
        <Text style={[styles.label, category === activeCategory && styles.activeLabel]}>{category}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
});

const styles = StyleSheet.create({
  panel: { width: 140, minHeight: 0, backgroundColor: POS_COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: POS_COLORS.border, paddingTop: 14 },
  heading: { paddingHorizontal: 12, paddingBottom: 12, color: POS_COLORS.heading, fontSize: 14, fontWeight: "800" },
  list: { padding: 7, paddingTop: 0, gap: 7 },
  item: { minHeight: 52, justifyContent: "center", padding: 11, borderRadius: 9,
    borderWidth: 1, borderColor: POS_COLORS.softBorder, backgroundColor: POS_COLORS.subtleSurface },
  active: { backgroundColor: POS_COLORS.primary, borderColor: POS_COLORS.primary },
  label: { color: POS_COLORS.slate, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  activeLabel: { color: "#fff", fontWeight: "800" }, pressed: { opacity: 0.75 }
});
