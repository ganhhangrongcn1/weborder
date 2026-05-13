# Interaction Flow

Tai lieu nay mo ta interaction flow hien co cua project theo dang:

`[EVENT] -> [ACTION] -> [NEXT UI]`

## 1. Home Flow

Click profile icon tren Home -> `navigate("account", "account")` -> Mo man `Account`.

Click banner -> `goToMenu(categories[0])` -> Set active category dau tien -> `navigate("menu", "menu")` -> Mo man `Menu` voi category dang active.

Scroll banner -> `handleBannerScroll()` -> Cap nhat `activeBanner` -> Dot indicator doi trang thai active.

Click dot banner -> `setActiveBanner(index)` -> Banner track scroll den banner tuong ung.

Click search tren Home -> `navigate("menu", "menu")` -> Mo man `Menu`.

Click `Giao hang` tren Home -> Set `checkoutPreset.fulfillmentType = "delivery"` -> `navigate("menu", "menu")` -> Mo `Menu` theo che do giao hang.

Click `Tu den lay` tren Home -> Set `homeFulfillment = "pickup"` va `pickupPlannerOpen = true` -> Mo pickup planner sheet.

Click branch trong pickup planner -> `setPickupBranch(branch.id)` -> Branch card duoc active.

Click `Som nhat` trong pickup planner -> `setPickupMode("soon")` -> Hien trang thai lay som nhat.

Click `Chon gio` trong pickup planner -> `setPickupMode("schedule")` -> Hien input ngay lay va gio lay.

Click `Xong, vao menu` -> Luu `checkoutPreset` voi `fulfillmentType = "pickup"` -> Dong pickup planner -> `navigate("menu", "menu")` -> Mo `Menu`.

Click flash sale main card -> `openOptionModal(mainFlashProduct)` -> Mo `OptionModal`.

Click `Xem tat ca` trong flash sale -> `setFlashModalOpen(true)` -> Mo flash sale sheet.

Click mon trong flash sale sheet -> Dong flash sale sheet -> `openOptionModal(product)` -> Mo `OptionModal`.

Click category bubble tren Home -> `selectHomeCategory(category)` -> Filter danh sach mon noi bat tren Home theo category/badge.

Click `Xem tat ca` category tren Home -> Reset category ve tat ca -> `setShowAllHomeProducts(true)` -> Mo rong danh sach mon noi bat.

Click `Xem them` trong mon noi bat -> `setShowAllHomeProducts(true)` -> Hien toi da 8 mon noi bat.

Click `Thu gon` trong mon noi bat -> `setShowAllHomeProducts(false)` -> Thu gon ve 4 mon noi bat.

Click anh mon / nut `+` tren Home -> `openOptionModal(product)` -> Mo `OptionModal`.

Click ten mon tren Home -> `openOptionModal(product)` -> Mo `OptionModal`.

Click cart floating bar -> `navigate("checkout", "orders")` -> Mo man `Checkout`.

## 2. Menu Flow

Click back tren header Menu -> `navigate("home", "home")` -> Quay ve `Home`.

Click category chip -> `setActiveCategory(category)` -> `filteredProducts` cap nhat theo category -> Grid san pham duoc filter.

Scroll Menu -> Sticky tools (`menu-sticky-tools`) giu search va category chips tren dau -> User tiep tuc filter bang category chips.

Nhap vao search trong Menu -> Chi thay doi gia tri native cua input -> Chua co state/onChange filter trong source hien tai -> UI danh sach mon khong doi.

Click anh mon -> `openOptionModal(product)` -> Mo `OptionModal`.

Click ten mon -> `openProduct(product)` -> Set selected product/options mac dinh -> `navigate("detail", "home")` -> Mo `ProductDetailPage`.

Click nut `+` cua mon -> `openOptionModal(product)` -> Mo `OptionModal`.

Click `-` tren product card da chon -> `removeOneByKey(product.id)` -> Giam so luong mon trong cart hoac xoa neu con 1 -> Product card/cart count cap nhat.

