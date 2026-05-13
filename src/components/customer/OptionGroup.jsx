export default function OptionGroup({ title, children }) {
  return (
    <div>
      <h2 className="label">{title}</h2>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}
