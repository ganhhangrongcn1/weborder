import useReceiptTemplateSettings from "../../../hooks/useReceiptTemplateSettings.js";
import ReceiptTemplateEditor from "./ReceiptTemplateEditor.jsx";

export default function ReceiptTemplateSettings() {
  const settings = useReceiptTemplateSettings();
  return <ReceiptTemplateEditor {...settings} />;
}
