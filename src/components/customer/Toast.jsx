import Icon from "../Icon.jsx";

export default function Toast({ message }) {
  return (
    <div className="toast">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-50 text-orange-600"><Icon name="cart" size={16} /></span>
      <strong>{message}</strong>
    </div>
  );
}
