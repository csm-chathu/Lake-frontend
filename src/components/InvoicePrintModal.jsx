import { useMemo } from 'react';
import JsBarcode from 'jsbarcode';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';

const formatValue = (formatter, value) => {
  try {
    const numeric = typeof value === 'number' ? value : Number(value) || 0;
    return formatter.format(numeric);
  } catch (error) {
    return String(value ?? '0');
  }
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const buildBarcodeSvgMarkup = (value) => {
  const barcodeValue = String(value || '').trim();
  if (!barcodeValue || typeof document === 'undefined') {
    return '';
  }

  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, barcodeValue, {
      format: 'CODE128',
      lineColor: '#111827',
      width: 1.6,
      height: 44,
      displayValue: true,
      fontSize: 12,
      margin: 4,
      background: '#ffffff'
    });
    return svg.outerHTML;
  } catch (error) {
    return '';
  }
};

const InvoicePrintModal = ({
  open,
  invoice,
  onClose = () => {},
  currencyFormatter = null,
  onSendSms,
  showDoctorCharge = true,
  smsSending = false,
  smsStatus = null,
  smsMessage = ''
}) => {
  if (!open || !invoice) {
    return null;
  }

  const { settings } = useClinicSettings();
  const clinicName = settings?.name;
  const clinicPhone = settings?.phone;
  const clinicAddress = settings?.address;
  const currencyCode = settings?.currency_code || 'LKR';

  const formatter = useMemo(
    () => currencyFormatter || new Intl.NumberFormat('en-LK', { style: 'currency', currency: currencyCode }),
    [currencyFormatter, currencyCode]
  );

  const invoiceReference = useMemo(
    () => String(invoice?.invoiceReference || invoice?.saleReference || '').trim(),
    [invoice]
  );

  const barcodeMarkup = useMemo(
    () => buildBarcodeSvgMarkup(invoiceReference),
    [invoiceReference]
  );

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleThermalPrint = () => {
    const receipt = {
      clinicName,
      phone: clinicPhone,
      address: clinicAddress,
      date: new Date().toLocaleString(),
      invoiceReference,
      doctorCharge: invoice.doctorCharge,
      surgeryCharge: invoice.surgeryCharge,
      otherCharge: invoice.otherCharge,
      medicinesSubtotal: invoice.medicinesSubtotal,
      discount: invoice.discount,
      total: invoice.estimated,
      patient: invoice.patientName || 'Unknown patient'
    };
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) {
      return;
    }

    // build line rows for print, showing only total amount (no unit)
    const rows = lineItems.map(item => {
      const total = item.qty * item.unit;
      return `<div>${item.label} (x${item.qty}) : ${formatValue(formatter, total)}</div>`;
    }).join('');

    const barcodeSection = receipt.invoiceReference && barcodeMarkup
      ? `<div class="center" style="margin-top:8px"><div style="font-size:11px;margin-bottom:2px">Invoice: ${escapeHtml(receipt.invoiceReference)}</div>${barcodeMarkup}</div>`
      : '';

    const content = `
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt</title>
  <style>
    body { font-family: monospace; font-size:12px; margin:0; padding:8px; }
    .center { text-align:center; }
    .divider { border-top:1px dashed #000; margin:8px 0; }
    .right { text-align:right; }
  </style>
</head>
<body>
  <div class="center">
    <div style="font-weight:700; font-size:14px">${receipt.clinicName}</div>
    <div>${receipt.address}</div>
    <div>Tel: ${receipt.phone}</div>
  </div>
  <div class="divider"></div>
  <div>Patient: ${receipt.patient}</div>
  <div>Date: ${receipt.date}</div>
  ${receipt.invoiceReference ? `<div>Invoice Ref: ${escapeHtml(receipt.invoiceReference)}</div>` : ''}
  <div class="divider"></div>
  ${rows}
  <div>Discount: <span class="right">${receipt.discount > 0 ? '-' + formatValue(formatter, receipt.discount) : '—'}</span></div>
  <div class="divider"></div>
  <div style="font-weight:700">Total: <span class="right">${formatValue(formatter, receipt.total)}</span></div>
  <div class="divider"></div>
  <div class="center">Thank you for choosing ${receipt.clinicName}</div>
  ${barcodeSection ? `<div class="divider"></div>${barcodeSection}` : ''}
  <script>
    setTimeout(() => { window.print(); setTimeout(() => window.close(), 100); }, 200);
  </script>
</body>
</html>
`;
    win.document.open();
    win.document.write(content);
    win.document.close();
  };

  // build table rows for line items if provided
  const lineItems = useMemo(() => {
    if (Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0) {
      return invoice.lineItems.map((item) => ({
        label: item.label || 'Item',
        qty: Number(item.qty) || 0,
        unit: Number(item.unit) || 0
      }));
    }

    const items = [];
    // only show combined medicine charge
    if (invoice.medicinesSubtotal != null) {
      const qty = Array.isArray(invoice.medicines) ? invoice.medicines.length : 1;
      items.push({ label: 'Medicine charge', qty, unit: invoice.medicinesSubtotal });
    }
    // include doctor and surgery as pseudo-items for display
    if (showDoctorCharge) {
      items.push({ label: 'Doctor charge', qty: 1, unit: invoice.doctorCharge || 0 });
    }
    if (invoice.surgeryCharge) {
      items.push({ label: 'Surgery charge', qty: 1, unit: invoice.surgeryCharge });
    }
    if (invoice.otherCharge) {
      const reasonSuffix = invoice.otherChargeReason ? ` (${invoice.otherChargeReason})` : '';
      items.push({ label: `Other/service charge${reasonSuffix}`, qty: 1, unit: invoice.otherCharge });
    }
    return items;
  }, [invoice, showDoctorCharge]);

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + (Number(item.unit) || 0) * (Number(item.qty) || 0), 0),
    [lineItems]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} style={{marginTop:'-35px'}}/>
      <div className="z-50 w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-center">{clinicName || 'Clinic Invoice'}</h2>
        <div className="mb-4 text-sm text-center">
          {clinicAddress && <div>{clinicAddress}</div>}
          {clinicPhone && <div>Tel: {clinicPhone}</div>}
        </div>
        <div className="mb-4 text-sm">
          <div>Patient: <strong>{invoice.patientName}</strong></div>
          <div>Date: {new Date().toLocaleString()}</div>
          {invoiceReference && <div>Invoice Ref: <strong>{invoiceReference}</strong></div>}
        </div>
        <table className="w-full mb-4 text-sm">
          <thead>
            <tr>
              <th className="text-left">Description</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => (
              <tr key={idx} className="border-t">
                <td>{item.label} <span className="text-xs text-slate-500">(x{item.qty})</span></td>
                <td className="text-right">{formatValue(formatter, item.unit * item.qty)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td colSpan="1" className="text-right">Subtotal</td>
              <td className="text-right">{formatValue(formatter, subtotal)}</td>
            </tr>
            <tr className="text-sm">
              <td colSpan="1" className="text-right">Discount</td>
              <td className="text-right">{invoice.discount > 0 ? `- ${formatValue(formatter, invoice.discount)}` : '—'}</td>
            </tr>
            <tr className="border-t text-lg font-bold">
              <td colSpan="1" className="text-right">Total</td>
              <td className="text-right">{formatValue(formatter, invoice.estimated)}</td>
            </tr>
          </tfoot>
        </table>
        {smsMessage && (
          <p className={`mb-4 text-sm ${smsStatus === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {smsMessage}
          </p>
        )}
        {barcodeMarkup && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <div className="text-[11px] text-slate-500 text-center mb-1">Scan this barcode for customer return</div>
            <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: barcodeMarkup }} />
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {/* {onSendSms && (
            <button
              className="btn btn-secondary"
              onClick={onSendSms}
              disabled={smsSending}
            >
              {smsSending ? 'Sending…' : 'Send SMS'}
            </button>
          )} */}
          <button className="btn btn-primary" onClick={handleThermalPrint}>Print Now</button>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrintModal;
