import { jsx as _jsx } from "react/jsx-runtime";
export default function AdminTextarea({
  className = "",
  textareaSize = "md",
  onValueChange,
  onChange,
  ...props
}) {
  const handleChange = event => {
    if (onValueChange) {
      onValueChange(event.target.value, event);
      return;
    }
    if (onChange) onChange(event);
  };
  return /*#__PURE__*/_jsx("textarea", {
    className: `admin-ui-textarea admin-ui-textarea--${textareaSize} ${className}`.trim(),
    onChange: handleChange,
    ...props
  });
}