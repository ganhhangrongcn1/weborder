import { jsx as _jsx } from "react/jsx-runtime";
export default function AdminInput({
  className = "",
  inputSize = "md",
  onValueChange,
  onChange,
  type = "text",
  ...props
}) {
  const handleChange = event => {
    if (onValueChange) {
      onValueChange(event.target.value, event);
      return;
    }
    if (onChange) onChange(event);
  };
  return /*#__PURE__*/_jsx("input", {
    type: type,
    className: `admin-ui-input admin-ui-input--${inputSize} ${className}`.trim(),
    onChange: handleChange,
    ...props
  });
}