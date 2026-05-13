export default function AdminPagination({
  page = 1,
  totalPages = 1,
  onChange,
  className = ""
}) {
  const pages = Array.from({ length: Math.max(1, totalPages) }, (_, index) => index + 1);

  return (
    <nav className={`admin-ui-pagination ${className}`.trim()} aria-label="Phân trang">
      <button type="button" disabled={page <= 1} onClick={() => onChange?.(page - 1)}>‹</button>
      {pages.map((item) => (
        <button
          key={item}
          type="button"
          className={item === page ? "active" : ""}
          onClick={() => onChange?.(item)}
        >
          {item}
        </button>
      ))}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange?.(page + 1)}>›</button>
    </nav>
  );
}