Click topping card trong `Them cho du vi` -> `addToppingAsItem(topping)` -> Add topping nhu cart item rieng -> Hien toast va cart update.

Click `+` topping da chon -> `addToppingAsItem(topping)` -> Tang so luong topping item -> Cart update.

Click `-` topping da chon -> `removeOneByKey(topping.id)` -> Giam/xoa topping item -> Cart update.

Click option/topping trong `OptionModal` -> Cap nhat `selectedToppings` hoac option group selection -> Modal tinh lai tam tinh.

Click quantity `+` trong `OptionModal` -> `setQuantity(quantity + 1)` -> Quantity va tam tinh tang.

Click quantity `-` trong `OptionModal` -> `setQuantity(Math.max(1, quantity - 1))` -> Quantity va tam tinh giam, toi thieu 1.

Click `Them vao gio` trong `OptionModal` -> `addToCart(...)` -> Dong modal -> Hien toast -> Floating cart bar/cart count cap nhat.

## 3. Cart Flow

Click floating cart bar -> `navigate("checkout", "orders")` -> Mo `Checkout`.

Click item trong cart tai Checkout -> Neu item khong phai addon thi `openCartItemEditor(item)` -> Mo `OptionModal` o che do edit.

Click addon item trong cart -> `isEditableItem` tra ve false -> Khong mo edit modal.

Click `+` trong cart item -> `updateQty(cartId, 1)` -> Tang quantity -> Cap nhat line total va checkout total.

Click `-` trong cart item -> `updateQty(cartId, -1)` -> Giam quantity nhung toi thieu 1 -> Cap nhat line total va checkout total.

Click trash trong cart item -> `setCart(items.filter(...))` -> Xoa item -> Cap nhat cart va tong tien.

Click `Xoa tat ca` -> `setCart([])` -> Cart trong -> Checkout cart section rong.

Click `Cap nhat mon` trong edit `OptionModal` -> `addToCart(...)` voi `editingCartId` -> Replace hoac merge item trung config -> Dong modal -> Cart update.

Click checkout / `Dat hang` -> Validate ten, phone, dia chi neu delivery -> `createOrderFromCheckout(...)` -> `navigate("success", "orders")` -> Mo man `Success` cho buoc Zalo.

## 4. Checkout Flow

Click tab `Giao tan noi` -> `setFulfillmentType("delivery")` -> Hien card `Giao hang den` va phi ship duoc tinh theo dia chi/khoang cach.

Click `Doi dia chi` -> `setIsAddressModalOpen(true)` -> Mo `AddressModal`.

Click dia chi da luu trong `AddressModal` -> `onSelectAddress(address)` -> Dien delivery info, tinh lai distance/fee -> Dong modal.

Click `Luu thong tin` trong `AddressModal` -> Validate/normalize delivery info -> Tinh lai distance/fee -> Neu checked save thi luu dia chi vao account -> Dong modal -> Checkout hien dia chi moi.

Click tab `Den lay` -> `setFulfillmentType("pickup")` -> An card dia chi giao hang -> Hien card chon chi nhanh va planner thoi gian lay.

Click branch trong Checkout pickup -> `setSelectedBranch(branch.id)` -> Branch card duoc active.

Click `Som nhat` pickup -> `setPickupMode("soon")` -> Hien thong tin san sang sau khoang 20 phut.

Click `Chon gio` pickup -> `setPickupMode("schedule")` -> Hien input ngay lay va gio lay.

Click input ngay/gio pickup -> Cap nhat `pickupDate` / `pickupClock` -> `pickupTimeText` cap nhat cho order.

Click `Chon ma khuyen mai` -> `setIsPromoModalOpen(true)` -> Mo `PromoModal`.

Click promo trong `PromoModal` -> Select hoac bo select promo -> Dong modal -> Tong tien cap nhat.

