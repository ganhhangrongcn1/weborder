/* global jest, test, expect, beforeEach, afterEach */
import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {Pressable,Text} from 'react-native';
import PosCustomerSummaryCard from '../src/features/pos/components/PosCustomerSummaryCard';
import PosStampPanel from '../src/features/pos/components/PosStampPanel';
import usePosStampSummary from '../src/hooks/usePosStampSummary';
import {readPosStamps,subscribePosStampInvalidation} from '../src/services/pos/posStampService';
jest.mock('../src/features/pos/components/PosStampRewardBadge',()=> 'RewardBadge');
jest.mock('../src/services/pos/posCustomerService',()=>({normalizeCustomerPhone:value=>value||''}));
jest.mock('../src/services/pos/posStampService',()=>({readPosStamps:jest.fn(),subscribePosStampInvalidation:jest.fn()}));
let tree, state, invalidated;
function Harness({phone}) { state=usePosStampSummary(phone,'staff'); return null; }
const flush=async()=>{await act(async()=>{for(let i=0;i<5;i++) await Promise.resolve();});};
beforeEach(()=>{jest.useFakeTimers({doNotFake:['queueMicrotask','setImmediate']});readPosStamps.mockReset();subscribePosStampInvalidation.mockImplementation(callback=>{invalidated=callback;return jest.fn();});});
afterEach(()=>{if(tree) act(()=>tree.unmount());tree=null;jest.clearAllTimers();jest.useRealTimers();});
test('10 available stamps highlights both signal and gift choices; error and 9 stamps do not',()=>{
  const data={enabled:true,available:10,held:0,gifts:[{id:'gift',name:'Quà'}]};const open=jest.fn(),choose=jest.fn();
  act(()=>{tree=renderer.create(<PosCustomerSummaryCard customerPhone="0901234567" stampState={{data}} onOpen={open}/>);});
  const signal=tree.root.findAllByType(Pressable).find(node=>node.props.accessibilityLabel?.includes('đủ tem'));
  expect(signal).toBeDefined();act(()=>signal.props.onPress());expect(open).toHaveBeenCalledTimes(1);
  act(()=>tree.update(<PosStampPanel phone="0901234567" state={{data}} products={[{id:'gift'}]} onChoose={choose}/>));
  expect(tree.root.findAllByType(Text).map(n=>n.props.children)).toContain('Khách đã đủ tem đổi quà!');
  act(()=>tree.root.findByType(Pressable).props.onPress());expect(choose).toHaveBeenCalledWith({id:'gift'});
  act(()=>tree.update(<PosStampPanel phone="0901234567" state={{data:{...data,available:9}}} products={[{id:'gift'}]}/>));
  expect(tree.root.findAllByType('RewardBadge')).toHaveLength(0);expect(tree.root.findByType(Pressable).props.disabled).toBe(true);
  act(()=>tree.update(<PosCustomerSummaryCard customerPhone="0901234567" stampState={{data,error:'offline'}} onOpen={open}/>));
  expect(tree.root.findAllByType('RewardBadge')).toHaveLength(0);
});
test('debounced lookup discards late response for preceding phone and refreshes on invalidation',async()=>{
  let oldResolve;readPosStamps.mockImplementationOnce(()=>new Promise(resolve=>{oldResolve=resolve;})).mockResolvedValue({enabled:true,available:2});
  act(()=>{tree=renderer.create(<Harness phone="0901234567"/>);jest.advanceTimersByTime(400);});
  act(()=>jest.advanceTimersByTime(400));await flush();
  act(()=>tree.update(<Harness phone="0901234568"/>));
  expect(state.data).toBeNull();act(()=>jest.advanceTimersByTime(400));await flush();
  expect(state.data.available).toBe(2);
  oldResolve({enabled:true,available:12});await flush();expect(state.data.available).toBe(2);
  act(()=>invalidated());act(()=>jest.advanceTimersByTime(400));await flush();
  expect(readPosStamps).toHaveBeenCalledTimes(3);
});
