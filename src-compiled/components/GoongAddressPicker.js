import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BRANCH_LOCATION, getGoongMapTilesKey, goongAutocomplete, goongDistanceMatrix, goongPlaceDetail, goongReverseGeocode, hasGoongApiKey } from "../services/goongService.js";
import { calculateBaseShippingFeeByConfig } from "../services/shippingService.js";
import { formatMoney } from "../utils/format.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function calculateDeliveryFee(distanceKm, shippingConfig) {
  if (!distanceKm) return null;
  return calculateBaseShippingFeeByConfig(distanceKm, shippingConfig);
}
function estimateDistanceFromText(addressText) {
  const text = String(addressText || "").toLowerCase();
  if (!text.trim()) return null;
  if (text.includes("phú hòa") || text.includes("phu hoa") || text.includes("lê hồng phong") || text.includes("30/4")) return 3.8;
  if (text.includes("thủ dầu một") || text.includes("thu dau mot")) return 4.5;
  if (text.includes("bình dương") || text.includes("binh duong")) return 6.5;
  return text.length >= 10 ? 5 : null;
}
function estimateDistanceFromCoordinate(lat, lng, origin) {
  if (!lat || !lng || !origin?.lat || !origin?.lng) return null;
  const earthRadiusKm = 6371;
  const dLat = (lat - origin.lat) * Math.PI / 180;
  const dLng = (lng - origin.lng) * Math.PI / 180;
  const fromLat = origin.lat * Math.PI / 180;
  const toLat = lat * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  return Math.max(0.1, earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function getMapStyle() {
  const key = getGoongMapTilesKey();
  return key ? `https://tiles.goong.io/assets/goong_map_web.json?api_key=${key}` : {
    version: 8,
    sources: {},
    layers: [{
      id: "blank",
      type: "background",
      paint: {
        "background-color": "#fff7ec"
      }
    }]
  };
}
function normalizeChange(data, shippingConfig) {
  const deliveryFee = calculateDeliveryFee(data.distanceKm, shippingConfig);
  return {
    addressText: data.addressText || "",
    placeId: data.placeId || "",
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    distanceKm: data.distanceKm ?? null,
    durationText: data.durationText || "",
    deliveryFee,
    shippingStatus: deliveryFee === null ? "NEED_CONFIRM" : "OK"
  };
}
export default function GoongAddressPicker({
  value,
  onChange,
  origin,
  shippingConfig
}) {
  const deliveryOrigin = origin?.lat && origin?.lng ? origin : BRANCH_LOCATION;
  const defaultCenter = [deliveryOrigin.lng, deliveryOrigin.lat];
  const [keyword, setKeyword] = useState(value?.addressText || value?.address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(() => normalizeChange({
    addressText: value?.addressText || value?.address || "",
    lat: value?.lat,
    lng: value?.lng,
    distanceKm: value?.distanceKm,
    durationText: value?.durationText
  }, shippingConfig));
  const [isSearching, setIsSearching] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [statusText, setStatusText] = useState(hasGoongApiKey() ? "Nhập địa chỉ để tìm gợi ý giao hàng" : "Chưa cấu hình Goong API key, bạn vẫn có thể nhập tay");
  const [isTyping, setIsTyping] = useState(false);
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const searchIdRef = useRef(0);
  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(async () => {
      const query = keyword.trim();
      setIsTyping(false);
      if (query.length < 6 || !query.includes(" ")) {
        setSuggestions([]);
        setStatusText(hasGoongApiKey() ? "Nhập tên đường đầy đủ hơn để tìm gợi ý" : "Chưa cấu hình Goong API key, bạn vẫn có thể nhập tay");
        return;
      }
      if (!hasGoongApiKey()) {
        setSuggestions([]);
        setStatusText("Chưa cấu hình Goong API key nên chưa có gợi ý địa chỉ");
        return;
      }
      const searchId = searchIdRef.current + 1;
      searchIdRef.current = searchId;
      setIsSearching(true);
      const results = await goongAutocomplete(query);
      if (searchId !== searchIdRef.current) return;
      setSuggestions(results.slice(0, 4));
      setStatusText(results.length ? `Có ${results.length} gợi ý, chọn để tính phí ship` : "Goong chưa trả gợi ý, kiểm tra key hoặc nhập cụ thể hơn");
      setIsSearching(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [keyword]);
  useEffect(() => {
    if (!showMap) return;
    setTimeout(() => {
      mapNode.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      mapRef.current?.resize();
    }, 80);
    if (mapRef.current || !mapNode.current) return;
    const center = selected.lng && selected.lat ? [selected.lng, selected.lat] : defaultCenter;
    const map = new maplibregl.Map({
      container: mapNode.current,
      style: getMapStyle(),
      center,
      zoom: selected.lng && selected.lat ? 15 : 13
    });
    const marker = new maplibregl.Marker({
      draggable: true,
      color: "#FF6A00"
    }).setLngLat(center).addTo(map);
    marker.on("dragend", () => {
      const point = marker.getLngLat();
      updateFromCoordinate(point.lat, point.lng);
    });
    map.on("click", event => {
      marker.setLngLat(event.lngLat);
      updateFromCoordinate(event.lngLat.lat, event.lngLat.lng);
    });
    mapRef.current = map;
    markerRef.current = marker;
  }, [showMap]);
  async function emitChange(next) {
    const normalized = normalizeChange(next, shippingConfig);
    setSelected(normalized);
    onChange?.(normalized);
  }
  async function updateDistance(addressText, lat, lng, placeId = "") {
    setIsCalculating(true);
    const distance = await goongDistanceMatrix(deliveryOrigin, {
      lat,
      lng
    });
    const fallbackDistance = estimateDistanceFromCoordinate(lat, lng, deliveryOrigin) || estimateDistanceFromText(addressText);
    const next = normalizeChange({
      addressText,
      placeId,
      lat,
      lng,
      distanceKm: distance?.distanceKm ?? fallbackDistance,
      durationText: distance?.durationText || (fallbackDistance ? "Ước tính" : "")
    }, shippingConfig);
    await emitChange(next);
    setStatusText(next.shippingStatus === "OK" ? `${distance?.distanceKm ? "Goong" : "Ước tính"} ${next.distanceKm.toFixed(1)}km · Phí ${formatMoney(next.deliveryFee)}` : "Không xác định được phí ship, nhân viên sẽ xác nhận");
    setIsCalculating(false);
  }
  async function chooseSuggestion(suggestion) {
    searchIdRef.current += 1;
    setSuggestions([]);
    setIsCalculating(true);
    const detail = await goongPlaceDetail(suggestion.place_id);
    const location = detail?.geometry?.location;
    const addressText = detail?.formatted_address || suggestion.description;
    setKeyword(addressText);
    if (location?.lat && location?.lng) {
      markerRef.current?.setLngLat([location.lng, location.lat]);
      mapRef.current?.flyTo({
        center: [location.lng, location.lat],
        zoom: 15
      });
      await updateDistance(addressText, location.lat, location.lng, suggestion.place_id);
    } else {
      const fallbackDistance = estimateDistanceFromText(addressText);
      await emitChange({
        addressText,
        placeId: suggestion.place_id,
        distanceKm: fallbackDistance,
        durationText: fallbackDistance ? "Ước tính" : ""
      });
      setStatusText(fallbackDistance ? `Ước tính ${fallbackDistance.toFixed(1)}km · Phí ${formatMoney(calculateDeliveryFee(fallbackDistance, shippingConfig))}` : "Không xác định được phí ship, nhân viên sẽ xác nhận");
    }
    setIsCalculating(false);
  }
  async function updateFromCoordinate(lat, lng) {
    setIsCalculating(true);
    const reverse = await goongReverseGeocode(lat, lng);
    const addressText = reverse?.formatted_address || "Vị trí đã chọn (chưa có địa chỉ cụ thể)";
    setKeyword(addressText);
    await updateDistance(addressText, lat, lng, reverse?.place_id || "");
    setIsCalculating(false);
  }
  function handleManualChange(nextValue) {
    setKeyword(nextValue);
    setIsTyping(true);
    const fallbackDistance = estimateDistanceFromText(nextValue);
    emitChange({
      ...selected,
      addressText: nextValue,
      distanceKm: fallbackDistance,
      durationText: fallbackDistance ? "Ước tính" : ""
    });
  }
  return /*#__PURE__*/_jsxs("div", {
    className: "space-y-2",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "relative z-20",
      children: [/*#__PURE__*/_jsxs("label", {
        className: "address-field",
        children: [/*#__PURE__*/_jsx("span", {
          children: "\u0110\u1ECBa ch\u1EC9 giao h\xE0ng"
        }), /*#__PURE__*/_jsx("input", {
          value: keyword,
          onChange: event => handleManualChange(event.target.value),
          placeholder: "Nh\u1EADp s\u1ED1 nh\xE0, t\xEAn \u0111\u01B0\u1EDDng, ph\u01B0\u1EDDng...",
          autoComplete: "off"
        })]
      }), suggestions.length > 0 && /*#__PURE__*/_jsx("div", {
        className: "absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-[22px] border border-orange-100 bg-white p-1 shadow-[0_18px_44px_rgba(58,31,20,0.18)]",
        children: suggestions.map(item => /*#__PURE__*/_jsxs("button", {
          type: "button",
          onMouseDown: event => {
            event.preventDefault();
            event.stopPropagation();
            chooseSuggestion(item);
          },
          className: "w-full rounded-[18px] px-3 py-2 text-left text-xs hover:bg-orange-50",
          children: [/*#__PURE__*/_jsx("strong", {
            className: "block text-brown",
            children: item.structured_formatting?.main_text || item.description
          }), /*#__PURE__*/_jsx("span", {
            className: "mt-1 block text-brown/55",
            children: item.description
          })]
        }, item.place_id))
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "flex items-center justify-between gap-2 rounded-2xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700",
      children: [/*#__PURE__*/_jsx("span", {
        className: "min-w-0 flex-1",
        children: isTyping ? "Đợi bạn nhập xong rồi gợi ý..." : isSearching ? "Đang tìm địa chỉ..." : isCalculating ? "Đang tính khoảng cách..." : statusText
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        onClick: () => setShowMap(true),
        className: "shrink-0 rounded-xl bg-white px-2 py-1 text-orange-600 shadow-sm",
        children: "Th\u1EA3 ghim"
      })]
    }), showMap && /*#__PURE__*/_jsxs("div", {
      className: "space-y-2",
      children: [/*#__PURE__*/_jsx("div", {
        ref: mapNode,
        className: "h-56 overflow-hidden rounded-[20px] border border-orange-100 bg-cream"
      }), /*#__PURE__*/_jsx("p", {
        className: "text-xs font-bold text-brown/50",
        children: "Ch\u1EA1m b\u1EA3n \u0111\u1ED3 ho\u1EB7c k\xE9o ghim \u0111\u1EC3 ch\u1ECDn v\u1ECB tr\xED giao."
      })]
    }), (selected.distanceKm || selected.deliveryFee !== null) && /*#__PURE__*/_jsxs("div", {
      className: "grid grid-cols-2 gap-2 text-xs",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "rounded-2xl bg-white px-3 py-2 shadow-sm",
        children: [/*#__PURE__*/_jsx("span", {
          className: "block text-brown/45",
          children: "Kho\u1EA3ng c\xE1ch"
        }), /*#__PURE__*/_jsx("strong", {
          className: "text-brown",
          children: selected.distanceKm ? `${selected.distanceKm.toFixed(1)}km` : "Chưa rõ"
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "rounded-2xl bg-white px-3 py-2 shadow-sm",
        children: [/*#__PURE__*/_jsx("span", {
          className: "block text-brown/45",
          children: "Ph\xED ship"
        }), /*#__PURE__*/_jsx("strong", {
          className: "text-orange-600",
          children: selected.deliveryFee !== null ? formatMoney(selected.deliveryFee) : "Xác nhận sau"
        })]
      })]
    })]
  });
}