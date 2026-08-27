import { Children, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../../../components/Icon.jsx";

function toPlainText(value) {
  if (Array.isArray(value)) return value.map(toPlainText).join("");
  if (isValidElement(value)) return toPlainText(value.props.children);
  return value === null || value === undefined ? "" : String(value);
}

function collectOptions(children, group = "") {
  const options = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "optgroup") {
      options.push(...collectOptions(child.props.children, toPlainText(child.props.label)));
      return;
    }
    if (child.type === "option") {
      options.push({
        value: String(child.props.value ?? ""),
        label: toPlainText(child.props.children),
        disabled: Boolean(child.props.disabled),
        group
      });
      return;
    }
    options.push(...collectOptions(child.props.children, group));
  });
  return options;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

export default function InventorySearchableSelect({
  value = "",
  onChange,
  children,
  disabled = false,
  required = false,
  name = "",
  id,
  className = "",
  searchPlaceholder = "Tìm trong danh sách...",
  "aria-label": ariaLabel
}) {
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState({});
  const options = useMemo(() => collectOptions(children), [children]);
  const selectedOption = options.find((option) => option.value === String(value ?? ""));
  const emptyOption = options.find((option) => option.value === "");
  const visibleOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeSearchText(`${option.label} ${option.group}`).includes(normalizedQuery));
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return undefined;
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportGap = 8;
      const preferredHeight = 330;
      const spaceBelow = window.innerHeight - rect.bottom - viewportGap;
      const spaceAbove = rect.top - viewportGap;
      const openAbove = spaceBelow < 190 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(150, Math.min(preferredHeight, openAbove ? spaceAbove : spaceBelow));
      const width = Math.max(rect.width, 250);
      const left = Math.min(Math.max(viewportGap, rect.left), window.innerWidth - width - viewportGap);
      setPanelStyle({
        left,
        top: openAbove ? Math.max(viewportGap, rect.top - maxHeight - 6) : rect.bottom + 6,
        width,
        maxHeight
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  const chooseOption = (option) => {
    if (option.disabled) return;
    onChange?.({ target: { name, value: option.value, type: "select-one" } });
    setOpen(false);
    setQuery("");
    window.setTimeout(() => rootRef.current?.querySelector("button")?.focus(), 0);
  };

  const handleTriggerKeyDown = (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!disabled) setOpen(true);
    }
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      rootRef.current?.querySelector("button")?.focus();
    }
    if (event.key === "Enter" && visibleOptions.length === 1) {
      event.preventDefault();
      chooseOption(visibleOptions[0]);
    }
  };

  return (
    <div ref={rootRef} className={`inventory-searchable-select${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}>
      <button
        id={id}
        type="button"
        className="inventory-searchable-select__trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={!selectedOption || selectedOption.value === "" ? "is-placeholder" : ""}>
          {selectedOption?.label || emptyOption?.label || "Chọn dữ liệu"}
        </span>
        <span className="inventory-searchable-select__chevron" aria-hidden="true">⌄</span>
      </button>

      {open ? createPortal(
        <div ref={panelRef} className="inventory-searchable-select__panel" style={panelStyle} role="presentation">
          <label className="inventory-searchable-select__search">
            <Icon name="search" size={16} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label="Tìm lựa chọn"
            />
          </label>
          <div className="inventory-searchable-select__options" role="listbox" aria-label={ariaLabel || "Danh sách lựa chọn"}>
            {visibleOptions.length ? visibleOptions.map((option, index) => {
              const previousGroup = visibleOptions[index - 1]?.group;
              const showGroup = option.group && option.group !== previousGroup;
              const active = option.value === String(value ?? "");
              return (
                <div key={`${option.group}:${option.value}:${index}`}>
                  {showGroup ? <div className="inventory-searchable-select__group">{option.group}</div> : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    className={active ? "is-selected" : ""}
                    onClick={() => chooseOption(option)}
                  >
                    <span>{option.label}</span>
                    {active ? <Icon name="check" size={15} /> : null}
                  </button>
                </div>
              );
            }) : <div className="inventory-searchable-select__empty">Không tìm thấy dữ liệu phù hợp.</div>}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
