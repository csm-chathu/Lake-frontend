import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [isPrinting, setIsPrinting] = useState(false);

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

  // build table rows for line items if provided
  const lineItems = useMemo(() => {
    if (!invoice) return [];
    if (Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0) {
      return invoice.lineItems.map((item) => ({
        label: item.label || 'Item',
        qty: Number(item.qty) || 0,
        unit: Number(item.unit) || 0
      }));
    }

    const items = [];
    if (invoice.medicinesSubtotal != null) {
      const qty = Array.isArray(invoice.medicines) ? invoice.medicines.length : 1;
      items.push({ label: 'Medicine charge', qty, unit: invoice.medicinesSubtotal });
    }
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

  const rawLogoPreview = settings?.logo_url || '';
  const logoUrl = rawLogoPreview
    ? (() => { try { return new URL(rawLogoPreview, window.location.href).href; } catch { return rawLogoPreview; } })()
    : '';

  if (!open || !invoice) {
    return null;
  }

  const buildReceiptHtml = () => {
    const rawLogo = settings?.logo_url || '';
    const logoUrl = rawLogo
      ? (() => { try { return new URL(rawLogo, window.location.href).href; } catch { return rawLogo; } })()
      : '';
    const logoHtml = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="logo" style="max-width:90px;max-height:60px;object-fit:contain;margin-bottom:4px" />`
      : '';
    const date = new Date().toLocaleString();
    const patient = invoice.patientName || 'Walk-in Customer';
    const discount = Number(invoice.discount) || 0;
    const total = Number(invoice.estimated) || 0;
    const subtotalVal = lineItems.reduce((s, i) => s + i.qty * i.unit, 0);
    const itemRows = lineItems.map((item) => {
      const lineTotal = item.qty * item.unit;
      const detail = item.qty > 1 ? ` (${item.qty} x ${formatValue(formatter, item.unit)})` : '';
      return `<tr>
        <td style="padding:4px 2px">${escapeHtml(item.label)}${escapeHtml(detail)}</td>
        <td style="text-align:right;padding:4px 2px;white-space:nowrap">${formatValue(formatter, lineTotal)}</td>
      </tr>`;
    }).join('');
    const barcodeSection = invoiceReference && barcodeMarkup
      ? `<div style="margin-top:8px;text-align:center"><div style="font-size:18px;margin-bottom:2px">Ref: ${escapeHtml(invoiceReference)}</div>${barcodeMarkup}</div>`
      : '';

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Receipt</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { width: 80mm !important; margin: 0 !important; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #111; padding: 3mm 2mm; page-break-inside: avoid; }
  .center { text-align: center; }
  .dashed { border: none; border-top: 1px dashed #555; margin: 4px 0; }
  .solid  { border: none; border-top: 2px solid #111; margin: 4px 0; }
  .clinic-name { font-size: 15px; font-weight: 700; }
  .clinic-sub  { font-size: 10px; color: #333; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 11px; text-transform: uppercase; padding: 3px 2px; border-bottom: 1px solid #555; }
  td { font-size: 12px; vertical-align: top; padding: 3px 2px; }
  .total-row td { font-size: 16px; font-weight: 700; padding-top: 4px; }
  .meta { font-size: 12px; margin: 3px 0; }
  .footer { font-size: 11px; text-align: center; margin-top: 6px; }
</style>
</head><body>
  <div class="center">
    ${logoHtml}
    <div class="clinic-name">${escapeHtml(clinicName || 'Clinic')}</div>
    ${clinicAddress ? `<div class="clinic-sub">${escapeHtml(clinicAddress)}</div>` : ''}
    ${clinicPhone ? `<div class="clinic-sub">Tel: ${escapeHtml(clinicPhone)}</div>` : ''}
  </div>
  <hr class="solid"/>
  <div class="meta">Date&nbsp;&nbsp;: ${date}</div>
  <div class="meta">Patient: ${escapeHtml(patient)}</div>
  ${invoiceReference ? `<div class="meta">Ref&nbsp;&nbsp;&nbsp;: ${escapeHtml(invoiceReference)}</div>` : ''}
  <hr class="dashed"/>
  <table>
    <thead><tr>
      <th style="text-align:left">Item</th>
      <th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="dashed"/>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${formatValue(formatter, subtotalVal)}</td></tr>
    ${discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">- ${formatValue(formatter, discount)}</td></tr>` : ''}
  </table>
  <hr class="solid"/>
  <table>
    <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${formatValue(formatter, total)}</td></tr>
  </table>
  <hr class="dashed"/>
  <div class="footer"><div>*** Thank you for visiting ***</div><div>${escapeHtml(clinicName || 'Clinic')}</div></div>
  ${barcodeSection}
</body></html>`;
  };

  const handleThermalPrint = async () => {
    setIsPrinting(true);
    try {
      if (window.electronAPI?.printReceipt) {
        const config = await window.electronAPI.getPrinterConfig().catch(() => ({}));
        const printerName = config?.pos?.name || '';
        const result = await window.electronAPI.printReceipt(buildReceiptHtml(), printerName);
        console.log('[printReceipt] printer:', printerName, '| result:', result);
        return;
      }

      // Browser fallback
      const win = window.open('', '_blank', 'width=360,height=700');
      if (!win) return;
      const html = buildReceiptHtml().replace('</body>', `<script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},200);},300);};<\/script></body>`);
      win.document.open();
      win.document.write(html);
      win.document.close();
    } finally {
      setIsPrinting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      {/* Receipt-style preview card */}
      <div className="relative z-50 w-[320px] rounded-lg bg-white shadow-2xl font-mono text-[12px] text-gray-900 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 border-b border-dashed border-gray-400 px-4 py-4 text-center">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="logo"
              className="mx-auto mb-2"
              style={{ maxHeight: 64, maxWidth: 120, objectFit: 'contain' }}
            />
          )}
          <div className="text-[15px] font-bold tracking-wide">{clinicName || 'Clinic'}</div>
          {clinicAddress && <div className="text-[11px] text-gray-600 mt-0.5">{clinicAddress}</div>}
          {clinicPhone && <div className="text-[11px] text-gray-600">Tel: {clinicPhone}</div>}
        </div>

        {/* Meta */}
        <div className="px-4 py-2 border-b border-dashed border-gray-400 space-y-0.5">
          <div>Date&nbsp;&nbsp; : {new Date().toLocaleString()}</div>
          <div>Patient : <strong>{invoice.patientName || 'Walk-in Customer'}</strong></div>
          {invoiceReference && <div>Ref&nbsp;&nbsp;&nbsp;&nbsp; : <strong>{invoiceReference}</strong></div>}
        </div>

        {/* Items */}
        <div className="px-4 py-2 border-b border-dashed border-gray-400">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase text-gray-500 border-b border-gray-300">
                <th className="text-left py-1">Item</th>
                <th className="text-center py-1">Qty</th>
                <th className="text-right py-1">Unit</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="py-1 pr-1 leading-tight">{item.label}</td>
                  <td className="text-center py-1">{item.qty}</td>
                  <td className="text-right py-1 whitespace-nowrap">{formatValue(formatter, item.unit)}</td>
                  <td className="text-right py-1 whitespace-nowrap">{formatValue(formatter, item.unit * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-4 py-2 border-b border-dashed border-gray-400">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatValue(formatter, subtotal)}</span>
          </div>
          {Number(invoice.discount) > 0 && (
            <div className="flex justify-between text-rose-600">
              <span>Discount</span>
              <span>- {formatValue(formatter, invoice.discount)}</span>
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-b-2 border-gray-800">
          <div className="flex justify-between text-[15px] font-bold">
            <span>TOTAL</span>
            <span>{formatValue(formatter, invoice.estimated)}</span>
          </div>
        </div>

        {/* Barcode */}
        {barcodeMarkup && (
          <div className="px-4 py-2 border-b border-dashed border-gray-400 text-center">
            <div className="text-[10px] text-gray-400 mb-1">Scan for return / exchange</div>
            <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: barcodeMarkup }} />
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 text-center text-[11px] text-gray-500 border-b border-dashed border-gray-400">
          <div className="font-semibold">*** Thank you for visiting ***</div>
          <div>{clinicName}</div>
        </div>

        {smsMessage && (
          <div className={`px-4 py-2 text-[11px] ${smsStatus === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {smsMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 px-4 py-3 bg-gray-50">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={isPrinting}>Close</button>
          <button className="btn btn-primary btn-sm" onClick={handleThermalPrint} disabled={isPrinting}>
            {isPrinting
              ? <><span className="loading loading-spinner loading-xs" /> Printing...</>
              : '🖨 Print'}
          </button>
        </div>
      </div>
    </div>
  , document.body);
};

export default InvoicePrintModal;
