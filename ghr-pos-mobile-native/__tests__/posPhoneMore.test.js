/* global jest, test, expect */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { PosPhoneMore } from '../src/features/pos/components/PosPhoneNavigation';

jest.mock('../src/features/pos/components/PosIcon', () => 'PosIcon');

test('cashier More renders each destination once and routes buttons without legacy mode props', () => {
  const onSelect = jest.fn();
  const onSignOut = jest.fn();
  let tree;
  try {
    act(() => { tree = renderer.create(<PosPhoneMore onSelect={onSelect} onSignOut={onSignOut} />); });
    const buttons = tree.root.findAllByType(Pressable);
    const labels = buttons.map(button => button.findAllByType(Text).map(text =>
      Array.isArray(text.props.children) ? text.props.children.join('') : text.props.children).join(''));
    expect(labels).toEqual(['Tổng quan ca ›', 'Máy in & thiết lập ›', 'Đổi ca / Đăng xuất']);
    act(() => { buttons[0].props.onPress(); buttons[1].props.onPress(); });
    expect(onSelect.mock.calls).toEqual([['shift'], ['settings']]);
    expect(onSignOut).not.toHaveBeenCalled();
    act(() => buttons[2].props.onPress());
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(2);
  } finally {
    if (tree) act(() => tree.unmount());
  }
});
