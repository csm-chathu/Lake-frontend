import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';
import Card from '../components/Card.jsx';

const fetchLogs = async () => {
  const { data } = await client.get('/sms-logs');
  return data;
};

const fetchLogCount = async () => {
  const { data } = await client.get('/sms-logs/count');
  return data.count || 0;
};

const SmsLogsPage = () => {
  const { data: logs = [], isLoading } = useQuery({ queryKey: ['smsLogs'], queryFn: fetchLogs });
  const { data: totalCount = 0 } = useQuery({ queryKey: ['smsLogsCount'], queryFn: fetchLogCount, staleTime: 60_000 });
  const [selectedLog, setSelectedLog] = useState(null);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800">SMS Activity</h1>
          <p className="text-sm text-slate-500">Audit trail of SMS invoices and reminders sent through the clinic system.</p>
        </div>
        <Card className="min-w-[180px] text-center">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total sent</p>
          <p className="text-3xl font-bold text-slate-900">{totalCount}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Recipient</th>
                <th>Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-500">
                    Loading logs…
                  </td>
                </tr>
              )}
              {!isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-500">
                    No SMS activity recorded yet.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-sm text-slate-600">{formatDate(log.created_at)}</td>
                  <td className="text-sm font-medium">{log.sms_type || 'General'}</td>
                  <td className="text-sm">
                    <div className="font-semibold text-slate-800">{log.recipient_name || '—'}</div>
                    <div className="text-xs text-slate-500">{log.provider}</div>
                  </td>
                  <td className="text-sm">{log.recipient_contact}</td>
                  <td className="text-sm">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="btn btn-sm btn-primary"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-semibold text-slate-800">SMS Details</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-sm btn-ghost"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Sent On</p>
                  <p className="mt-1 text-sm text-slate-800">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Type</p>
                  <p className="mt-1 text-sm text-slate-800">{selectedLog.sms_type || 'General'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Recipient Name</p>
                  <p className="mt-1 text-sm text-slate-800">{selectedLog.recipient_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Contact</p>
                  <p className="mt-1 text-sm text-slate-800">{selectedLog.recipient_contact}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Provider</p>
                  <p className="mt-1 text-sm text-slate-800">{selectedLog.provider || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Status</p>
                  <p className="mt-1 text-sm text-slate-800">{selectedLog.status || 'Sent'}</p>
                </div>
              </div>

              {/* Content */}
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">Content</p>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <pre className="whitespace-pre-wrap break-words text-sm text-slate-700 font-mono">
                    {JSON.stringify(safeParse(selectedLog.content), null, 2)}
                  </pre>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="btn btn-outline btn-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
};

const safeParse = (raw) => {
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return { message: raw };
  }
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return date.toLocaleString();
};

export default SmsLogsPage;
