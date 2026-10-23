import React from "react";
import { ScrollView, Text, Pressable } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import PosCategoryTabs from "../src/features/pos/components/PosCategoryTabs";
import { buildBalancedCategoryRows, getCategoryRowWidth } from "../src/shared/pos/posCategoryLayout";

describe("two-row category width balancing", () => {
  it("fits long labels with short labels instead of splitting by count", () => {
    const categories = ["Long A", "Long B", "Short A", "Short B"];
    const widths = { "Long A": 190, "Long B": 190, "Short A": 60, "Short B": 60 };
    const rows = buildBalancedCategoryRows(categories, widths);
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe(categories[0]);
    expect(rows.map((row) => getCategoryRowWidth(row, widths))).toEqual([258, 258]);
    expect(rows.flat().sort()).toEqual([...categories].sort());
  });

  it("needs scrolling only when no two-row arrangement fits the available width", () => {
    const widths = { A: 180, B: 160, C: 140, D: 120, E: 70 };
    const names = Object.keys(widths);
    const rows = buildBalancedCategoryRows(names, widths);
    const balancedMax = Math.max(...rows.map((row) => getCategoryRowWidth(row, widths)));
    const allPartitions = Array.from({ length: 2 ** names.length - 2 }, (_, index) => {
      const mask = index + 1;
      return Math.max(
        getCategoryRowWidth(names.filter((_name, i) => mask & (1 << i)), widths),
        getCategoryRowWidth(names.filter((_name, i) => !(mask & (1 << i))), widths)
      );
    });
    expect(balancedMax).toBe(Math.min(...allPartitions));
    expect(balancedMax).toBeGreaterThan(300);
    expect(balancedMax).toBeLessThanOrEqual(400);
  });

  it("handles a single category without adding an empty row", () => {
    expect(buildBalancedCategoryRows(["Tất cả"], { "Tất cả": 72 })).toEqual([["Tất cả"]]);
  });

  it("uses measured labels to stop scrolling when both rows fit, and enables it on a narrow screen", () => {
    const categories = ["Long A", "Long B", "Short A", "Short B"];
    const onSelect = jest.fn();
    let tree;
    act(() => { tree = TestRenderer.create(<PosCategoryTabs categories={categories} activeCategory="Long A" onSelectCategory={onSelect} />); });
    act(() => {
      tree.root.findByType(ScrollView).props.onLayout({ nativeEvent: { layout: { width: 300 } } });
      for (const text of tree.root.findAllByType(Text)) {
        text.props.onLayout({ nativeEvent: { layout: { width: text.props.children.startsWith("Long") ? 160 : 30 } } });
      }
    });
    expect(tree.root.findByType(ScrollView).props.scrollEnabled).toBe(false);
    act(() => tree.root.findAllByType(Pressable)[0].props.onPress());
    expect(onSelect).toHaveBeenCalledWith("Long A");
    act(() => tree.root.findByType(ScrollView).props.onLayout({ nativeEvent: { layout: { width: 220 } } }));
    expect(tree.root.findByType(ScrollView).props.scrollEnabled).toBe(true);
    act(() => tree.unmount());
  });
});
