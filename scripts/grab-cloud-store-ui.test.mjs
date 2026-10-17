import test from 'node:test';
import assert from 'node:assert/strict';
import {isStoreControlSelected,storeStatusLabel} from '../src/pages/admin/partner-reviews/partnerReviewUi.js';

test('actual Normal status overrides a previously successful Busy command',()=>{
 const source={store_control_action:'busy',store_control_status:'success',store_status:{state:'NORMAL',checked_at:new Date().toISOString()}};
 assert.equal(isStoreControlSelected(source,'busy'),false);assert.equal(isStoreControlSelected(source,'normal'),true);
 assert.match(storeStatusLabel(source),/mở bình thường/);
});

test('stale or closed observations do not highlight an open-state button',()=>{
 for(const state of ['NORMAL','CLOSED'])assert.equal(isStoreControlSelected({store_status:{state,checked_at:'2020-01-01T00:00:00Z'}},'normal'),false);
});
