/* global jest, test, expect */
import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {FlatList,TextInput,Pressable} from 'react-native';
import PosCategorySidebar from '../src/features/pos/components/PosCategorySidebar';
import PosMenuPanel from '../src/features/pos/components/PosMenuPanel';
test('wide menu has one list column, no duplicated category bar and no search field',()=>{
  let tree;
  act(()=>{tree=renderer.create(<PosMenuPanel listLayout hideCategories products={[{id:'p',name:'Bánh tráng',price:25000}]} />);});
  expect(tree.root.findByType(FlatList).props.numColumns).toBe(1);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  expect(tree.root.findAllByType(FlatList)[0].props.data[0].name).toBe('Bánh tráng');
});
test('category sidebar preserves selection callbacks and wraps real Vietnamese names',()=>{
  const select=jest.fn();let tree;
  act(()=>{tree=renderer.create(<PosCategorySidebar categories={['Tất cả','Bánh tráng trộn']} activeCategory="Tất cả" onSelectCategory={select}/>);});
  const actions=tree.root.findAllByType(Pressable);
  expect(actions[0].props.accessibilityState.selected).toBe(true);
  act(()=>actions[1].props.onPress());expect(select).toHaveBeenCalledWith('Bánh tráng trộn');
});
