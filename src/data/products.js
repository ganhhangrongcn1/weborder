export const categories = ["Tất cả", "Bestseller", "Combo", "Bánh sinh nhật", "Ăn vặt", "Nước uống"];

export const products = [
  {
    id: "bt-toi-bo",
    name: "Bánh tráng tỏi bò cay cay",
    short: "Tỏi phi, bò khô, sa tế trứng cút",
    description: "Tỏi phi, bò khô, sa tế trứng cút, rau răm và sốt nhà làm cay thơm.",
    price: 39000,
    oldPrice: 49000,
    category: "Bestseller",
    badge: "Bestseller",
    rating: 4.9,
    reviews: "1.2k",
    sold: "10.000+",
    image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "bt-phoi-suong",
    name: "Bánh tráng phơi sương",
    short: "Phơi sương dẻo, hành phi khô bò, xoài sấy",
    description: "Bánh tráng mềm dẻo, hành phi thơm, bò khô xé và sốt me dịu vị.",
    price: 35000,
    category: "Bestseller",
    badge: "Hot",
    rating: 4.8,
    reviews: "860",
    sold: "8.500+",
    image: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "bt-cuon-tron",
    name: "Bánh tráng cuốn trộn",
    short: "Trộn đặc biệt, nhiều topping",
    description: "Cuốn mềm, sốt béo, topping đầy đặn cho team mê ăn vặt.",
    price: 42000,
    category: "Combo",
    badge: "Combo Hot",
    rating: 4.9,
    reviews: "740",
    sold: "6.200+",
    image: "https://images.unsplash.com/photo-1625938144755-652e08e359b7?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "bt-hanh-phi",
    name: "Bánh tráng tỏi hành phi",
    short: "Hành phi thơm, sa tế trứng cút",
    description: "Vị thơm béo của hành phi, cay nhẹ và đậm sốt.",
    price: 32000,
    category: "Ăn vặt",
    badge: "Mới",
    rating: 4.7,
    reviews: "530",
    sold: "4.300+",
    image: "https://images.unsplash.com/photo-1613844237701-8f3664fc2eff?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "bt-sa-te-trung-cut",
    name: "Bánh tráng sa tế trứng cút",
    short: "Sa tế cay ngon, trứng cút bùi bùi",
    description: "Một phần cay thơm vừa miệng, hợp ăn xế hoặc tối nhẹ.",
    price: 34000,
    category: "Ăn vặt",
    badge: "Hot",
    rating: 4.8,
    reviews: "690",
    sold: "7.100+",
    image: "https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "combo-tiktok",
    name: "Combo hot TikTok",
    short: "2 bánh tráng, 1 trà xoài, topping thêm",
    description: "Combo nhiều món đang được gọi lại nhiều nhất tuần này.",
    price: 79000,
    oldPrice: 109000,
    category: "Combo",
    badge: "Combo Hot",
    rating: 5,
    reviews: "2.4k",
    sold: "12.000+",
    image: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "banh-sinh-nhat",
    name: "Bánh tráng sinh nhật mini",
    short: "Trang trí vui, topping đầy hộp",
    description: "Hộp bánh tráng tạo hình xinh xắn cho sinh nhật và tiệc nhỏ.",
    price: 99000,
    category: "Bánh sinh nhật",
    badge: "Mới",
    rating: 4.9,
    reviews: "310",
    sold: "1.500+",
    image: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "tra-xoai",
    name: "Trà xoài nhà rong",
    short: "Xoài thơm, trà dịu, uống kèm cực hợp",
    description: "Ly trà xoài mát nhẹ giúp cân vị cay của bánh tráng.",
    price: 25000,
    category: "Nước uống",
    badge: "Hot",
    rating: 4.8,
    reviews: "920",
    sold: "5.900+",
    image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80"
  }
];

export const promos = [
  { title: "Freeship", text: "Đơn từ 150k", icon: "bike" },
  { title: "Tặng trà", text: "Đơn từ 79k", icon: "cup" },
  { title: "Mua 3 lần", text: "Nhận quà bí mật", icon: "gift" },
  { title: "Giảm 10%", text: "Cho khách mới", icon: "sale" }
];

export const toppings = [
  { id: "trung-cut", name: "Trứng cút", price: 10000 },
  { id: "kho-bo", name: "Khô bò", price: 15000 },
  { id: "sot-bo", name: "Sốt bơ", price: 5000 },
  { id: "toi-phi", name: "Tỏi phi", price: 5000 },
  { id: "dau-phong", name: "Đậu phộng", price: 5000 }
];

export const vouchers = [
  { id: "giam10", title: "Giảm 10k", subtitle: "Đơn từ 79k", expiry: "HSD: 20/05/2026" },
  { id: "traxoai", title: "Tặng trà xoài", subtitle: "Đơn từ 89k", expiry: "HSD: 25/05/2026" },
  { id: "freeship", title: "Freeship", subtitle: "Đơn từ 150k", expiry: "HSD: 30/05/2026" }
];
