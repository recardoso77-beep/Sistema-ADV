import React, { useState } from "react";
import { Play, ToggleLeft, ToggleRight, Settings, Plus, Zap, ArrowRight, Layers, FileText, BellRing, FolderKanban } from "lucide-react";
import { Workflow } from "../types";

interface WorkflowsProps {
  workflows: Workflow[];
  token: string;
  onRefresh: () => Promise<void>;
  userRole: string;
}

export default function Workflows({ workflows, token, onRefresh, userRole }: WorkflowsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleToggleWorkflow = async (id: string, currentStatus: boolean) => {
    if (userRole === "client") return;
    setLoading(id);
    try {
      const res = await fetch(`/api/workflows/${id}/toggle`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !currentStatus }),
      });
      if (res.ok) {
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6" id="workflows-module-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Automação de Workflows</h2>
          <p className="text-xs text-slate-400 mt-1">Configure fluxos sequenciais disparados por gatilhos de tribunais ou cadastros.</p>
        </div>
        {userRole !== "client" && (
          <button
            onClick={() => alert("Módulo administrativo de criação avançada de Workflows. Por padrão, os fluxos de Onboarding, Publicações e Prazos já estão pré-configurados e ativos.")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Criar Fluxo
          </button>
        )}
      </div>

      {/* Grid listing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {workflows.map((wf) => (
          <div key={wf.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-5">
            <div>
              {/* Top info and toggle status */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${wf.active ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-slate-100 text-slate-400"}`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-800">{wf.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      GATILHO: {wf.trigger_event === "new_process" ? "Onboarding de Processo" :
                               wf.trigger_event === "new_hearing" ? "Varredura de Audiência" : "Aviso de Prazo Próximo"}
                    </p>
                  </div>
                </div>

                <button
                  disabled={loading === wf.id || userRole === "client"}
                  onClick={() => handleToggleWorkflow(wf.id, wf.active)}
                  className="text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {wf.active ? (
                    <ToggleRight className="w-9 h-9 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-slate-300" />
                  )}
                </button>
              </div>

              {/* Action Sequence graphical feed */}
              <div className="mt-5 space-y-3">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Sequência de Ações Automatizadas
                </p>

                <div className="space-y-2">
                  {wf.actions.map((act, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[10px]">
                        {idx + 1}
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 flex-1 flex items-center justify-between">
                        <span className="font-semibold text-slate-700">
                          {act.type === "create_folder" && "Criar Diretório do Caso"}
                          {act.type === "assign_task" && "Atribuir Prazo Preparatório"}
                          {act.type === "send_notification" && "Enviar Alerta WhatsApp/Portal"}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">
                          {act.type === "create_folder" && "Modulo Docs"}
                          {act.type === "assign_task" && "Modulo Agenda"}
                          {act.type === "send_notification" && "Modulo Portal"}
                        </span>
                      </div>
                      {idx < wf.actions.length - 1 && (
                        <div className="h-4 border-l border-slate-200 ml-3" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Test Simulation trigger */}
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" /> Total de {wf.actions.length} micro-instâncias
              </span>
              {wf.active && (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sincronizado e Operante
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
