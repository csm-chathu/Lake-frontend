const EntityForm = ({
  title,
  fields,
  values,
  onChange,
  onSubmit,
  submitLabel = 'Save',
  isEditing,
  onCancel,
  footerRight,
  showSubmit = true,
  submitLoading = false,
  preventSubmitOnEnter = false
}) => (
  <section className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      {isEditing && onCancel && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
          Cancel edit
        </button>
      )}
    </div>
    <form
      className="grid gap-4 md:grid-cols-3"
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        if (!preventSubmitOnEnter) {
          return;
        }
        if (event.key !== 'Enter') {
          return;
        }
        const target = event.target;
        const tag = target?.tagName;
        const isTextarea = tag === 'TEXTAREA';
        const isButton = tag === 'BUTTON' || target?.type === 'submit';
        if (isTextarea || isButton) {
          return;
        }
        event.preventDefault();
      }}
    >
      {fields.map((field) => {
        const {
          name,
          label,
          type = 'text',
          placeholder,
          options,
          disabled = false,
          render,
          fullWidth = false,
          containerClass: customContainerClass = '',
          min,
          max,
          step,
          inputMode,
          pattern
        } = field;
        const value = values[name] ?? '';

        const baseContainerClass = fullWidth ? 'md:col-span-3 flex flex-col gap-2' : 'flex flex-col gap-2';
        const containerClass = `${baseContainerClass} ${customContainerClass}`.trim();

        if (typeof render === 'function') {
          return (
            <div key={name} className={containerClass}>
              {render({
                label,
                value,
                onChange: (newValue) => onChange(name, newValue),
                placeholder,
                disabled,
                field,
                values
              })}
            </div>
          );
        }

        if (type === 'textarea') {
          return (
            <label key={name} className="md:col-span-3 flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">{label}</span>
              <textarea
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(name, event.target.value)}
                disabled={disabled}
                className="textarea textarea-bordered min-h-[120px]"
              />
            </label>
          );
        }

        if (type === 'select') {
          return (
            <label key={name} className={containerClass}>
              <span className="text-sm font-medium text-slate-600">{label}</span>
              <select
                value={value}
                onChange={(event) => onChange(name, event.target.value)}
                disabled={disabled}
                className="select select-bordered w-full"
              >
                <option value="" disabled>
                  {placeholder || 'Select an option'}
                </option>
                {(options || []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <label key={name} className={containerClass}>
            <span className="text-sm font-medium text-slate-600">{label}</span>
            <input
              type={type}
              name={name}
              placeholder={placeholder}
              value={value}
              onChange={(event) => onChange(name, event.target.value)}
              disabled={disabled}
              min={min}
              max={max}
              step={step}
              inputMode={inputMode}
              pattern={pattern}
              className="input input-bordered"
            />
          </label>
        );
      })}
      <div className="md:col-span-3 flex items-center justify-between">
        <div>{footerRight || null}</div>
        {showSubmit ? (
          <button
            type="submit"
            className="btn btn-primary px-6 gap-2"
            disabled={submitLoading}
          >
            {submitLoading ? (
              <>
                <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              submitLabel
            )}
          </button>
        ) : null}
      </div>
    </form>
  </section>
);

export default EntityForm;
