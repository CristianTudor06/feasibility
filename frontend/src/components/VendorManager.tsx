import React, { useState } from 'react';
import { VendorTier } from '../types';
import { ShieldCheck, Award, Layers, Edit2, Check } from 'lucide-react';

interface VendorManagerProps {
  vendors: VendorTier[];
  onUpdateVendors: (newVendors: VendorTier[]) => void;
}

export default function VendorManager({
  vendors,
  onUpdateVendors
}: VendorManagerProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editTier, setEditTier] = useState('');
  const [editColor, setEditColor] = useState<VendorTier['color']>('green');

  const handleStartEditing = (idx: number, vendor: VendorTier) => {
    setEditingIndex(idx);
    setEditName(vendor.name);
    setEditTier(vendor.tier);
    setEditColor(vendor.color || 'green');
  };

  const handleSaveEdit = (idx: number) => {
    const updated = [...vendors];
    updated[idx] = {
      name: editName,
      tier: editTier,
      color: editColor
    };
    onUpdateVendors(updated);
    setEditingIndex(null);
  };

  // Maps tier text to badge colors
  const getTierColor = (tier: string) => {
    const t = String(tier || '').toLowerCase();
    if (t.includes('do not use')) return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    if (t.includes('0') || t.includes('prime')) return 'bg-[#ebf8ff] text-[#2b6cb0] border-[#bee3f8] font-bold';
    if (t.includes('1') || t.includes('high')) return 'bg-sky-50 text-sky-800 border-sky-250 font-bold';
    if (t.includes('2')) return 'bg-indigo-50 text-indigo-805 border-indigo-200 font-bold';
    if (t.includes('3')) return 'bg-purple-50 text-purple-800 border-purple-200 font-medium';
    return 'bg-slate-100 text-slate-600 border-slate-200 font-normal';
  };

  const getColorBadgeStyle = (color: string) => {
    const c = String(color || 'grey').toLowerCase();
    if (c === 'green') return 'bg-emerald-50 text-emerald-800 border-emerald-250';
    if (c === 'red') return 'bg-rose-50 text-rose-800 border-rose-250 font-bold';
    if (c === 'grey' || c === 'gray') return 'bg-slate-100 text-slate-700 border-slate-300';
    if (c === 'yellow') return 'bg-amber-50 text-amber-900 border-amber-250';
    if (c === 'orange') return 'bg-orange-50 text-orange-900 border-orange-250';
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3 animate-fade-in" id="vendor-manager-panel">
      <div>
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
          <ShieldCheck className="h-4 w-4 text-[#2b6cb0]" />
          Vetted Vendor Tiering &amp; Quality Codes
        </h3>
        <p className="text-[11px] text-slate-500">
          These tiers classify quality partners and color flags. In the &quot;Tier Priority&quot; model, higher tier priorities (Tier 1 first, sorted by Colour) are completely exhausted prior to engaging junior providers. There are currently {vendors.length} active workspace registered partners in your sandbox.
        </p>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white" id="vendors-list-container">
        <table className="w-full text-left text-xs text-slate-700 font-sans border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3 pl-4">Vendor Name</th>
              <th className="p-3">Tier Level</th>
              <th className="p-3">Quality Flag</th>
              <th className="p-3 pr-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vendors.map((vendor, idx) => {
              const isEditing = editingIndex === idx;

              return (
                <tr key={idx} className="hover:bg-slate-50/40 transition">
                  {/* Vendor Name */}
                  <td className="p-3 pl-4 font-semibold text-slate-900">
                    {vendor.name}
                  </td>

                  {/* Tier Priority Selection / Display */}
                  <td className="p-3">
                    {isEditing ? (
                      <select
                        value={editTier}
                        onChange={(e) => setEditTier(e.target.value)}
                        className="px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="Tier 0">Tier 0 (Prime)</option>
                        <option value="Tier 1">Tier 1</option>
                        <option value="Tier 2">Tier 2</option>
                        <option value="Tier 3">Tier 3</option>
                        <option value="No Tier">No Tier</option>
                        <option value="Do not use">Do not use (Banned)</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-medium font-mono text-[9px] rounded-full uppercase tracking-wider ${getTierColor(vendor.tier)}`}>
                        <Award className="h-2.5 w-2.5" />
                        {vendor.tier}
                      </span>
                    )}
                  </td>

                  {/* Color Flag Selection / Display */}
                  <td className="p-3">
                    {isEditing ? (
                      <select
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value as any)}
                        className="px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                      >
                        <option value="Green">Green (High Priority)</option>
                        <option value="Grey">Grey (Neutral / Standard)</option>
                        <option value="Red">Red (Do Not Use)</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-medium font-mono text-[9px] rounded-full uppercase tracking-wider ${getColorBadgeStyle(vendor.color)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${String(vendor.color).toLowerCase() === 'green' ? 'bg-emerald-500' : String(vendor.color).toLowerCase() === 'red' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                        {vendor.color || 'Grey'}
                      </span>
                    )}
                  </td>

                  {/* Edit triggering actions */}
                  <td className="p-3 pr-4 text-center">
                    {isEditing ? (
                      <div className="flex justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(idx)}
                          className="px-2 py-1 bg-emerald-600 font-bold hover:bg-emerald-700 text-white rounded text-[10px] transition cursor-pointer shadow-xs inline-flex items-center gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="px-2 py-1 bg-slate-200 font-bold hover:bg-slate-300 text-slate-700 rounded text-[10px] transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEditing(idx, vendor)}
                        className="p-1 px-2.5 bg-slate-100 border border-slate-200 text-slate-600 hover:text-[#2b6cb0] hover:bg-sky-50 rounded transition inline-flex items-center gap-1 font-semibold text-[10px] cursor-pointer"
                        title="Edit vendor properties"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
