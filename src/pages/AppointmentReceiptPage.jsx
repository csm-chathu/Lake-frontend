import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, CheckCircle2, Clock, CreditCard, Banknote } from 'lucide-react';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';
import {
  CLINIC_LOGO_URL,
  CLINIC_PHONE,
  CLINIC_PHONE2,
  CLINIC_ADDRESS,
  CLINIC_EMAIL,
  CLINIC_WEBSITE,
  CLINIC_DOCTOR,
  CLINIC_DOCTOR_QUALS,
  CLINIC_DOCTOR_TITLE,
} from '../constants/branding.js';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatValue = (formatter, value) => {
  try {
    const numeric = typeof value === 'number' ? value : Number(value) || 0;
    return formatter.format(numeric);
  } catch {
    return String(value ?? '0');
  }
};

const AppointmentReceiptPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { settings } = useClinicSettings();
  const [isPrinting, setIsPrinting] = useState(false);

  const invoice = state?.invoice || null;
  const from = state?.from || 'history';
  const appointmentDate = state?.appointmentDate || null;


  const clinicName = settings?.name || 'Clinic';
  const currencyCode = settings?.currency_code || 'LKR';

  const formatter = useMemo(
    () => new Intl.NumberFormat('en-LK', { style: 'currency', currency: currencyCode }),
    [currencyCode]
  );

  const logoUrl = CLINIC_LOGO_URL
    ? `${window.location.origin}/${CLINIC_LOGO_URL.replace(/^\//, '')}`
    : '';

  const referenceLabel = invoice?.appointmentId ? `APT-${String(invoice.appointmentId).padStart(6, '0')}` : '';

  const displayDate = useMemo(() => {
    const d = appointmentDate ? new Date(appointmentDate) : new Date();
    return Number.isNaN(d.valueOf()) ? new Date() : d;
  }, [appointmentDate]);

  const lineItems = useMemo(() => {
    if (!invoice) return [];
    const items = [];
    if (invoice.doctorCharge > 0) items.push({ label: 'Doctor charge', qty: 1, unit: invoice.doctorCharge });
    if (invoice.surgeryCharge > 0) items.push({ label: 'Surgery charge', qty: 1, unit: invoice.surgeryCharge });
    if (invoice.otherCharge > 0) {
      const suffix = invoice.otherChargeReason ? ` (${invoice.otherChargeReason})` : '';
      items.push({ label: `Service charge${suffix}`, qty: 1, unit: invoice.otherCharge });
    }
    if (invoice.medicinesSubtotal > 0) {
      items.push({ label: 'Medicine total', qty: 1, unit: invoice.medicinesSubtotal });
    }
    return items;
  }, [invoice]);

  const subtotal = useMemo(() => lineItems.reduce((s, i) => s + i.qty * i.unit, 0), [lineItems]);
  const discount = Number(invoice?.discount) || 0;
  const total = Number(invoice?.estimated) || 0;

  const backLabel = from === 'appointments' ? 'Appointments' : 'Treatment History';
  const backPath = from === 'appointments' ? '/appointments' : '/appointments/history';

  const buildReceiptHtml = useCallback(() => {
    const logoHtml = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="logo" style="max-width:90px;max-height:60px;object-fit:contain;margin-bottom:4px" />`
      : '';
    const itemRows = lineItems.map((item) => {
      const lineTotal = item.qty * item.unit;
      const detail = item.qty > 1 ? ` (${item.qty} x ${formatValue(formatter, item.unit)})` : '';
      return `<tr>
        <td style="padding:4px 2px">${escapeHtml(item.label)}${escapeHtml(detail)}</td>
        <td style="text-align:right;padding:4px 2px;white-space:nowrap">${formatValue(formatter, lineTotal)}</td>
      </tr>`;
    }).join('');
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
  .meta { font-size: 12px; margin: 3px 0; display: flex; justify-content: space-between; gap: 4px; }
  .meta .k { color: #111; white-space: nowrap; }
  .meta .v { text-align: right; font-weight: 700; }
  .footer { font-size: 11px; text-align: center; margin-top: 6px; line-height: 1.6; }
</style>
</head><body>
  <div class="center">
    ${logoHtml}
    <div class="clinic-name">${escapeHtml(clinicName)}</div>
    <div class="clinic-sub">${escapeHtml(CLINIC_ADDRESS)}</div>
    <div class="clinic-sub">Tel: ${escapeHtml(CLINIC_PHONE)} / ${escapeHtml(CLINIC_PHONE2)}</div>
    <div class="clinic-sub">${escapeHtml(CLINIC_EMAIL)}</div>
    <div class="clinic-sub">${escapeHtml(CLINIC_WEBSITE)}</div>
    <div class="clinic-sub" style="margin-top:6px;font-weight:700">${escapeHtml(CLINIC_DOCTOR)}</div>
    <div class="clinic-sub">${escapeHtml(CLINIC_DOCTOR_QUALS)}</div>
    <div class="clinic-sub">${escapeHtml(CLINIC_DOCTOR_TITLE)}</div>
    <div class="clinic-sub" style="margin-top:5px;font-style:italic">Appointment Receipt</div>
  </div>
  <hr class="solid"/>
  ${referenceLabel ? `<div class="meta"><span class="k">Ref</span><span class="v">${escapeHtml(referenceLabel)}</span></div>` : ''}
  <div class="meta"><span class="k">Date</span><span class="v">${displayDate.toLocaleDateString()}</span></div>
  <div class="meta"><span class="k">Time</span><span class="v">${displayDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="meta"><span class="k">Payment</span><span class="v">${invoice?.paymentType === 'credit' ? 'Credit' : 'Cash'}</span></div>
  <div class="meta"><span class="k">Status</span><span class="v">${invoice?.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}</span></div>
  <hr class="dashed"/>
  <div class="meta"><span class="k">Patient</span><span class="v">${escapeHtml(invoice?.patientName || 'Unknown')}</span></div>
  ${invoice?.ownerName ? `<div class="meta"><span class="k">Owner</span><span class="v">${escapeHtml(invoice.ownerName)}</span></div>` : ''}
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
    <tr><td>Subtotal</td><td style="text-align:right">${formatValue(formatter, subtotal)}</td></tr>
    ${discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">- ${formatValue(formatter, discount)}</td></tr>` : ''}
  </table>
  <hr class="solid"/>
  <table>
    <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${formatValue(formatter, total)}</td></tr>
  </table>
  <hr class="dashed"/>
  <table>
    <tr><td>${invoice?.paymentType === 'credit' ? 'Credit' : 'Cash'}</td><td style="text-align:right">${formatValue(formatter, total)}</td></tr>
    <tr><td>${invoice?.paymentStatus === 'paid' ? 'Paid' : 'Pending'}</td><td style="text-align:right">${formatValue(formatter, invoice?.paymentStatus === 'paid' ? total : 0)}</td></tr>
  </table>
  <hr class="dashed"/>
  <div class="footer">
    <div>*** Thank you for visiting ***</div>
    <div>${escapeHtml(clinicName)}</div>
  </div>
</body></html>`;
  }, [logoUrl, clinicName, lineItems, formatter, invoice, displayDate, referenceLabel, subtotal, discount, total]);

  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    try {
      if (window.electronAPI?.printReceipt) {
        const config = await window.electronAPI.getPrinterConfig().catch(() => ({}));
        const printerName = config?.pos?.name || '';
        await window.electronAPI.printReceipt(buildReceiptHtml(), printerName);
        return;
      }
      const win = window.open('', '_blank', 'width=360,height=700');
      if (!win) return;
      const html = buildReceiptHtml().replace(
        '</body>',
        '<script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},200);},300);}<' + '/script></body>'
      );
      win.document.open();
      win.document.write(html);
      win.document.close();
    } finally {
      setIsPrinting(false);
    }
  }, [buildReceiptHtml]);

  // Keep a ref so the one-shot effect always calls the latest version
  const handlePrintRef = useRef(handlePrint);
  handlePrintRef.current = handlePrint;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!invoice) return; // autoprint disabled
    // Fire once on mount — no cleanup so re-renders can't cancel the timer
    setTimeout(async () => {
      await handlePrintRef.current();
      navigateRef.current('/appointments', { replace: true });
    }, 400);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!invoice) {
    return (
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-400">No receipt data found. Please complete an appointment first.</p>
        </div>
      </section>
    );
  }

  const isPaid = invoice.paymentStatus === 'paid';
  const isCredit = invoice.paymentType === 'credit';

  return (
    <section className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="inline-flex items-center gap-1.5 hover:text-slate-800 transition"
          >
            <ArrowLeft size={16} /> Back to {backLabel}
          </button>
          {referenceLabel && (
            <>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">{referenceLabel}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={isPrinting}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60"
        >
          {isPrinting
            ? <><span className="loading loading-spinner loading-xs" /> Printing...</>
            : <><Printer size={16} /> Print Receipt</>}
        </button>
      </div>

      {/* Receipt card */}
      <div className="mx-auto max-w-[480px] rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200">

        {/* Clinic header */}
        <div className="border-b border-dashed border-slate-300 bg-slate-50 px-8 py-6 text-center font-mono">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="logo"
              className="mx-auto mb-3"
              style={{ maxHeight: 72, maxWidth: 120, objectFit: 'contain' }}
            />
          )}
          <div className="text-[17px] font-bold tracking-widest uppercase text-slate-900">{clinicName}</div>
          <div className="mt-1 text-[12px] text-slate-500">{CLINIC_ADDRESS}</div>
          <div className="text-[12px] text-slate-500">Tel: {CLINIC_PHONE} / {CLINIC_PHONE2}</div>
          <div className="text-[12px] text-slate-500">{CLINIC_EMAIL}</div>
          <div className="text-[12px] text-slate-500">{CLINIC_WEBSITE}</div>
          <div className="mt-3 text-[13px] font-bold text-slate-700">{CLINIC_DOCTOR}</div>
          <div className="text-[11px] text-slate-500">{CLINIC_DOCTOR_QUALS}</div>
          <div className="text-[11px] text-slate-500">{CLINIC_DOCTOR_TITLE}</div>
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400 italic">Appointment Receipt</div>
        </div>

        {/* Meta info */}
        <div className="border-b border-dashed border-slate-300 px-6 py-4 font-mono text-[13px] space-y-1.5">
          {referenceLabel && (
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice</span>
              <span className="font-bold text-slate-900">{referenceLabel}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Date</span>
            <span className="font-semibold text-slate-800">
              {displayDate.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Time</span>
            <span className="font-semibold text-slate-800">
              {displayDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Payment</span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
              {isCredit ? <><CreditCard size={12} /> Credit</> : <><Banknote size={12} /> Cash</>}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Status</span>
            <span className={`inline-flex items-center gap-1 font-bold ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
              {isPaid ? <><CheckCircle2 size={12} /> PAID</> : <><Clock size={12} /> PENDING</>}
            </span>
          </div>
        </div>

        {/* Patient */}
        <div className="border-b border-dashed border-slate-300 px-6 py-3 font-mono text-[13px] space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Patient</span>
            <span className="font-semibold text-slate-800">{invoice.patientName || 'Unknown'}</span>
          </div>
          {invoice.ownerName && (
            <div className="flex justify-between">
              <span className="text-slate-500">Owner</span>
              <span className="font-semibold text-slate-800">{invoice.ownerName}</span>
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="border-b border-dashed border-slate-300 px-6 py-3 font-mono">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-300 text-[10px] uppercase tracking-wider text-slate-400">
                <th className="pb-1.5 text-left">Item</th>
                <th className="pb-1.5 text-center">Qty</th>
                <th className="pb-1.5 text-right">Price</th>
                <th className="pb-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-2 text-center text-slate-400 italic text-[11px]">No charge items</td>
                </tr>
              ) : lineItems.map((item, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 leading-tight text-slate-700">{item.label}</td>
                  <td className="py-1.5 text-center text-slate-700">{item.qty}</td>
                  <td className="py-1.5 text-right text-slate-700 whitespace-nowrap">{formatValue(formatter, item.unit)}</td>
                  <td className="py-1.5 text-right font-semibold text-slate-800 whitespace-nowrap">{formatValue(formatter, item.qty * item.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Subtotal / discount */}
        <div className="border-b border-dashed border-slate-300 px-6 py-3 font-mono text-[13px] space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatValue(formatter, subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-rose-600">
              <span>Discount</span>
              <span>- {formatValue(formatter, discount)}</span>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="border-b-2 border-slate-800 px-6 py-3 font-mono">
          <div className="flex justify-between text-[18px] font-bold text-slate-900">
            <span>TOTAL</span>
            <span>{formatValue(formatter, total)}</span>
          </div>
        </div>

        {/* Payment summary */}
        <div className="border-b border-dashed border-slate-300 px-6 py-3 font-mono text-[13px] space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>{isCredit ? 'Credit' : 'Cash'}</span>
            <span>{formatValue(formatter, total)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>{isPaid ? 'Paid' : 'Pending'}</span>
            <span>{formatValue(formatter, isPaid ? total : 0)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 text-center font-mono text-[12px] text-slate-500">
          <div className="font-semibold">*** Thank you for visiting ***</div>
          <div className="mt-0.5">{clinicName}</div>
        </div>
      </div>
    </section>
  );
};

export default AppointmentReceiptPage;
