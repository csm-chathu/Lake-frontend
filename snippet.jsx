                                        onClick={() => setFormState((prev) => ({ ...prev, surgeryCharge: String(preset.value) }))}
                                      >
                                        {preset.label}
                                      </button>
                                    );
                                  })}
                                  <div className="ml-2">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={current}
                                      onChange={(e) => setFormState((prev) => ({ ...prev, surgeryCharge: e.target.value }))}
                                      placeholder="Custom"
                                      className="input input-sm input-bordered w-28"
                                    />
                                  </div>
                                </>
                              );
                            })()
                          }
                        </div>
                      </div>
                  )}

                  {/* other/service charge - manual only */}
                  <div class="mb-3 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">Other / service charge</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={typeof formState.otherCharge === 'string' ? formState.otherCharge : ''}
                      onChange={(e) => { setFormState((prev) => ({ ...prev, otherCharge: e.target.value })); }}
                      placeholder="0.00"
                      className="input input-sm input-bordered w-28"
                    />
                  </div>

              <div className="mb-3">
                <span className="text-sm font-medium text-slate-600">Discount</span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {[0, 10, 20, 30, 40, 50].map((pct) => {
                    const gross = doctorChargeValue + surgeryChargeValue + serviceChargeValue + medicinesTotal;
                    const v = Number(((gross * pct) / 100).toFixed(2));
                    const active = Number(v) === Number(discountValue);
                    return (
                      <button
                        type="button"
                        key={pct}
                        className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setFormState((prev) => ({ ...prev, discount: String(v) }))}
                      >
                        {pct === 0 ? 'None' : `${pct}%`}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {discountValue > 0 ? `Applied: ${currencyFormatter.format(discountValue)}` : 'No discount applied'}
                </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-1">
                <dt>Doctor charge</dt>
                <dd className="text-right font-medium text-slate-700">{currencyFormatter.format(doctorChargeValue)}</dd>
                <dt>Surgery charge</dt>
                <dd className="text-right font-medium text-slate-700">{currencyFormatter.format(surgeryChargeValue)}</dd>
                <dt>Other/service charge</dt>
                  <dd className="text-right font-medium text-slate-700">
                    <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">Other / service charge</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={typeof formState.otherCharge === 'string' ? formState.otherCharge : ''}
                      onChange={(e) => { setFormState((prev) => ({ ...prev, otherCharge: e.target.value })); }}
                      placeholder="0.00"
                      className="input input-sm input-bordered w-28"
                    />
                  </div>
                </dd>
              </dl>
              {formState.paymentType === 'credit' && formState.paymentStatus !== 'paid' && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                  Mark this credit visit as paid once the balance is settled.
                </p>
              )}
            </div>
          ),
          fullWidth: true
        }
      );
    }

    return list;
  }, [
    brandLookup,
    brandOptions,
    doctorChargeValue,
    surgeryChargeValue,
    discountValue,
    chargePresetsApi.items,
    surgeryChargePresetsApi.items,
    formState.paymentStatus,
    formState.paymentType,
    handlePatientSelect,
    lastPrescription,
    medicinesLoading,
    medicinesTotal,
    patientSearchQuery,
    patients,
    items,
    owners,
    currencyFormatter,
    reasonSuggestions,
    selectedPatient,
    selectedOwner,
    profileTab,
    startedTreatment,
    totalChargeEstimate,
    cloudinaryConfigured,
    editingId,
    patientReportsLoading,
    patientReportsError,
    formState.diagnosticReports,
    handleReportInputChange,
    handleReportRemove,
    reportUploadState,
    requestReportUpload,
    registerReportInputRef,
    vaccinationPlan,
    isVaccineAppointment,
    updateVaccinationPlan,
    renderQuickPatientForm,
    handleQuickCreatePatient
  ]);

  const handleChange = (name, value) => {
    // clear any previous validation error when user edits fields
    if (formError) {
