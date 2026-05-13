import { AdminButton, AdminIconButton } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AppearanceCropModal({
  open,
  onClose,
  cropViewportRef,
  cropImageRef,
  cropSourceUrl,
  setCropOffset,
  setCropScale,
  setIsDraggingCrop,
  dragStartRef,
  cropOffset,
  isDraggingCrop,
  clampCropOffset,
  cropScale,
  applyCroppedImage
}) {
  if (!open) return null;
  return /*#__PURE__*/_jsx("div", {
    className: "admin-modal-backdrop",
    onClick: onClose,
    children: /*#__PURE__*/_jsxs("section", {
      className: "admin-crop-modal",
      onClick: event => event.stopPropagation(),
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-crop-head",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("h3", {
            children: "C\u1EAFt \u1EA3nh banner"
          }), /*#__PURE__*/_jsx("p", {
            children: "T\u1EF7 l\u1EC7 chu\u1EA9n 16:7 (1200x525). K\xE9o \u1EA3nh \u0111\u1EC3 ch\u1ECDn v\xF9ng \u0111\u1EB9p."
          })]
        }), /*#__PURE__*/_jsx(AdminIconButton, {
          label: "\u0110\xF3ng",
          variant: "primary",
          onClick: onClose,
          children: "\xD7"
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "admin-crop-viewport",
        ref: cropViewportRef,
        children: /*#__PURE__*/_jsx("img", {
          ref: cropImageRef,
          src: cropSourceUrl,
          alt: "Crop source",
          draggable: false,
          onLoad: () => {
            setCropOffset({
              x: 0,
              y: 0
            });
            setCropScale(1);
          },
          onMouseDown: event => {
            setIsDraggingCrop(true);
            dragStartRef.current = {
              x: event.clientX,
              y: event.clientY,
              ox: cropOffset.x,
              oy: cropOffset.y
            };
          },
          onMouseMove: event => {
            if (!isDraggingCrop) return;
            const dx = event.clientX - dragStartRef.current.x;
            const dy = event.clientY - dragStartRef.current.y;
            setCropOffset(clampCropOffset({
              x: dragStartRef.current.ox + dx,
              y: dragStartRef.current.oy + dy
            }));
          },
          onMouseUp: () => setIsDraggingCrop(false),
          onMouseLeave: () => setIsDraggingCrop(false),
          style: {
            transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropScale})`
          }
        })
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-crop-controls",
        children: [/*#__PURE__*/_jsxs("label", {
          children: ["Zoom", /*#__PURE__*/_jsx("input", {
            type: "range",
            min: "1",
            max: "2.6",
            step: "0.01",
            value: cropScale,
            onChange: event => {
              const nextScale = Number(event.target.value);
              setCropScale(nextScale);
              setCropOffset(current => clampCropOffset(current, nextScale));
            }
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-crop-actions",
          children: [/*#__PURE__*/_jsx(AdminButton, {
            variant: "secondary",
            onClick: onClose,
            children: "H\u1EE7y"
          }), /*#__PURE__*/_jsx(AdminButton, {
            onClick: applyCroppedImage,
            children: "L\u01B0u \u1EA3nh"
          })]
        })]
      })]
    })
  });
}