import CustomerControl from "./CustomerControl.jsx";
import Icon from "../Icon.jsx";

export default function CustomerHighlight({ title, description, icon = "star", image, onClick, className = "", ...props }) {
  return <CustomerControl {...props} type="button" className={`customer-highlight ${className}`.trim()} onClick={onClick}>
    {image ? <img src={image} alt="" width="24" height="24" className="customer-highlight__icon" /> : <Icon name={icon} size={24} weight="fill" className="customer-highlight__icon" />}
    <span className="customer-highlight__copy">
      <strong>{title}</strong>
      {description ? <small>{description}</small> : null}
    </span>
    <Icon name="back" size={17} className="customer-highlight__arrow" />
  </CustomerControl>;
}
