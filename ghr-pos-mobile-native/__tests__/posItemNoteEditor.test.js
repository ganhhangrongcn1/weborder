import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable, ScrollView, Text, TextInput } from "react-native";
import ProductOptionsModal from "../src/features/pos/components/ProductOptionsModal";

jest.useRealTimers();

const product = { id: "food", name: "Bánh tráng", price: 19000, optionGroups: [] };
const findSave = tree => tree.root.findAllByType(Pressable).find(node => node.findAllByType(Text).some(text => text.props.children === "Lưu món"));

test("notes survive keyboard input, failed saves, catalog refresh and a retry", async () => {
  const submit = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const initialConfig = { cartId: "line-a", note: "Ít sốt", quantity: 2 };
  const props = { product, initialConfig, submitLabel: "Lưu món", onSubmit: submit, onClose: jest.fn() };
  let tree;
  act(() => { tree = renderer.create(<ProductOptionsModal {...props} />); });
  expect(tree.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe("always");
  act(() => { tree.root.findByType(TextInput).props.onChangeText("Không rau răm, ít sốt"); });
  await act(async () => { await findSave(tree).props.onPress(); });
  expect(tree.root.findByType(TextInput).props.value).toBe("Không rau răm, ít sốt");
  expect(tree.root.findAllByType(Text).some(node => String(node.props.children).includes("Chưa lưu được món"))).toBe(true);
  act(() => { tree.update(<ProductOptionsModal {...props} product={{ ...product }} />); });
  expect(tree.root.findByType(TextInput).props.value).toBe("Không rau răm, ít sốt");
  await act(async () => { await findSave(tree).props.onPress(); });
  expect(submit).toHaveBeenLastCalledWith(product, { note: "Không rau răm, ít sốt", quantity: 2, selectedOptions: [] });
  act(() => tree.unmount());
});

test("opening another bill line restores that line's own note", () => {
  let tree;
  act(() => { tree = renderer.create(<ProductOptionsModal product={product} initialConfig={{ cartId: "a", note: "Ít sốt" }} />); });
  act(() => { tree.root.findByType(TextInput).props.onChangeText("Không hành"); });
  act(() => { tree.update(<ProductOptionsModal product={product} initialConfig={{ cartId: "b", note: "Không rau" }} />); });
  expect(tree.root.findByType(TextInput).props.value).toBe("Không rau");
  act(() => tree.unmount());
});
