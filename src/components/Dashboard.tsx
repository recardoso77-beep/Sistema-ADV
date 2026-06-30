import React from "react";
import { Scale, Calendar, TrendingUp, FileSignature, ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, PlayCircle } from "lucide-react";
import { Process, AgendaEvent, FinancialItem, DocumentItem } from "../types";

interface DashboardProps {
  processes: Process[];
  events: AgendaEvent[];
  finances: FinancialItem[];
  documents: DocumentItem[];
  onNavigate: (tab: string) => void;
  userRole: string;
}

export default function Dashboard({ processes, events, finances, documents, onNavigate, userRole }: DashboardProps) {
  const activeProcesses = processes.filter((p) => p.status === "Ativo");
  
  // Upcoming events
  const upcomingDeadlines = events.filter((e) => e.status === "Pendente");
  
  // Cash flow totals
  const totalRevenues = finances
    .filter((f) => f.type === "revenue" && f.status === "Pago")
    .reduce((sum, item) => sum + item.amount, 0);

  const totalExpenses = finances
    .filter((f) => f.type === "expense" && f.status === "Pago")
    .reduce((sum, item) => sum + item.amount, 0);

  const netBalance = totalRevenues - totalExpenses;

  // Pending digital signatures
  const pendingSignatures = documents.filter((doc) => {
    return doc.signatures.length === 0 && doc.category !== "Pasta";
  });

  // Simple monthly breakdown for SVG bar charts
  const monthlyData = [
    { name: "Jan", receita: 15000, despesa: 4200 },
    { name: "Fev", receita: 19000, despesa: 5100 },
    { name: "Mar", receita: 22000, despesa: 6800 },
    { name: "Abr", receita: 28000, despesa: 8200 },
    { name: "Mai", receita: 25000, despesa: 7100 },
    { name: "Jun", receita: totalRevenues || 32000, despesa: totalExpenses || 9400 },
  ];

  const maxVal = Math.max(...monthlyData.map((d) => Math.max(d.receita, d.despesa))) * 1.1;

  return (
    <div className="space-y-6" id="dashboard-tab-view">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-radial from-slate-900 to-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Painel de Controle Jurídico</h2>
          <p className="text-xs text-slate-400 mt-1">
            Status geral do escritório, prazos capturados e conciliação financeira consolidada.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-mono text-slate-300">adv.sportixbikeshop.com.br</span>
        </div>
      </div>

      {/* Bento Grid Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div
          onClick={() => onNavigate("processes")}
          className="bg-white hover:bg-slate-50/50 border border-slate-200/90 p-5 rounded-2xl transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Processos Ativos</span>
            <div className="p-2 bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-xl transition-colors">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">{activeProcesses.length}</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +100%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Monitorando andamento e intimações</p>
        </div>

        {/* Metric 2 */}
        <div
          onClick={() => onNavigate("agenda")}
          className="bg-white hover:bg-slate-50/50 border border-slate-200/90 p-5 rounded-2xl transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Prazos e Audiências</span>
            <div className="p-2 bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-xl transition-colors">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">{upcomingDeadlines.length}</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-1.5 py-0.5 rounded-md">
              Próximos
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Calculados automaticamente em dias úteis</p>
        </div>

        {/* Metric 3 */}
        <div
          onClick={() => onNavigate("financial")}
          className="bg-white hover:bg-slate-50/50 border border-slate-200/90 p-5 rounded-2xl transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Saldo Consolidado</span>
            <div className="p-2 bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-xl transition-colors">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className={`text-2xl font-semibold tracking-tight ${netBalance >= 0 ? "text-slate-900" : "text-rose-600"}`}>
              R$ {netBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1">
            {netBalance >= 0 ? (
              <span className="text-emerald-600 flex items-center font-medium"><ArrowUpRight className="w-3.5 h-3.5" /> Superavitário</span>
            ) : (
              <span className="text-rose-600 flex items-center font-medium"><ArrowDownRight className="w-3.5 h-3.5" /> Deficitário</span>
            )}
            no caixa deste mês
          </p>
        </div>

        {/* Metric 4 */}
        <div
          onClick={() => onNavigate("documents")}
          className="bg-white hover:bg-slate-50/50 border border-slate-200/90 p-5 rounded-2xl transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-500">Assinaturas Pendentes</span>
            <div className="p-2 bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-xl transition-colors">
              <FileSignature className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">{pendingSignatures.length}</span>
            <span className="text-[10px] bg-amber-50 text-amber-700 font-medium px-1.5 py-0.5 rounded-md">
              Aguardando
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Validadas por chave eletrônica legal</p>
        </div>
      </div>

      {/* Main Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Section: Stripe-style comparative cash flow graph */}
        <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Demonstrativo Financeiro Consolidado</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Comparativo semestral de Receitas vs Despesas</p>
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-indigo-600" /> Receitas (Honorários)
              </span>
              <span className="flex items-center gap-1 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-400" /> Despesas (Operações)
              </span>
            </div>
          </div>

          {/* SVG Custom High-End Bar Chart */}
          <div className="w-full h-56 flex items-end justify-between px-2 pt-4 border-b border-slate-100">
            {monthlyData.map((d, index) => {
              const recHeight = (d.receita / maxVal) * 100;
              const despHeight = (d.despesa / maxVal) * 100;

              return (
                <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group px-2">
                  <div className="w-full flex justify-center items-end gap-1.5 h-full pb-1">
                    {/* Revenue Bar */}
                    <div
                      style={{ height: `${recHeight}%` }}
                      className="w-4 bg-indigo-600 hover:bg-indigo-500 rounded-t-xs transition-all relative group"
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-900 text-[9px] text-white py-1 px-1.5 rounded-md hidden group-hover:block z-10 whitespace-nowrap shadow-md">
                        Rec: R$ {d.receita.toLocaleString("pt-BR")}
                      </div>
                    </div>

                    {/* Expense Bar */}
                    <div
                      style={{ height: `${despHeight}%` }}
                      className="w-4 bg-slate-300 hover:bg-slate-400 rounded-t-xs transition-all relative group"
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-900 text-[9px] text-white py-1 px-1.5 rounded-md hidden group-hover:block z-10 whitespace-nowrap shadow-md">
                        Desp: R$ {d.despesa.toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-2">{d.name}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-4">
            <span>Faturamento consolidado: R$ {totalRevenues.toLocaleString("pt-BR")}</span>
            <span className="text-indigo-600 font-medium">Balanço líquido do escritório: R$ {netBalance.toLocaleString("pt-BR")}</span>
          </div>
        </div>

        {/* Right Section: Upcoming events / hearings countdown widget */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col h-full">
          <h3 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" /> Agenda Imediata
          </h3>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[260px] pr-1">
            {upcomingDeadlines.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-75" />
                <p className="text-xs">Nenhum prazo pendente ou audiência imediata.</p>
              </div>
            ) : (
              upcomingDeadlines.slice(0, 5).map((ev) => (
                <div key={ev.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                    ev.type === "hearing" ? "bg-amber-100 text-amber-700" :
                    ev.type === "deadline" ? "bg-rose-100 text-rose-700" :
                    ev.type === "meeting" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
                  }`}>
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-slate-800 truncate">{ev.title}</h4>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{ev.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] font-mono bg-slate-200 px-1 py-0.5 rounded-sm text-slate-600">
                        {new Date(ev.start_date).toLocaleDateString("pt-BR")} às {new Date(ev.start_date).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        ev.type === "hearing" ? "bg-amber-50 text-amber-600" :
                        ev.type === "deadline" ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-600"
                      }`}>
                        {ev.type === "hearing" ? "Audiência" : ev.type === "deadline" ? "Prazo" : "Reunião"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {upcomingDeadlines.length > 5 && (
            <button
              onClick={() => onNavigate("agenda")}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 mt-4 text-center cursor-pointer"
            >
              Ver mais {upcomingDeadlines.length - 5} compromissos na agenda →
            </button>
          )}
        </div>
      </div>

      {/* Live capture / tribunal updates timeline */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Capturador Automático de Publicações e Andamentos</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Andamentos de tribunais integrados sincronizados em tempo real</p>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg border border-indigo-100 font-medium flex items-center gap-1 animate-pulse">
            <PlayCircle className="w-3 h-3" /> Monitorando TJSP, TRT2, TRF3
          </span>
        </div>

        <div className="border-l border-slate-200 ml-3 pl-5 space-y-4 py-2">
          <div className="relative">
            <span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-600" />
            <div className="text-[10px] text-slate-400 font-mono">TJSP - Hoje, 09:30</div>
            <h4 className="text-xs font-semibold text-slate-800 mt-0.5">CNJ: 0012345-67.2026.8.26.0100 - Cobrança de Honorários</h4>
            <p className="text-xs text-slate-600 mt-1">
              Despacho publicado: "Vistos. Certificada a tempestividade, intime-se o executado para pagamento voluntário do débito sob pena de multa de 10%...".
            </p>
          </div>

          <div className="relative">
            <span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-600" />
            <div className="text-[10px] text-slate-400 font-mono">TRT2 - Ontem, 16:15</div>
            <h4 className="text-xs font-semibold text-slate-800 mt-0.5">CNJ: 0098765-43.2025.5.02.0002 - Reclamação Carlos Santos</h4>
            <p className="text-xs text-slate-600 mt-1">
              Audiência de Conciliação designada para 15/08/2026 às 14h00. Expedida notificação inicial eletrônica às partes.
            </p>
          </div>

          <div className="relative">
            <span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-300" />
            <div className="text-[10px] text-slate-400 font-mono">TJSP - 20 Jun 2026</div>
            <h4 className="text-xs font-semibold text-slate-800 mt-0.5">CNJ: 0012345-67.2026.8.26.0100 - Cobrança de Honorários</h4>
            <p className="text-xs text-slate-600 mt-1">
              Petição inicial distribuída e conclusa para despacho do juiz de direito da 2ª Vara Cível.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
