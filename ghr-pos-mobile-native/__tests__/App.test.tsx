/**
 * @format
 */

import 'react-native';
import React from 'react';

// Note: import explicitly to use the types shipped with jest.
import {expect, it, jest} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

const mockStopAuthLifecycle = jest.fn();
const mockStartAuthLifecycle = jest.fn(() => mockStopAuthLifecycle);

jest.mock('../src/services/supabase/client', () => ({
  startPosSupabaseAuthLifecycle: mockStartAuthLifecycle,
}));

jest.mock('../src/screens/PosHomeScreen', () => {
  const ReactModule = require('react');
  const {View} = require('react-native');
  return function MockPosHomeScreen() {
    return ReactModule.createElement(View);
  };
});

const App = require('../App').default;

it('renders correctly', () => {
  let tree;
  renderer.act(() => {
    tree = renderer.create(<App />);
  });

  expect(mockStartAuthLifecycle).toHaveBeenCalledTimes(1);

  renderer.act(() => {
    tree.unmount();
  });
  expect(mockStopAuthLifecycle).toHaveBeenCalledTimes(1);
});
