// Run after npm run dev -- --host 127.0.0.1. All order writes are mocked.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const browser = await puppeteer.launch({executablePath:process.env.CHROME_BIN || '/usr/bin/chromium', headless:true, args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().endsWith('/__catalog_test')) request.respond({status:200,contentType:'text/html',body:'<html><body><div id="test"></div></body></html>'});
    else if (!request.url().startsWith('http://127.0.0.1:5173/')) request.abort();
    else request.continue();
  });
  await page.goto('http://127.0.0.1:5173/__catalog_test');
  const result = await page.evaluate(async () => {
    const RefreshRuntime = (await import('/@react-refresh')).default;
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const {createRoot} = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const {default:useCart} = await import('/src/hooks/useCart.js');
    const {orderRepository} = await import('/src/services/repositories/orderRepository.js');
    const {buildReorderItems} = await import('/src/services/reorderService.js');
    const {default:StoreStatusModal} = await import('/src/components/customer/StoreStatusModal.jsx');
    const checks=[];
    const check=(value,message)=>{if(!value) throw new Error(message); checks.push(message);};
    const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
    const products=[{id:'roll',name:'Cuốn Bơ',price:49000,visible:true}];
    orderRepository.getCartDraft = () => [{...products[0],cartId:'existing',quantity:1,unitTotal:49000,lineTotal:49000}];
    orderRepository.saveCartDraft = () => {};
    let state, mode='normal', resolveCatalog;
    const notices=[], events=[];
    function Harness() {
      state=useCart({initialCart:[],catalogProducts:products,smartPromotions:[],makeCartItem:()=>{},toastTimer:{current:null},freeshipMinSubtotal:100000,deliveryFee:10000,discount:0,reorder:buildReorderItems,
        getReorderCatalog:async()=>{if(mode==='error') throw Error('network'); if(mode==='pending') return new Promise(resolve=>{resolveCatalog=resolve;}); return products;},
        onReorderNotice:n=>notices.push(n),onPrepareReorder:()=>events.push('prepare'),navigate:()=>events.push('navigate')});
      return null;
    }
    const root=createRoot(document.getElementById('test')); root.render(React.createElement(Harness)); await tick();
    const before=JSON.stringify(state.cart);
    await state.reorderOrder({items:[{id:'removed',name:'Combo Cuốn Bơ + Trà Tắc',price:39000}]}); await tick();
    check(JSON.stringify(state.cart)===before,'Removed combo preserves existing cart');
    check(notices.at(-1).title==='Món ăn không còn phục vụ' && notices.at(-1).message.includes('Combo Cuốn Bơ'),'Popup names discontinued dish');
    check(events.length===0,'Blocked reorder does not change checkout preset or navigate');
    await state.reorderOrder({items:[{id:'roll'},{id:'removed',name:'Món cũ'}]}); await tick();
    check(JSON.stringify(state.cart)===before,'Mixed order fails as a whole');
    mode='error'; await state.reorderOrder({items:[{id:'roll'}]}); await tick();
    check(JSON.stringify(state.cart)===before && notices.at(-1).title==='Chưa thể kiểm tra menu','Network failure preserves cart and shows retry notice');
    mode='pending'; const first=state.reorderOrder({items:[{id:'roll',quantity:2,note:'Nhiều bơ'}]});
    await state.reorderOrder({items:[{id:'roll'}]});
    resolveCatalog(products); await first; await tick();
    check(events.join(',')==='prepare,navigate','Repeated click only prepares and navigates once');
    check(state.cart.length===1 && state.cart[0].lineTotal===98000 && state.cart[0].note==='Nhiều bơ','Valid reorder uses current price and preserves quantity and note');
    mode='pending'; const second=state.reorderOrder({items:[{id:'roll',quantity:5}]});
    state.setCart(items=>items.map(item=>({...item,note:'Khách vừa sửa'}))); await tick(); resolveCatalog(products); await second; await tick();
    check(state.cart[0].note==='Khách vừa sửa' && state.cart[0].quantity===2,'Cart edits made during catalog loading are preserved');
    mode='pending'; const refreshed=state.reorderOrder({items:[{id:'roll',quantity:3}]});
    products[0].price=50000; state.repriceCartNow(); await tick(); resolveCatalog(products); await refreshed; await tick();
    check(state.cart[0].quantity===3 && state.cart[0].lineTotal===150000,'Automatic price refresh during loading does not cancel a valid reorder');
    let closeCount=0, menuCount=0;
    root.render(React.createElement(StoreStatusModal,{notice:{title:'Món ăn không còn phục vụ',badge:'Chọn món khác',message:'Combo cũ không còn trong menu.',actionLabel:'Xem menu',onAction:()=>menuCount++},onClose:()=>closeCount++})); await tick();
    const buttons=Array.from(document.querySelectorAll('button'));
    buttons.find(b=>b.textContent==='Xem menu').click(); buttons.find(b=>b.textContent==='Đóng').click();
    check(menuCount===1 && closeCount===1,'Popup has working View menu and Close actions');
    const {default:useCheckoutActions} = await import('/src/features/checkout/useCheckoutActions.js');
    const checkoutNotices=[], checkoutNavigation=[];
    let createCount=0;
    const checkoutProps={setCart:()=>{},checkoutTotal:49000,subtotal:49000,checkoutShip:0,deliveryInfo:{name:'Khách thử nghiệm',phone:'0901234567'},fulfillmentType:'pickup',paymentMethod:'COD',navigate:(...args)=>checkoutNavigation.push(args),onNotice:n=>checkoutNotices.push(n),createOrderFromCheckout:async()=>{createCount++;const error=Error('ORDER_ITEMS_UNAVAILABLE');error.code='P4002';error.details=JSON.stringify([{name:'Combo cũ'}]);throw error;}};
    await useCheckoutActions(checkoutProps).handlePlaceOrder();
    check(createCount===1 && checkoutNavigation.length===0 && checkoutNotices.at(-1)?.message.includes('Combo cũ'),'Server catalog rejection shows dish popup without navigating to success');
    checkoutNotices.at(-1).onAction();
    check(checkoutNavigation.at(-1)?.[0]==='menu','Checkout rejection offers View menu');
    await useCheckoutActions({...checkoutProps,repriceCartNow:()=>({changed:true})}).handlePlaceOrder();
    check(createCount===1 && checkoutNotices.at(-1).title==='Giá món đã được cập nhật','Price changes still require customer reconfirmation');
    return checks;
  });
  assert.equal(result.length,13);
  console.log(JSON.stringify({passed:result.length,checks:result},null,2));
} finally {await browser.close();}
