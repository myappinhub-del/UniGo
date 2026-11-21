import React, { useState } from 'react';
import { Compass, X } from 'lucide-react';

interface ErrandPlannerDrawerProps {
  open: boolean;
  onClose: () => void;
  zone: string;
}

export const ErrandPlannerDrawer: React.FC<ErrandPlannerDrawerProps> = ({
  open,
  onClose,
  zone,
}) => {
  const [goal, setGoal] = useState(
    'Host a Saturday evening dinner for 6 friends: order starters, fresh fruits/drinks, book AC check beforehand, and send return parcel.'
  );
  const [budgetInr, setBudgetInr] = useState('4500');
  const [loading, setLoading] = useState(false);
  const [planText, setPlanText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/errand-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          zone,
          budgetInr: Number(budgetInr) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to plan errand');
      setPlanText(data.planText);
    } catch (err: any) {
      setError(err?.message || 'Unable to generate plan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-5 border border-neutral-200 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#16A34A]" />
            <h3 className="text-base font-bold text-[#222222]">
              Multi-Service Errand & Budget Planner
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-[#F5F6F7]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-3 mt-4">
          <div>
            <label className="block text-xs font-bold text-[#222222] mb-1">
              Describe your multi-stop errand or event ({zone})
            </label>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#16A34A]"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="w-40">
              <label className="block text-xs font-bold text-[#222222] mb-1">
                Target Budget (₹)
              </label>
              <input
                type="number"
                value={budgetInr}
                onChange={(e) => setBudgetInr(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg tabular-nums focus:outline-none focus:border-[#16A34A]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold disabled:opacity-60"
            >
              {loading ? 'Analyzing Timing & Cost...' : 'Build Execution Sequence'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {planText && (
          <div className="mt-4 p-4 rounded-xl bg-[#F5F6F7] border border-neutral-200 overflow-y-auto flex-1 text-xs text-[#222222] whitespace-pre-line leading-relaxed">
            {planText}
          </div>
        )}
      </div>
    </div>
  );
};
