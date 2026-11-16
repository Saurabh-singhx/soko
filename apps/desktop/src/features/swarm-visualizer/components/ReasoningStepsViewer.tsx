import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, CheckCircle2, Clock, Loader2, Copy, Check, Brain } from 'lucide-react';
import { ReasoningStep } from '../types';

export interface ReasoningStepsViewerProps {
  steps?: ReasoningStep[];
  isLive?: boolean;
  className?: string;
}

export const ReasoningStepsViewer: React.FC<ReasoningStepsViewerProps> = ({
  steps,
  className = '',
}) => {
  const displaySteps = steps || [];
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    if (displaySteps.length > 0) {
      return { [displaySteps[0]?.id || 'step-0']: true };
    }
    return {};
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!steps || steps.length === 0) {
    return (
      <div
        className={`bg-[#0D111A] border border-[#1E2638] rounded-lg p-5 text-xs text-slate-500 font-mono text-center flex flex-col items-center justify-center gap-2 ${className}`}
      >
        <Brain className="w-5 h-5 text-slate-600" />
        <span>No reasoning steps recorded for this turn.</span>
      </div>
    );
  }

  const toggleStep = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copyStepText = (step: ReasoningStep, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullText = [
      step.title,
      step.detail,
      ...(step.children?.map((c) => `  - ${c.text}`) || []),
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard?.writeText(fullText)?.catch?.(() => {});
    setCopiedId(step.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const renderStatus = (status: ReasoningStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />;
      case 'pending':
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
  };

  return (
    <div
      className={`bg-[#0D111A] border border-[#1E2638] rounded-lg p-3 text-xs leading-relaxed text-slate-300 font-sans ${className}`}
    >
      <div className="space-y-2.5">
        {displaySteps.map((step, sIdx) => {
          const stepId = step.id || `step-${sIdx}`;
          const isExpanded = !!expandedIds[stepId];

          return (
            <div key={stepId} className="group border-b border-white/[0.03] pb-2 last:border-b-0 last:pb-0">
              {/* Step Title / Header */}
              <div
                onClick={() => toggleStep(stepId)}
                className="w-full text-left flex items-start gap-1.5 hover:text-white transition-colors duration-150 py-0.5 cursor-pointer focus:outline-none"
              >
                <span className="pt-0.5 text-slate-400 group-hover:text-cyan-400 transition-transform">
                  <ChevronRight
                    className={`w-3.5 h-3.5 transform transition-transform duration-200 ${
                      isExpanded ? 'rotate-90 text-cyan-400' : 'text-slate-400'
                    }`}
                  />
                </span>

                <span className="flex-1 font-normal text-slate-200 leading-normal selection:bg-indigo-500/30">
                  {step.title}
                </span>

                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => copyStepText(step, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-slate-200 transition-opacity"
                    title="Copy reasoning"
                  >
                    {copiedId === step.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  {renderStatus(step.status)}
                </div>
              </div>

              {/* Collapsible detail / hierarchical children */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden pl-4 pr-1 space-y-2 pt-1.5"
                  >
                    {step.detail && (
                      <div className="text-slate-400 pl-2 border-l border-slate-800 text-[11px] font-mono leading-relaxed whitespace-pre-wrap bg-slate-900/30 rounded p-2">
                        {step.detail}
                      </div>
                    )}

                    {step.children && step.children.length > 0 && (
                      <div className="space-y-2 border-l border-indigo-900/40 pl-2.5 ml-1">
                        {step.children.map((child, idx) => (
                          <div
                            key={child.id || idx}
                            className="flex items-start gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <span className="pt-0.5 text-indigo-400/80">
                              <ChevronRight className="w-3 h-3 text-indigo-400/70" />
                            </span>
                            <span
                              className={`leading-normal ${
                                idx > 0 ? 'pl-2 text-slate-400/90 text-[11px]' : 'text-xs'
                              }`}
                            >
                              {child.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