Click toggle `Dung diem thuong` -> `setUsePoints(checked)` -> Ap dung/bo ap dung point discount -> Tong tien cap nhat.

Click nut thong tin phi giao hang trong tong tien -> `setIsDeliveryFeeModalOpen(true)` -> Mo `DeliveryFeeModal`.

Click `Dat hang` -> Validate thong tin giao/phone/cart -> `createOrderFromCheckout(...)` tao order status `pending_zalo` va clear cart -> `navigate("success", "orders")` -> Mo `Success`.

Sau khi tao order -> `Success` render noi dung don va link Zalo -> Hien man `Don hang dang cho xac nhan`.

Click `Gui Zalo de quan xac nhan don` -> `confirmCurrentOrder()` + copy noi dung don -> Mo link Zalo trong tab/app moi -> UI chuyen sang trang thai da xac nhan.

Click `Copy lai noi dung don` sau khi confirmed -> Copy lai noi dung don -> Hien alert copy thanh cong/that bai.

Click `Mo lai Zalo` -> Mo lai link Zalo -> User tiep tuc gui tin nhan cho quan.

Click `Theo doi don hang` -> `navigate("tracking", "orders")` -> Mo man `Tracking`.

Click `Mua lai don nay` tren Success -> `navigate("menu", "menu")` -> Mo `Menu`.

## 5. Account Flow

Click bottom nav `Tai khoan` -> `handleBottomNav("account")` -> `navigate("account", "account")` -> Mo `Account`.

Khi chua login -> Account hien tabs `Tra cuu don` va `Dang nhap` -> User co the tra cuu phone, login, quen mat khau, hoac tao tai khoan.

Click `Tiep tuc` trong tra cuu so dien thoai -> `handlePhoneLookup()` -> Tim user va order theo phone -> Hien lich su don bi an mot phan va form login/register/claim tuy trang thai.

Neu phone da co account -> `authMode = "login"` -> Hien form mat khau de dang nhap.

Click `Dang nhap` trong flow lookup -> `handlePasswordLogin()` -> `loginOrRegisterByPhone(lookupPhone)` -> Hien notice dang nhap thanh cong -> Account render profile day du.

Click tab `Dang nhap` -> `setAccountEntryTab("login")` -> Hien form phone/password.

Click `Dang nhap` trong form direct login -> `handleDirectLogin()` -> Validate account/password -> `loginOrRegisterByPhone(phone)` -> Hien profile day du.

Neu phone co don cu nhung chua registered -> `authMode = "claimBlocked"` -> Hien form xac minh 4 so cuoi ma don gan nhat.

Click `Xac minh de tao tai khoan` -> `handleVerifyRecentOrder()` -> Neu dung ma don thi `authMode = "register"` -> Hien form tao ten/mat khau.

Click `Hoan tat tao tai khoan` -> `handleRegister()` -> Tao/dang nhap account va lien ket du lieu cu -> Hien profile day du.

Click `Quen mat khau?` -> `setAccountEntryTab("forgot")` -> Hien form xac minh phone + 4 so cuoi ma don.

Click `Xac minh ma don` -> `handleVerifyResetPassword()` -> Neu dung ma don gan nhat thi `resetStep = "password"` -> Hien form mat khau moi.

Click `Cap nhat mat khau` -> `handleUpdatePasswordFromOrder()` -> Luu password moi -> Quay ve tab dang nhap.

Khi da login -> Account hien hero profile, phone, hang thanh vien neu feature flag bat, dia chi giao hang, lich su don, diem thuong, don gan nhat, cai dat thong bao.

Click `Chinh sua ho so` -> `setProfileOpen(true)` -> Mo `ProfileModal`.

Click save trong `ProfileModal` -> `handleSaveUser(patch)` -> Luu ten/avatar/password demo -> Dong modal -> Hero profile cap nhat.

Click `Them dia chi moi` -> `setAddressModal(...)` -> Mo `AccountAddressModal`.

Click `Sua` dia chi -> `setAddressModal(address)` -> Mo `AccountAddressModal` voi dia chi dang edit.

