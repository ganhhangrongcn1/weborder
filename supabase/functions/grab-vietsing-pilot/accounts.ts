// Explicit source/merchant bindings prevent accidental cross-store writes.
export const CLOUD_ACCOUNTS = Object.freeze({
  grab_vietsing: {sourceId:'6281a325-599e-46f3-a36c-9b28b687d50a',merchantId:'5-C8EKJAE1WCADLA',minute:0,insightsGroupId:'VNMG20260909074817017247',insightsStoreId:'34c5a3bc-eeda-4400-b810-721affcf410d'},
  grab_304_primary: {sourceId:'689aae6a-12e5-4862-b932-cc2019921801',merchantId:'5-C7XFNBACBALGNA',minute:5,insightsGroupId:'VNMG20260115114625016832',insightsStoreId:'c19dac4d-7857-40c6-a0c2-67bafd98f4d0'},
  grab_304_secondary: {sourceId:'5e153cb1-c0af-4369-ab07-0a24cfe83eb4',merchantId:'5-C3D2LKCYPBUJBA',minute:10,insightsGroupId:'VNMG20220321084601010052',insightsStoreId:'24ad4268-327e-4460-8506-557548eb3860'},
  grab_lhp: {sourceId:'3ee6f662-7b7c-45e8-80d8-1c06b62fa77a',merchantId:'5-CZDXNJLASFJVGX',minute:15,insightsGroupId:'VNMG20200828094837106284',insightsStoreId:'96551c6b-c5f8-4e47-af85-289633858fd9'},
  grab_tqd: {sourceId:'db9b51f4-ca63-49af-91fd-557556698bf3',merchantId:'5-C3NXGVMHGJDHJN',minute:20,insightsGroupId:'VNMG20220802100536013508',insightsStoreId:'c7cae1dc-79e6-4789-b404-7830fc586db6'}
});

export default function cloudAccount(key = 'grab_vietsing') {
  return typeof key === 'string' && Object.hasOwn(CLOUD_ACCOUNTS,key) ? CLOUD_ACCOUNTS[key] : null;
}
