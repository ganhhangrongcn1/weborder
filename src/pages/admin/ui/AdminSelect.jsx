export default function AdminSelect({
  children,
  className = "",
  selectSize = "md",
  onValueChange,
  onChange,
  options = [],
  ...props
}) {
  const handleChange = (event) => {
    if (onValueChange) {
      onValueChange(event.target.value, event);
      return;
    }
    if (onChange) onChange(event);
  };

  return (
    <select
      className={`admin-ui-select admin-ui-select--${selectSize} ${className}`.trim()}
      onChange={handleChange}
      {...props}
    >
      {options.length
        ? options.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))
        : children}
    </select>
  );
}
