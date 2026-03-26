import React, { useEffect, useState } from 'react';
import client from '../api/client.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});

const IncomeExpensePage = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ type: 'income', description: '', amount: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/income-expenses');
      setEntries(res.data);
    } catch (err) {
      setError('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      // Remove all non-digit except dot
      let raw = value.replace(/[^\d.]/g, '');
      // Prevent multiple dots
      const dotParts = raw.split('.');
      if (dotParts.length > 2) {
        raw = dotParts[0] + '.' + dotParts.slice(1).join('');
      }
      // Format with commas for thousands
      const parts = raw.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const formatted = parts.join('.');
      setForm({ ...form, [name]: formatted });
    } else {
      setForm({ ...form, [name]: value });
    }
  };


  // Edit and delete handlers
  const [editId, setEditId] = useState(null);

  const handleEdit = (entry) => {
    setEditId(entry.id);
    setForm({
      type: entry.type,
      description: entry.description,
      amount: Number(entry.amount).toLocaleString('en-LK'),
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    setLoading(true);
    setError(null);
    try {
      await client.delete(`/income-expenses/${id}`);
      fetchEntries();
    } catch (err) {
      setError('Failed to delete entry');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Remove commas before sending
      if (editId) {
        await client.put(`/income-expenses/${editId}`, {
          ...form,
          amount: parseFloat(form.amount.replace(/,/g, '')),
        });
      } else {
        await client.post('/income-expenses', {
          ...form,
          amount: parseFloat(form.amount.replace(/,/g, '')),
        });
      }
      setForm({ type: 'income', description: '', amount: '' });
      setEditId(null);
      fetchEntries();
    } catch (err) {
      setError(err.message || 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate totals
  const totalIncome = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + Number(e.amount), 0);
  const totalExpense = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">Income & Expense Records</h1>

      <form className="flex flex-col gap-3 md:flex-row md:items-end items-start" onSubmit={handleSubmit}>
        {/* Input fields */}
        <div className="flex flex-col md:flex-row gap-3 flex-1">
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className="select select-bordered"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <input
            name="description"
            value={form.description}
            onChange={handleChange}
            className="input input-bordered"
            placeholder="Description"
            required
          />
          <input
            name="amount"
            value={form.amount}
            onChange={handleChange}
            className="input input-bordered"
            placeholder="Amount"
            inputMode="decimal"
            required
          />
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : (editId ? 'Update Entry' : 'Add Entry')}
          </button>
          <button
            type="button"
            className="btn btn-secondary ml-2"
            disabled={submitting}
            onClick={() => {
              setForm({ type: 'income', description: '', amount: '' });
              setEditId(null);
            }}
          >
            Clear
          </button>
        </div>
        {/* Inline tiles */}
        <div className="flex flex-row gap-2 mt-2 md:mt-0 md:ml-4">
          <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 shadow-sm min-w-[110px]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-green-700">Total Income</p>
            <p className="text-lg font-bold text-green-900">{currencyFormatter.format(totalIncome)}</p>
          </div>
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 shadow-sm min-w-[110px]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700">Total Expense</p>
            <p className="text-lg font-bold text-red-900">{currencyFormatter.format(totalExpense)}</p>
          </div>
        </div>
      </form>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full mt-4">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>Amount</th>
              <th>By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6">Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan="6">No records found.</td></tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.created_at).toLocaleString()}</td>
                  <td className={entry.type === 'income' ? 'text-green-600' : 'text-red-600'}>{entry.type}</td>
                  <td>{entry.description}</td>
                  <td>{currencyFormatter.format(entry.amount)}</td>
                  <td>{entry.user?.name || '—'}</td>
                  <td>
                    <button
                      className="btn btn-xs btn-outline btn-info mr-1"
                      onClick={() => handleEdit(entry)}
                    >Edit</button>
                    <button
                      className="btn btn-xs btn-outline btn-error"
                      onClick={() => handleDelete(entry.id)}
                    >Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default IncomeExpensePage;
