import { useMemo, useState } from 'react';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const createEmptyMedicine = () => ({
  name: '',
  description: '',
  brands: [{ id: null, name: '', price: '' }]
});

const MedicinesPage = () => {
  const { items, loading, error, createItem, updateItem, deleteItem } = useEntityApi('medicines');
  const [formState, setFormState] = useState(() => createEmptyMedicine());
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');

  const columns = useMemo(
    () => [
      { header: 'Name', accessor: 'name' },
      {
        header: 'Description',
        accessor: 'description',
        render: (medicine) => (medicine.description ? medicine.description : '—')
      },
      {
        header: 'Brands',
        accessor: 'brands',
        render: (medicine) => {
          if (!Array.isArray(medicine.brands) || medicine.brands.length === 0) {
            return '—';
          }
          return (
            <ul className="space-y-1 text-xs text-slate-600">
              {medicine.brands.map((brand) => {
                const price = Number(brand.price);
                const formattedPrice = Number.isNaN(price)
                  ? '—'
                  : currencyFormatter.format(price);
                return (
                  <li key={brand.id}>
                    <span className="font-medium text-slate-700">{brand.name}</span> {formattedPrice}
                  </li>
                );
              })}
            </ul>
          );
        }
      }
    ],
    []
  );

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleBrandChange = (index, field, value) => {
    setFormState((prev) => {
      const brands = prev.brands.map((brand, idx) => (idx === index ? { ...brand, [field]: value } : brand));
      return { ...prev, brands };
    });
  };

  const handleAddBrand = () => {
    setFormState((prev) => ({
      ...prev,
      brands: [...prev.brands, { id: null, name: '', price: '' }]
    }));
  };

  const handleRemoveBrand = (index) => {
    setFormState((prev) => {
      const nextBrands = prev.brands.filter((_, idx) => idx !== index);
      return { ...prev, brands: nextBrands.length ? nextBrands : [{ id: null, name: '', price: '' }] };
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormError('');
    setFormState(createEmptyMedicine());
  };

  const validateForm = () => {
    const name = formState.name.trim();
    if (!name) {
      return 'Medicine name is required.';
    }

    const normalizedBrands = formState.brands.filter((brand) => brand.name.trim());
    if (!normalizedBrands.length) {
      return 'Add at least one brand for this medicine.';
    }

    for (const brand of normalizedBrands) {
      const priceValue = Number.parseFloat(brand.price);
      if (Number.isNaN(priceValue) || priceValue < 0) {
        return 'Brand prices must be zero or greater.';
      }
    }

    return '';
  };

  const buildPayload = () => {
    const normalizedBrands = formState.brands
      .filter((brand) => brand.name.trim())
      .map((brand) => {
        const priceValue = Number.parseFloat(brand.price);
        return {
          ...(brand.id ? { id: Number(brand.id) } : {}),
          name: brand.name.trim(),
          price: Number(priceValue.toFixed(2))
        };
      });

    return {
      name: formState.name.trim(),
      description: formState.description.trim(),
      brands: normalizedBrands
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const validationMessage = validateForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    const payload = buildPayload();
    const action = editingId ? updateItem(editingId, payload) : createItem(payload);
    const result = await action;

    if (result.success) {
      resetForm();
    } else if (result.message) {
      setFormError(result.message);
    }
  };

  const handleEdit = (medicine) => {
    setEditingId(medicine.id);
    setFormError('');
    setFormState({
      name: medicine.name || '',
      description: medicine.description || '',
      brands:
        Array.isArray(medicine.brands) && medicine.brands.length
          ? medicine.brands.map((brand) => ({
              id: brand.id,
              name: brand.name || '',
              price:
                brand.price !== undefined && brand.price !== null
                  ? Number(brand.price).toFixed(2)
                  : ''
            }))
          : [{ id: null, name: '', price: '' }]
    });
  };

  const handleDelete = async (id) => {
    setFormError('');
    const result = await deleteItem(id);
    if (!result.success && result.message) {
      setFormError(result.message);
    }
    if (result.success && editingId === id) {
      resetForm();
    }
  };

  const submitLabel = editingId ? 'Update medicine' : 'Add medicine';

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Medicines</h1>
        <p className="text-sm text-slate-500">
          Manage formulary entries, track brand pricing, and keep appointment billing accurate.
        </p>
      </div>

      <section className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-800">
            {editingId ? 'Update medicine' : 'Create medicine'}
          </h2>
          {editingId && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>

        {formError && (
          <div className="alert alert-error mb-4 shadow-sm">
            <span>{formError}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Medicine name</span>
              <input
                type="text"
                className="input input-bordered"
                value={formState.name}
                onChange={(event) => handleFieldChange('name', event.target.value)}
                placeholder="Antibiotic"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Description</span>
              <textarea
                className="textarea textarea-bordered min-h-[100px]"
                value={formState.description}
                onChange={(event) => handleFieldChange('description', event.target.value)}
                placeholder="Common use, dosage notes, etc."
              />
            </label>
          </div>

          <div className="rounded-xl border border-base-200 bg-base-50 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-700">Brand pricing</p>
                <p className="text-xs text-slate-500">List each brand variation with its billing price.</p>
              </div>
              <button type="button" className="btn btn-sm btn-outline" onClick={handleAddBrand}>
                Add brand
              </button>
            </div>

            <div className="space-y-3">
              {formState.brands.map((brand, index) => (
                <div key={`${brand.id || 'new'}-${index}`} className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Brand name</span>
                    <input
                      type="text"
                      className="input input-bordered input-sm"
                      value={brand.name}
                      onChange={(event) => handleBrandChange(index, 'name', event.target.value)}
                      placeholder="Brand label"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input input-bordered input-sm"
                      value={brand.price}
                      onChange={(event) => handleBrandChange(index, 'price', event.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost text-error"
                      onClick={() => handleRemoveBrand(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary px-6">
              {submitLabel}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      <EntityTable
        columns={columns}
        data={items}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="No medicines recorded yet."
      />
    </section>
  );
};

export default MedicinesPage;
