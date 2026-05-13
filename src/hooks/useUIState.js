import { useRef, useState } from "react";

export default function useUIState({ productSeed, toppingSeed }) {
  const [page, setPage] = useState("home");
  const [activeTab, setActiveTab] = useState("home");
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [selectedProduct, setSelectedProduct] = useState(productSeed[0]);
  const [selectedSpice, setSelectedSpice] = useState("Vừa cay");
  const [selectedToppings, setSelectedToppings] = useState([toppingSeed[0], toppingSeed[2]]);
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const [editingCartId, setEditingCartId] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef(null);

  return {
    page,
    setPage,
    activeTab,
    setActiveTab,
    activeCategory,
    setActiveCategory,
    selectedProduct,
    setSelectedProduct,
    selectedSpice,
    setSelectedSpice,
    selectedToppings,
    setSelectedToppings,
    note,
    setNote,
    quantity,
    setQuantity,
    isOptionModalOpen,
    setIsOptionModalOpen,
    editingCartId,
    setEditingCartId,
    toastVisible,
    setToastVisible,
    toastTimer
  };
}

