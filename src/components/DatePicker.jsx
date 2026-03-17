import { forwardRef } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Custom input component for styling
const CustomInput = forwardRef(({ value, onClick, placeholder, className }, ref) => (
  <input
    type="text"
    className={className}
    onClick={onClick}
    value={value}
    onChange={() => {}}
    placeholder={placeholder}
    ref={ref}
    readOnly
  />
));

CustomInput.displayName = 'CustomInput';

const DatePicker = ({ selected, onChange, placeholder = 'Select date', className = 'input input-bordered input-sm', minDate = null, ...props }) => {
  return (
    <ReactDatePicker
      selected={selected}
      onChange={onChange}
      dateFormat="MMM dd, yyyy"
      placeholderText={placeholder}
      customInput={<CustomInput className={className} />}
      minDate={minDate}
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      {...props}
    />
  );
};

export default DatePicker;
