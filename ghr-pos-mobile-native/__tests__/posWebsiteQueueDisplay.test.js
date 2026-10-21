/* global test, expect */
import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {Text,Pressable} from 'react-native';
import PosPickupOrdersPanel from '../src/features/pos/components/PosPickupOrdersPanel';
test('a future pickup is hidden by the action filter but remains visible under All', () => {
 const d=new Date(Date.now()+2*60*60*1000);
 const pad=v=>String(v).padStart(2,'0');
 const pickupTimeText=`${pad(d.getHours())}:${pad(d.getMinutes())} - ${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
 let tree;
 try {
  act(() => {tree=renderer.create(<PosPickupOrdersPanel pickupOrders={[{id:'scheduled',displayOrderCode:'TEST-SCHEDULED',customerName:'Test',totalAmount:28000,paymentStatus:'unpaid',fulfillmentType:'pickup',pickupTimeText,metadata:{}}]}/>);});
  const texts=()=>tree.root.findAllByType(Text).map(n=>n.props.children).flat().filter(v=>typeof v==='string');
  expect(texts()).not.toContain('TEST-SCHEDULED');
  const all=tree.root.findAllByType(Pressable).find(p=>p.findAllByType(Text).some(n=>n.props.children==='Tất cả'));
  expect(all).toBeDefined(); act(()=>all.props.onPress());
  expect(texts()).toContain('TEST-SCHEDULED');
 } finally {if(tree)act(()=>tree.unmount());}
});
