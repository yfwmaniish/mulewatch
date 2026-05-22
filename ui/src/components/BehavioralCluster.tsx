'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { ApiGraph, ApiGraphNode } from '@/lib/api-types';
import { useAlerts } from '@/context/AlertContext';
import { GitFork, Info, RefreshCw, AlertTriangle } from 'lucide-react';

const BAND_FILL: Record<string, string> = {
  HIGH: '#DC2626',
  MEDIUM: '#F59E0B',
  LOW: '#0F5132',
  FREEZE: '#A21CAF',
};
const BAND_STROKE: Record<string, string> = {
  HIGH: '#7F1D1D',
  MEDIUM: '#92400E',
  LOW: '#064E3B',
  FREEZE: '#581C87',
};

export default function BehavioralCluster() {
  const { setSelectedAlertId, setCurrentView, showToast } = useAlerts();
  const [graph, setGraph] = useState<ApiGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<ApiGraphNode | null>(null);
  const [pinned, setPinned] = useState<ApiGraphNode | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const g = await api.graph();
      setGraph(g);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'failed to load');
      setGraph(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGraph(); }, []);

  const positiveCount = graph?.meta.n_positive_nodes ?? 0;
  const w = graph?.meta.svg_width ?? 800;
  const h = graph?.meta.svg_height ?? 540;

  const edgePaths = useMemo(() => {
    if (!graph) return [];
    return graph.edges.map((e) => {
      const a = graph.nodes[e.source];
      const b = graph.nodes[e.target];
      const opacity = 0.15 + (e.similarity - (graph.meta.applied_cutoff ?? 0.3)) * 1.2;
      return { a, b, edge: e, opacity: Math.min(0.7, Math.max(0.1, opacity)) };
    });
  }, [graph]);

  const active = pinned ?? hovered;
  const activeNeighbors = useMemo(() => {
    if (!graph || !active) return new Set<number>();
    const ns = new Set<number>();
    for (const e of graph.edges) {
      if (e.source === active.id) ns.add(e.target);
      if (e.target === active.id) ns.add(e.source);
    }
    return ns;
  }, [graph, active]);

  const onNodeClick = (n: ApiGraphNode) => {
    setPinned((cur) => (cur?.id === n.id ? null : n));
  };
  const onNodeDouble = (n: ApiGraphNode) => {
    setSelectedAlertId(n.display_id);
    setCurrentView('triage');
    showToast(`Opened triage for ${n.display_id}`, 'success');
  };

  return (
    <div className="p-5 bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-slate-200/80 font-sans select-none">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-start gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#0F5132]/10 flex items-center justify-center text-[#0F5132] shrink-0">
            <GitFork className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 leading-tight">Behavioral similarity graph</h3>
            <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
              Cosine similarity of top-20 SHAP feature vectors across the {graph?.meta.top_k_accounts ?? '—'} highest-scoring alerts.
              <span className="ml-1 text-slate-400">Click node to pin · double-click to open triage.</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {graph && (
            <div className="hidden md:flex items-center gap-2 text-[9px] font-mono text-slate-500">
              <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200">{graph.meta.n_nodes} nodes</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200">{graph.meta.n_edges} edges</span>
              <span className="px-1.5 py-0.5 rounded bg-red-50 border border-red-100 text-[#DC2626]">{positiveCount} confirmed</span>
            </div>
          )}
          <button
            onClick={fetchGraph}
            disabled={loading}
            title="Refresh graph"
            className="h-8 w-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Graph not available</div>
            <div className="text-amber-700 mt-0.5 leading-snug">
              {error}. Generate with <code className="font-mono bg-white/60 px-1 rounded">python -m src.build_synthetic_graph</code>,
              then restart the scoring API.
            </div>
          </div>
        </div>
      )}

      {graph && (
        <div className="relative">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-auto bg-slate-50/60 rounded-2xl border border-slate-200/80"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="bgGlow" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect x={0} y={0} width={w} height={h} fill="url(#bgGlow)" />

            {/* Edges */}
            <g stroke="#94A3B8" strokeLinecap="round">
              {edgePaths.map(({ a, b, edge, opacity }) => {
                const dim = active && !(active.id === a.id || active.id === b.id);
                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    strokeWidth={0.5 + (edge.similarity - (graph.meta.applied_cutoff ?? 0.3)) * 3}
                    opacity={dim ? 0.05 : opacity}
                  />
                );
              })}
            </g>

            {/* Nodes */}
            <g>
              {graph.nodes.map((n) => {
                const band = n.band_live ?? n.band;
                const fill = BAND_FILL[band] ?? '#64748B';
                const stroke = BAND_STROKE[band] ?? '#334155';
                const r = 6 + Math.min(n.degree, 10) * 0.6;
                const dim = active && active.id !== n.id && !activeNeighbors.has(n.id);
                return (
                  <g key={n.id} opacity={dim ? 0.25 : 1}>
                    {n.is_positive && (
                      <circle cx={n.x} cy={n.y} r={r + 4} fill="none" stroke={fill} strokeOpacity={0.35} strokeWidth={1.5} />
                    )}
                    <circle
                      cx={n.x} cy={n.y} r={r}
                      fill={fill} stroke={stroke} strokeWidth={1.5}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHovered(n)}
                      onMouseLeave={() => setHovered((cur) => (cur?.id === n.id ? null : cur))}
                      onClick={() => onNodeClick(n)}
                      onDoubleClick={() => onNodeDouble(n)}
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Hover/Pinned panel */}
          <div className="absolute top-3 left-3 max-w-[260px] bg-white border border-slate-200 rounded-2xl shadow-lg p-3 text-xs">
            {active ? (
              <>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-[10px] font-bold text-slate-700">{active.display_id}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    (active.band_live ?? active.band) === 'HIGH' ? 'bg-red-50 text-[#DC2626]' :
                    (active.band_live ?? active.band) === 'FREEZE' ? 'bg-fuchsia-50 text-[#A21CAF]' :
                    (active.band_live ?? active.band) === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                    'bg-emerald-50 text-[#0F5132]'
                  }`}>
                    {(active.band_live ?? active.band)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                  <div>Score</div><div className="font-mono text-slate-800 text-right">{active.score.toFixed(3)}</div>
                  <div>Neighbors</div><div className="font-mono text-slate-800 text-right">{active.degree}</div>
                  <div>Ground truth</div><div className="text-right">{active.is_positive ? <span className="text-[#DC2626] font-semibold">mule</span> : 'legit'}</div>
                </div>
                {active.matched_rules.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[9px] text-[#DC2626] font-mono">
                    {active.matched_rules.join(', ')}
                  </div>
                )}
                <div className="text-[9px] text-slate-400 mt-1.5 leading-snug">
                  {pinned ? 'pinned · click again to release' : 'hovering'}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-slate-500 flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <span>Hover or click a node to inspect. Ring = ground-truth mule.</span>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 right-3 bg-white border border-slate-200 rounded-2xl px-2.5 py-2 text-[10px] shadow-sm flex items-center gap-3 font-mono">
            <Legend color={BAND_FILL.HIGH} label="HIGH" />
            <Legend color={BAND_FILL.MEDIUM} label="MED" />
            <Legend color={BAND_FILL.LOW} label="LOW" />
            <Legend color={BAND_FILL.FREEZE} label="FREEZE" />
          </div>
        </div>
      )}

      <p className="text-[9px] text-slate-400 mt-3 leading-snug italic">
        {graph?.meta.caveat ?? 'Edges = behavioral similarity, not money flow. Production deployment uses real transfer edges.'}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-600">
      <span className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: color, borderColor: color }} />
      {label}
    </span>
  );
}