Click `Luu dia chi` -> `handleSaveAddress(address)` -> Add/update/set default neu can -> Dong modal -> Danh sach dia chi cap nhat.

Click `Giao den` tren address -> `setDefaultAddress(addresses, address.id)` -> Dia chi do thanh default.

Click `Xoa` dia chi -> `handleDeleteAddress(address.id)` -> Xoa neu con hon 1 dia chi -> Danh sach dia chi cap nhat.

Click `Lich su don hang` metric -> `navigate("tracking", "orders")` -> Mo `Tracking`.

Click `Xem lich su don` trong don gan nhat -> `navigate("tracking", "orders")` -> Mo `Tracking`.

Click order trong `Tracking` -> `setSelectedOrder(order)` -> Mo `OrderStatusSheet` chi tiet don.

Click `Mua lai don nay` trong `Tracking` -> `reorderOrder(order)` -> Set cart tu order -> `navigate("checkout", "orders")` -> Mo `Checkout`.

Click `Diem thuong` / diem metric -> `navigate("loyalty", "rewards")` -> Mo `Loyalty`.

Click `Dang nhap de diem danh` khi chua login -> `navigate("account", "account")` -> Mo Account login/register.

Click `Diem danh nhan +... diem` khi da login -> `handleCheckin()` -> Cong diem, cap nhat streak/history/milestone, co the tao lucky voucher -> Hien modal `Qua may man` neu co voucher.

Click `Nhan qua` trong lucky voucher modal -> `setLuckyVoucher(null)` -> Dong modal.

Click `Dang xuat` -> `logoutDemoUser()` -> Account quay ve flow chua login.

## 6. Admin Flow

Vao `/admin` -> `App` render `AdminApp` -> Mac dinh active nav `store-ui`, section `promo`, sub `ui`.

Click `Quan ly giao dien` -> `openAdminNav(store-ui)` -> `section = "promo"`, `sub = "ui"` -> Mo panel `AppearanceSettings`.

Click `Quan ly chi nhanh` -> `openAdminNav(store-branches)` -> `section = "store"`, `sub = "branches"` -> Mo panel `BranchSettings`.

Click `Phi giao hang` -> `openAdminNav(store-shipping)` -> `section = "shipping"` -> Mo panel `ShippingSettings`.

Click `Cau hinh tin nhan Zalo` -> `openAdminNav(store-zalo)` -> `section = "zalo"` -> Mo panel `ZaloSettings`.

Click `CRM` -> `openAdminNav(customer-crm)` -> `section = "crm"`, `sub = "crm"` -> Mo panel `CustomerCRM`.

Click customer card trong CRM -> `setSelectedCustomerPhone(customer.phone)` -> Hien panel chi tiet khach, diem, lich su don, voucher.

Click `+10 diem thu cong` / `-10 diem thu cong` -> Dieu chinh diem khach -> Refresh CRM -> Panel chi tiet cap nhat.

Click `Reset diem` -> Reset diem ve auto points -> Refresh CRM -> Panel chi tiet cap nhat.

Click `Tang voucher demo` -> Them voucher cho khach -> Refresh CRM -> Panel voucher cap nhat.

Click `Quan ly tich diem khach hang` -> `openAdminNav(customer-loyalty)` -> `section = "crm"`, `sub = "loyalty"` -> Mo `LoyaltySettings` va `CustomerCRM`.

Click `Menu` trong admin nav -> `openAdminNav(menu-main)` -> `section = "menu"` -> Mo `MenuManager`.

Click tab `Mon chinh` trong `MenuManager` -> `setMenuTab("products")` -> Hien product panel.

Nhap admin search -> `setProductSearch(value)` -> Filter product grid theo ten.

Click admin category chip -> `setSelectedAdminCategory(category)` -> Filter product grid theo category/badge.

Click `Them mon` -> Tao product draft -> `setEditingProduct(draft)` -> Mo `AdminProductModal`.

