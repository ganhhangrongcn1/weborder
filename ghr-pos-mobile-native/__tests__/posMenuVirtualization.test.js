import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { FlatList, Text } from 'react-native';
import PosMenuPanel from '../src/features/pos/components/PosMenuPanel';

test('large menu mounts a bounded initial window and selecting a card preserves the product', () => {
  const products = Array.from({ length: 80 }, (_, index) => ({ id: `item-${index}`, name: `Món thử ${index}`, price: 25000, category: 'Món thử' }));
  const onAddProduct = jest.fn();
  let tree;
  act(() => { tree = renderer.create(<PosMenuPanel products={products} onAddProduct={onAddProduct} columns={3} />); });
  const list = tree.root.findByType(FlatList);
  expect(list.props.numColumns).toBe(3);
  const names = tree.root.findAll(node => node.type === Text && typeof node.props.children === 'string' && /^Món thử \d+$/.test(node.props.children));
  expect(names.length).toBeGreaterThan(0);
  expect(names.length).toBeLessThan(products.length);
  let pressable = names[0];
  while (pressable && typeof pressable.props.onPress !== 'function') pressable = pressable.parent;
  expect(pressable).toBeTruthy();
  act(() => { pressable.props.onPress(); });
  expect(onAddProduct).toHaveBeenCalledWith(products[0]);
  act(() => { tree.update(<PosMenuPanel products={products} onAddProduct={onAddProduct} columns={2} />); });
  expect(tree.root.findByType(FlatList).props.numColumns).toBe(2);
  act(() => { tree.unmount(); });
});
