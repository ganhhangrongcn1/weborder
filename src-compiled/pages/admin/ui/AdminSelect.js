import { jsx as _jsx } from "react/jsx-runtime";
export default function AdminSelect({
  children,
  className = "",
  selectSize = "md",
  onValueChange,
  onChange,
  options = [],
  ...props
}) {
  const handleChange = event => {
    if (onValueChange) {
      onValueChange(event.target.value, event);
      return;
    }
    if (onChange) onChange(event);
  };
  return /*#__PURE__*/_jsx("select", {
    className: `admin-ui-select admin-ui-select--${selectSize} ${className}`.trim(),
    onChange: handleChange,
    ...props,
    children: options.length ? options.map(item => /*#__PURE__*/_jsx("option", {
      value: item.value,
      children: item.label
    }, item.value)) : children
  });
}