Click product card trong admin menu -> `setEditingProduct(product)` -> Mo `AdminProductModal`.

Click save trong `AdminProductModal` -> Add/update product trong list -> Dong modal -> Product grid cap nhat.

Click delete trong `AdminProductModal` -> Xoa product -> Dong modal -> Product grid cap nhat.

Click `Them nhom` trong `AdminProductModal` -> Add option group -> Modal hien them nhom tuy chon.

Click `Them lua chon` trong option group -> Add option -> Modal hien them option row.

Click tab `Them cho du vi` trong `MenuManager` -> `setMenuTab("toppings")` -> Hien topping panel.

Click `Them topping` -> Add topping draft vao list -> Topping panel cap nhat.

Edit input topping -> `updateTopping(id, patch)` -> Topping data cap nhat.

Click `Xoa` topping -> Remove topping -> Topping panel cap nhat.

Click `Don hang` trong admin nav -> `openAdminNav(orders-main)` -> `section = "orders"` -> Mo `OrderManager`.

Change select trang thai don -> `updateOrderStatus(orderId, nextStatus)` -> Luu status vao order storage -> Order list refresh.

Click `Xem chi tiet` don hang -> `setSelectedOrder(order)` -> Mo `AdminOrderDetailModal`.

Click close trong `AdminOrderDetailModal` -> `setSelectedOrder(null)` -> Dong modal.

Click `Chuong trinh khuyen mai` -> `openAdminNav(promo-campaign)` -> `section = "promo"`, `sub = "campaign"` -> Mo `PromotionTabsManager`.

Click promo tab `Ma giam gia` -> `setActiveTab("coupon")` -> Mo `CouponManager`.

Click promo tab `Giam phi ship` -> `setActiveTab("shipping")` -> Mo `FreeshipManager`.

Click promo tab `Giam khach moi` -> `setActiveTab("new_customer")` -> Mo panel cau hinh new customer discount.

Click promo tab `Gach gia mon an` -> `setActiveTab("strike_price")` -> Mo panel cau hinh strike price.

Click promo tab `Flashsale` -> `setActiveTab("flash_sale")` -> Mo panel cau hinh flash sale.

Click promo tab `Du moc tang qua` -> `setActiveTab("gift_threshold")` -> Mo panel cau hinh gift threshold.

Click `Tao cau hinh mac dinh` trong promo tab chua cau hinh -> Tao smart promotion mac dinh -> Hien panel edit cho promo do.

Click `Luu thay doi` tren admin topbar -> Hien alert `Da luu du lieu demo` -> Khong doi panel.

Click `Xem app khach` -> Link `/` -> Quay ve customer app.

## 7. Output Summary

Click banner -> Set category dau tien -> Navigate Menu -> Show filtered Menu.

Click Home search -> Navigate Menu -> Show Menu.

Click delivery -> Save delivery preset -> Navigate Menu -> Show Menu.

Click pickup -> Open pickup planner -> Confirm planner -> Navigate Menu.

Click flash sale -> Open OptionModal hoac FlashSaleSheet -> Add to cart -> Show cart update.

Click category -> Set category state -> Filter visible products.

Click product -> Open OptionModal/ProductDetail -> Add to cart -> Show cart update.

Click cart -> Navigate Checkout -> Show cart and checkout form.

Click cart item -> Open OptionModal edit -> Update item -> Show cart update.

Click checkout submit -> Create order -> Show Success/Zalo screen.

Click send Zalo -> Confirm order + copy message -> Open Zalo.

Click login/register account -> Load linked profile data -> Show profile, addresses, points, orders.

Click check-in -> Add points/streak/voucher -> Show reward update.

Click order -> Open OrderStatusSheet/AdminOrderDetailModal -> Show order detail.

Click admin nav -> Set section/subsection -> Show mapped admin panel.

Click admin edit product/order/customer/promo -> Open modal or detail panel -> Save/update data -> Show refreshed admin UI.
