import { ChoiceField, TextField } from "./RecruitmentFields.jsx";

export default function RecruitmentQuestion({ question: q, ...field }) {
  return <>
    {["radio", "checkbox"].includes(q.type)
      ? <ChoiceField {...field} name={q.id} label={q.label} options={q.options} required={q.required} multiple={q.type === "checkbox"} />
      : <TextField {...field} name={q.id} label={q.label} required={q.required} multiline={q.type === "textarea"}
          type={q.type === "textarea" ? undefined : q.type} maxLength={q.type === "textarea" ? 2000 : q.id === "address" ? 300 : 200}
          hint={q.id === "school" ? "Nếu không đi học, bạn ghi “Không đang đi học” nha." : q.id === "previousJob" ? "Nếu chưa từng đi làm, bạn ghi rõ giúp Gánh nha." : undefined} />}
    {q.id === "education" && field.form.education === "Mục khác" && <TextField {...field} name="educationOther" label="Trình độ học vấn khác" maxLength={150} />}
  </>;
}
