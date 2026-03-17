import React, { useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';

const emptyForm = { id: null, name: '', sku: '', quantity: 0, purchase_price: 0, sale_price: 0, notes: '' };
const emptyBatchForm = { batch_number: '', expiry_date: '', quantity: 0, cost_price: 0, notes: '' };
const emptyAdjustmentForm = { type: 'in', quantity: 0, reason: '', stock_batch_id: '' };

const StockPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [batches, setBatches] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [batchForm, setBatchForm] = useState(emptyBatchForm);
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState(emptyAdjustmentForm);
  const [panelLoading, setPanelLoading] = useState(false);
  const itemFormRef = useRef(null);
  const batchSectionRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/stock');
      setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadItemPanel = async (itemId) => {
    setPanelLoading(true);
    try {
      const [batchesRes, adjustmentsRes] = await Promise.all([
        client.get(`/stock/${itemId}/batches`),
        client.get(`/stock/${itemId}/adjustments`)
      ]);
      setBatches(batchesRes.data || []);
      setAdjustments(adjustmentsRes.data || []);
    } finally {
      setPanelLoading(false);
    }
  };

  const stats = {
    totalItems: items.length,
    totalQuantity: items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
    totalStockValue: items.reduce((s, it) => s + ((Number(it.purchase_price) || 0) * (Number(it.quantity) || 0)), 0)
  };
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      return (it.name || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q);
    });
  }, [items, query]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name.includes('price') || name === 'quantity' ? Number(value) : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      await client.put(`/stock/${form.id}`, form);
    } else {
      await client.post('/stock', form);
    }
    setForm(emptyForm);
    setEditing(false);
    load();
  };

  const edit = (item) => {
    setForm(item);
    setEditing(true);
    itemFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const remove = async (id) => {
    if (!confirm('Delete stock item?')) return;
    await client.delete(`/stock/${id}`);
    if (selectedItem?.id === id) {
      setSelectedItem(null);
      setBatches([]);
      setAdjustments([]);
      setBatchForm(emptyBatchForm);
      setAdjustmentForm(emptyAdjustmentForm);
    }
    load();
  };

  const selectItem = async (item) => {
    setSelectedItem(item);
    setBatchForm(emptyBatchForm);
    setEditingBatchId(null);
    setAdjustmentForm(emptyAdjustmentForm);
    await loadItemPanel(item.id);
  };

  const submitBatch = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    const payload = {
      ...batchForm,
      quantity: Number(batchForm.quantity) || 0,
      cost_price: Number(batchForm.cost_price) || 0,
      expiry_date: batchForm.expiry_date || null
    };

    if (editingBatchId) {
      await client.put(`/stock/${selectedItem.id}/batches/${editingBatchId}`, payload);
    } else {
      await client.post(`/stock/${selectedItem.id}/batches`, payload);
    }

    setBatchForm(emptyBatchForm);
    setEditingBatchId(null);
    const itemRes = await client.get(`/stock/${selectedItem.id}`);
    setSelectedItem(itemRes.data);
    await Promise.all([load(), loadItemPanel(selectedItem.id)]);
  };

  const editBatch = (batch) => {
    setEditingBatchId(batch.id);
    setBatchForm({
      batch_number: batch.batch_number || '',
      expiry_date: batch.expiry_date || '',
      quantity: batch.quantity ?? 0,
      cost_price: batch.cost_price ?? 0,
      notes: batch.notes || ''
    });
    batchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const deleteBatch = async (batch) => {
    if (!selectedItem) return;
    if (!confirm(`Delete batch ${batch.batch_number}?`)) return;

    await client.delete(`/stock/${selectedItem.id}/batches/${batch.id}`);

    if (editingBatchId === batch.id) {
      setEditingBatchId(null);
      setBatchForm(emptyBatchForm);
    }

    const itemRes = await client.get(`/stock/${selectedItem.id}`);
    setSelectedItem(itemRes.data);
    await Promise.all([load(), loadItemPanel(selectedItem.id)]);
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    const res = await client.post(`/stock/${selectedItem.id}/adjust`, {
      type: adjustmentForm.type,
      quantity: Number(adjustmentForm.quantity) || 0,
      reason: adjustmentForm.reason || null,
      stock_batch_id: adjustmentForm.stock_batch_id || null
    });

    setSelectedItem(res.data?.item || selectedItem);
    setAdjustmentForm(emptyAdjustmentForm);
    await Promise.all([load(), loadItemPanel(selectedItem.id)]);
  };

  return (
    <div className="p-6">
      <h2 className="mb-4 text-2xl font-semibold">Stock Management</h2>

      <div className="mb-4 flex gap-4">
        <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-primary">
          <div className="text-sm">Items</div>
          <div className="text-xl font-semibold">{stats.totalItems}</div>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-700">
          <div className="text-sm">Total qty</div>
          <div className="text-xl font-semibold">{stats.totalQuantity}</div>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
          <div className="text-sm">Stock value</div>
          <div className="text-xl font-semibold">{stats.totalStockValue.toFixed(2)}</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form ref={itemFormRef} onSubmit={handleSubmit} className="col-span-1 space-y-3 rounded-md border border-slate-200 bg-white p-4 text-slate-900">
          <div>
            <label className="block text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
            <input name="name" placeholder="e.g. Canine Dewormer 50mg" value={form.name} onChange={handleChange} className="input input-sm w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">SKU</label>
            <input name="sku" placeholder="e.g. CD-50-01" value={form.sku} onChange={handleChange} className="input input-sm w-full" />
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Quantity</label>
              <input name="quantity" min="0" step="1" value={form.quantity ?? 0} onChange={handleChange} className="input input-sm w-full border border-slate-200 focus:border-primary focus:ring-primary/30" type="number" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Purchase price</label>
              <input name="purchase_price" min="0" step="0.01" placeholder="0.00" value={form.purchase_price ?? 0} onChange={handleChange} className="input input-sm w-full border border-slate-200 focus:border-amber-400 focus:ring-amber-200" type="number" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Sale price</label>
              <input name="sale_price" min="0" step="0.01" placeholder="0.00" value={form.sale_price ?? 0} onChange={handleChange} className="input input-sm w-full border border-slate-200 focus:border-emerald-500 focus:ring-emerald-200" type="number" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <input name="notes" placeholder="Batch, expiry, supplier notes" value={form.notes} onChange={handleChange} className="input input-sm w-full" />
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-primary btn-sm" type="submit">{editing ? 'Update' : 'Create'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setForm(emptyForm); setEditing(false); }}>Reset</button>
          </div>
        </form>

        <div className="col-span-2 overflow-auto rounded-md border border-slate-200 bg-white p-4 text-slate-900">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold">Items</h3>
            <div className="flex items-center gap-2">
              <input aria-label="Search stock" placeholder="Search by name or SKU" value={query} onChange={(e) => setQuery(e.target.value)} className="input input-sm" />
              <button className="btn btn-sm btn-ghost" onClick={() => { setQuery(''); }}>Clear</button>
            </div>
          </div>
          {loading ? <div>Loading…</div> : (
            filtered.length === 0 ? (
              <div className="text-sm text-slate-600">No stock items found. Use the form to add a new item (Name and Quantity are required).</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-primary/5">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-primary">Name</th>
                      <th className="px-3 py-2 text-left font-medium">SKU</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Purchase</th>
                      <th className="px-3 py-2 text-right font-medium">Sale</th>
                      <th className="px-3 py-2 text-left font-medium">Notes</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filtered.map((it, idx) => (
                      <tr key={it.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2">{it.sku}</td>
                        <td className="px-3 py-2 text-right">{it.quantity}</td>
                        <td className="px-3 py-2 text-right">{Number(it.purchase_price).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{Number(it.sale_price).toFixed(2)}</td>
                        <td className="px-3 py-2">{it.notes}</td>
                        <td className="px-3 py-2 text-right">
                          <button className="btn btn-xs btn-ghost mr-2" onClick={() => edit(it)}>Edit</button>
                          <button className="btn btn-xs btn-outline mr-2" onClick={() => selectItem(it)}>Batches</button>
                          <button className="btn btn-xs btn-error" onClick={() => remove(it.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        <div className="col-span-3 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section ref={batchSectionRef} className="rounded-md border border-slate-200 bg-white p-4 text-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Batch Management</h3>
              <span className="text-xs text-slate-500">
                {selectedItem ? `Item: ${selectedItem.name}` : 'Select an item from table'}
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              To add a batch number: click <span className="font-semibold">Batches</span> on an item, then fill the <span className="font-semibold">Batch number</span> field below.
            </p>

            <form onSubmit={submitBatch} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                className="input input-sm w-full"
                placeholder="Batch number"
                value={batchForm.batch_number}
                onChange={(e) => setBatchForm((prev) => ({ ...prev, batch_number: e.target.value }))}
                disabled={!selectedItem}
                required
              />
              <input
                type="date"
                className="input input-sm w-full"
                value={batchForm.expiry_date}
                onChange={(e) => setBatchForm((prev) => ({ ...prev, expiry_date: e.target.value }))}
                disabled={!selectedItem}
              />
              <input
                type="number"
                min="0"
                className="input input-sm w-full"
                placeholder="Batch quantity"
                value={batchForm.quantity}
                onChange={(e) => setBatchForm((prev) => ({ ...prev, quantity: e.target.value }))}
                disabled={!selectedItem}
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="input input-sm w-full"
                placeholder="Cost price"
                value={batchForm.cost_price}
                onChange={(e) => setBatchForm((prev) => ({ ...prev, cost_price: e.target.value }))}
                disabled={!selectedItem}
              />
              <input
                className="input input-sm w-full md:col-span-2"
                placeholder="Batch notes"
                value={batchForm.notes}
                onChange={(e) => setBatchForm((prev) => ({ ...prev, notes: e.target.value }))}
                disabled={!selectedItem}
              />
              <div className="md:col-span-2">
                <button type="submit" className="btn btn-sm btn-primary mr-2" disabled={!selectedItem}>
                  {editingBatchId ? 'Update batch' : 'Add batch'}
                </button>
                {editingBatchId && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setEditingBatchId(null);
                      setBatchForm(emptyBatchForm);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {panelLoading ? (
              <div className="text-sm text-slate-500">Loading batches…</div>
            ) : batches.length === 0 ? (
              <div className="text-sm text-slate-500">No batches found for selected item.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-2 text-left">Batch</th>
                      <th className="px-2 py-2 text-left">Expiry</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Cost</th>
                      <th className="px-2 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.id}>
                        <td className="px-2 py-2">{batch.batch_number}</td>
                        <td className="px-2 py-2">{batch.expiry_date || '—'}</td>
                        <td className="px-2 py-2 text-right">{batch.quantity}</td>
                        <td className="px-2 py-2 text-right">{Number(batch.cost_price || 0).toFixed(2)}</td>
                        <td className="px-2 py-2 text-right">
                          <button className="btn btn-xs btn-ghost mr-1" onClick={() => editBatch(batch)}>Edit</button>
                          <button className="btn btn-xs btn-error" onClick={() => deleteBatch(batch)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 text-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Stock Adjustment</h3>
              <span className="text-xs text-slate-500">
                {selectedItem ? `Current qty: ${selectedItem.quantity}` : 'Select an item from table'}
              </span>
            </div>

            <form onSubmit={submitAdjustment} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select
                className="select select-sm select-bordered"
                value={adjustmentForm.type}
                onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, type: e.target.value }))}
                disabled={!selectedItem}
              >
                <option value="in">Increase (+)</option>
                <option value="out">Decrease (-)</option>
                <option value="set">Set exact qty</option>
              </select>
              <input
                type="number"
                min="0"
                className="input input-sm w-full"
                placeholder="Quantity"
                value={adjustmentForm.quantity}
                onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, quantity: e.target.value }))}
                disabled={!selectedItem}
                required
              />
              <select
                className="select select-sm select-bordered md:col-span-2"
                value={adjustmentForm.stock_batch_id}
                onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, stock_batch_id: e.target.value }))}
                disabled={!selectedItem}
              >
                <option value="">Apply to item only (no batch)</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_number} (qty: {batch.quantity})
                  </option>
                ))}
              </select>
              <input
                className="input input-sm w-full md:col-span-2"
                placeholder="Reason"
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, reason: e.target.value }))}
                disabled={!selectedItem}
              />
              <div className="md:col-span-2">
                <button type="submit" className="btn btn-sm btn-primary" disabled={!selectedItem}>Apply adjustment</button>
              </div>
            </form>

            {panelLoading ? (
              <div className="text-sm text-slate-500">Loading adjustments…</div>
            ) : adjustments.length === 0 ? (
              <div className="text-sm text-slate-500">No adjustments recorded for selected item.</div>
            ) : (
              <div className="max-h-64 overflow-auto rounded border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Before</th>
                      <th className="px-2 py-2 text-right">After</th>
                      <th className="px-2 py-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments.map((adjustment) => (
                      <tr key={adjustment.id} className="border-t border-slate-100">
                        <td className="px-2 py-2 uppercase">{adjustment.type}</td>
                        <td className="px-2 py-2 text-right">{adjustment.quantity}</td>
                        <td className="px-2 py-2 text-right">{adjustment.before_quantity}</td>
                        <td className="px-2 py-2 text-right">{adjustment.after_quantity}</td>
                        <td className="px-2 py-2">{adjustment.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default StockPage;
