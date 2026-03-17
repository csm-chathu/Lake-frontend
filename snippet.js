  const fields = useMemo(() => {
    const list = [
      {
        name: 'patientId',
        render: () => (
          <PatientSearch
            query={patientSearchQuery}
            onQueryChange={setPatientSearchQuery}
            patients={patients}
            onSelectPatient={handlePatientSelect}
            onCreatePatient={handleQuickCreatePatient}
            selectedPatient={selectedPatient}
            renderCreateForm={renderQuickPatientForm}
          />
        ),
        fullWidth: true
      }
    ];

    const patientSelected = Boolean(formState.patientId || selectedPatient);
    if (patientSelected) {
      const patientIdStr = String(formState.patientId || selectedPatient?.id || '');
      const ageParts = [];
      const years = Number.parseInt(selectedPatient?.ageYears, 10);
      const months = Number.parseInt(selectedPatient?.ageMonths, 10);
      if (!Number.isNaN(years) && years > 0) {
        ageParts.push(`${years} yr${years > 1 ? 's' : ''}`);
      }
      if (!Number.isNaN(months) && months > 0) {
        ageParts.push(`${months} mo${months > 1 ? 's' : ''}`);
      }
      const ageLabel = ageParts.length ? ageParts.join(' ') : 'Not recorded';

      list.push({
        name: '__patientProfile',
        render: () => (
          <>
            {selectedPatient && (
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-secondary flex items-center gap-1"
                  onClick={() => setShowPatientModal(true)}
                >
                  <span className="text-lg">👁️</span>
                  <span className="font-semibold">View patient info</span>
                </button>
              </div>
            )}
          </>
        ),
        fullWidth: true
      });

      if (startedTreatment) {
        list.push(
          {
            name: 'date',
            label: 'Appointment time',
            render: ({ label, value, onChange }) => {
              const currentValue = typeof value === 'string' ? value : '';
              if (!dateEditing) {
                const display = currentValue
                  ? new Date(currentValue).toLocaleString()
                  : '';
                return (
                  <>
                    <span className="text-sm font-medium text-slate-600">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{display || 'Current time'}</span>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => setDateEditing(true)}
                      >
                        Edit
                      </button>
                    </div>
                  </>
                );
              }
              return (
                <>
                  <span className="text-sm font-medium text-slate-600">{label}</span>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="datetime-local"
                      value={currentValue}
                      onChange={(event) => onChange(event.target.value)}
                      className="input input-bordered bg-white w-full sm:flex-1"
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline sm:w-auto"
                      onClick={() => onChange(getCurrentDateTimeLocal())}
                    >
                      Use current time
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost sm:w-auto"
                      onClick={() => setDateEditing(false)}
                    >
                      Done
                    </button>
                  </div>
                </>
              );
            },
            fullWidth: false,
            containerClass: 'md:col-start-2'
          },
          {
            name: 'reason',
            label: 'Reason',
            placeholder: 'Annual wellness exam',
            fullWidth: false,
            containerClass: 'md:col-start-1',
            render: ({ label, value, onChange, placeholder: reasonPlaceholder }) => {
              const currentValue = typeof value === 'string' ? value : '';
              const normalizedValue = currentValue.toLowerCase();
              return (
                <>
                  <span className="text-sm font-medium text-slate-600">{label || 'Reason'}</span>
                  <input
                    type="text"
                    value={currentValue}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={reasonPlaceholder}
                    className="input input-bordered bg-white"
                  />
                  {reasonSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {reasonSuggestions.map((suggestion) => {
                        const isActive = suggestion.toLowerCase() === normalizedValue;
                        return (
                          <button
                            type="button"
                            key={suggestion}
                            onClick={() => onChange(suggestion)}
                            className={`btn btn-xs ${
                              isActive
                                ? 'btn-primary'
                                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {suggestion}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {lastPrescription?.medicines?.length > 0 && (
                    <div className="mt-3 rounded-xl border border-base-200 bg-base-100 p-3 text-xs text-slate-600">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Previous medicines for this reason</span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          {lastPrescription.appointment?.date
                            ? new Date(lastPrescription.appointment.date).toLocaleDateString()
                            : 'Recent visit'}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {lastPrescription.medicines.map((medicine, index) => {
                          const entry = brandLookup.get(String(medicine.medicineBrandId));
                          const labelText = medicine.label || entry?.label || 'Medicine';
                          return (
                            <li key={`${medicine.medicineBrandId || 'medicine'}-${index}`} className="flex justify-between gap-3">
                              <span className="flex-1 text-slate-700">{labelText}</span>
                              <span className="text-slate-500">Qty {medicine.quantity}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </>
              );
            }
          },
          // vaccination plan UI removed
          {
            name: 'medicines',
            render: ({ value, onChange }) => (
              <AppointmentMedicineSelector
                value={value}
                onChange={onChange}
                brandOptions={brandOptions}
                brandLookup={brandLookup}
                loading={medicinesLoading}
              />
            ),
            fullWidth: true
          },
          {
            name: '__vaccineFollowUp',
            render: () => (
              <VaccineFollowUp
                hasVaccineMedicine={hasVaccineMedicine}
                vaccinationPlan={vaccinationPlan}
                formState={formState}
                updateVaccinationPlan={updateVaccinationPlan}
                firstVaccineMedicineName={firstVaccineMedicineName}
                vaccineNames={vaccineNames}
              />
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