import { RECRUITMENT_OPTIONS } from "../../../supabase/functions/_shared/recruitmentSchema.js";

export function TextField({ name, label, form, errors, update, multiline = false, hint, required = true, ...props }) {
  const id = `recruitment-${name}`;
  const Control = multiline ? "textarea" : "input";
  return (
    <div className="recruitment-field">
      <label htmlFor={id}>{label} {required && <span aria-hidden="true">*</span>}</label>
      {hint && <p id={`${id}-hint`} className="recruitment-hint">{hint}</p>}
      <Control id={id} name={name} value={form[name] || ""} onChange={(event) => update(name, event.target.value)}
        required={required} aria-invalid={Boolean(errors[name])}
        aria-describedby={[hint && `${id}-hint`, errors[name] && `${id}-error`].filter(Boolean).join(" ") || undefined}
        {...(multiline ? { rows: 4, maxLength: 2000 } : {})} {...props} />
      {errors[name] && <p id={`${id}-error`} className="recruitment-field-error">{errors[name]}</p>}
    </div>
  );
}

export function ChoiceField({ name, label, form, errors, update, toggle, multiple = false, required = true, options = RECRUITMENT_OPTIONS[name] }) {
  const id = `recruitment-${name}`;
  return (
    <fieldset className="recruitment-choices" aria-describedby={errors[name] ? `${id}-error` : undefined}>
      <legend>{label} {required && <span aria-hidden="true">*</span>}</legend>
      {multiple && <p className="recruitment-hint">Bạn có thể chọn nhiều mục.</p>}
      <div className={`recruitment-choice-list ${name === "branch" ? "recruitment-branches" : ""}`}>
        {options.map((value, index) => (
          <label key={index} className="recruitment-choice">
            <input type={multiple ? "checkbox" : "radio"} name={name} value={value}
              id={index === 0 ? id : `${id}-${index}`} aria-invalid={Boolean(errors[name])}
              checked={multiple ? (form[name] || []).includes(value) : form[name] === value}
              onChange={() => multiple ? toggle(name, value) : update(name, value)} />
            <span>{value}</span>
          </label>
        ))}
      </div>
      {errors[name] && <p id={`${id}-error`} className="recruitment-field-error">{errors[name]}</p>}
    </fieldset>
  );
}
