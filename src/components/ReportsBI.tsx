import React, { useState, useMemo } from "react";
import { BarChart3, PieChart as PieIcon, TrendingUp, Users, FileText, Scale, Calendar, HelpCircle, Download, FileSpreadsheet, Sparkles, Filter, ChevronRight } from "lucide-react";
import { 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area 
} from "recharts";
import { Process, Client, FinancialItem, DocumentItem, AgendaEvent, LawFirm } from "../types";

interface ReportsBIProps {
  processes: Process[];
  clients: Client[];
  finances: FinancialItem[];
  documents: DocumentItem[];
  events: AgendaEvent[];
  activeFirm?: LawFirm;
  userRole: string;
}

function isColorLight(hex: string): boolean {
  if (!hex) return false;
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
  }
  return false;
}

export default function ReportsBI({ 
  processes, 
  clients, 
  finances, 
  documents, 
  events, 
  activeFirm, 
  userRole 
}: ReportsBIProps) {
  
  // Filtros
  const [periodo, setPeriodo] = useState<"30" | "90" | "365" | "all">("90");
  const [selectedArea, setSelectedArea] = useState<string>("all");

  const primaryColor = activeFirm?.primary_color || "#4f46e5";
  const secondaryColor = activeFirm?.secondary_color || "#111827";
  const isPrimaryLight = isColorLight(primaryColor);
  
  // Cores de Gráficos correspondentes ao tema
  const COLORS_PALETTE = [
    primaryColor, 
    secondaryColor, 
    "#f59e0b", // Amber
    "#10b981", // Emerald
    "#3b82f6", // Blue
    "#ec4899", // Pink
    "#8b5cf6"  // Violet
  ];

  // Filtrar dados pelo período selecionado (dias a partir de hoje)
  const dataLimite = useMemo(() => {
    if (periodo === "all") return null;
    const data = new Date();
    data.setDate(data.getDate() - parseInt(periodo));
    return data;
  }, [periodo]);

  const filteredFinances = useMemo(() => {
    return finances.filter(f => {
      if (!dataLimite) return true;
      const dataVenc = new Date(f.due_date);
      return dataVenc >= dataLimite;
    });
  }, [finances, dataLimite]);

  const filteredProcesses = useMemo(() => {
    return processes.filter(p => {
      if (selectedArea !== "all" && p.area !== selectedArea) return false;
      if (!dataLimite) return true;
      const dataCriacao = new Date(p.created_at || Date.now());
      return dataCriacao >= dataLimite;
    });
  }, [processes, dataLimite, selectedArea]);

  // Lista de Áreas únicas existentes nos processos para filtro
  const areasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    processes.forEach(p => { if (p.area) set.add(p.area); });
    return Array.from(set);
  }, [processes]);

  // --- MÉTRIQUES KPI ---
  const kpis = useMemo(() => {
    // 1. Faturamento Total Realizado (Receitas pagas no período)
    const faturamento = filteredFinances
      .filter(f => f.type === "revenue" && f.status === "Pago")
      .reduce((acc, curr) => acc + curr.amount, 0);

    // 2. Taxa de Inadimplência (% de contas a receber vencidas e atrasadas)
    const contasAReceberPendente = finances.filter(f => f.type === "revenue" && f.status !== "Pago");
    const contasAReceberAtrasado = finances.filter(f => f.type === "revenue" && f.status === "Atrasado");
    const totalPendente = contasAReceberPendente.reduce((acc, curr) => acc + curr.amount, 1); // evita divisão por zero
    const totalAtrasado = contasAReceberAtrasado.reduce((acc, curr) => acc + curr.amount, 0);
    const inadimplencia = (totalAtrasado / totalPendente) * 100;

    // 3. Valor Total de Causas Ativas sob Gestão
    const valorCausasAtivas = filteredProcesses
      .filter(p => p.status === "Ativo")
      .reduce((acc, curr) => acc + (curr.value || 0), 0);

    // 4. Taxa de Conclusão de Prazos (% de eventos de prazo concluídos)
    const eventosPrazo = events.filter(e => e.type === "deadline");
    const prazoConcluido = eventosPrazo.filter(e => e.status === "Concluído");
    const taxaPrazo = eventosPrazo.length > 0 ? (prazoConcluido.length / eventosPrazo.length) * 100 : 100;

    // 5. Novas captações de clientes no período
    const novosClientes = clients.filter(c => {
      if (!dataLimite) return true;
      const dataCriacao = new Date(c.created_at);
      return dataCriacao >= dataLimite;
    }).length;

    return {
      faturamento,
      inadimplencia: Math.min(100, parseFloat(inadimplencia.toFixed(1))),
      valorCausasAtivas,
      taxaPrazo: parseFloat(taxaPrazo.toFixed(1)),
      novosClientes
    };
  }, [filteredFinances, finances, filteredProcesses, events, clients, dataLimite]);


  // --- GRÁFICO 1: Distribuição de Processos por Área ---
  const chartProcessByArea = useMemo(() => {
    const areaMap: { [key: string]: number } = {};
    filteredProcesses.forEach(p => {
      const area = p.area || "Outra";
      areaMap[area] = (areaMap[area] || 0) + 1;
    });

    return Object.keys(areaMap).map((key, index) => ({
      name: key,
      value: areaMap[key],
      color: COLORS_PALETTE[index % COLORS_PALETTE.length]
    }));
  }, [filteredProcesses, COLORS_PALETTE]);


  // --- GRÁFICO 2: Receitas vs Despesas (Balanço Mensal) ---
  const chartCashFlow = useMemo(() => {
    const monthlyData: { [key: string]: { receitas: number; despesas: number } } = {};
    
    // Pegar dados financeiros filtrados
    filteredFinances.forEach(f => {
      const d = new Date(f.due_date);
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      
      if (!monthlyData[label]) {
        monthlyData[label] = { receitas: 0, despesas: 0 };
      }
      
      if (f.type === "revenue") {
        monthlyData[label].receitas += f.amount;
      } else {
        monthlyData[label].despesas += f.amount;
      }
    });

    // Ordenar cronologicamente os meses
    return Object.keys(monthlyData).map(key => ({
      name: key,
      Receitas: parseFloat(monthlyData[key].receitas.toFixed(2)),
      Despesas: parseFloat(monthlyData[key].despesas.toFixed(2)),
      Balanço: parseFloat((monthlyData[key].receitas - monthlyData[key].despesas).toFixed(2))
    }));
  }, [filteredFinances]);


  // --- GRÁFICO 3: Status dos Processos ---
  const chartProcessStatus = useMemo(() => {
    const statusMap: { [key: string]: number } = {
      "Ativo": 0,
      "Sentenciado": 0,
      "Suspenso": 0,
      "Arquivado": 0
    };
    
    filteredProcesses.forEach(p => {
      if (p.status in statusMap) {
        statusMap[p.status]++;
      } else {
        statusMap[p.status] = (statusMap[p.status] || 0) + 1;
      }
    });

    return Object.keys(statusMap).map(key => ({
      name: key,
      Quantidade: statusMap[key]
    }));
  }, [filteredProcesses]);

  // --- SEÇÃO DE IA INSIGHTS ---
  const aiInsights = useMemo(() => {
    const insights = [];
    
    // Insight 1: Alocação e Ticket de Causa
    if (kpis.valorCausasAtivas > 100000) {
      insights.push({
        title: "Alta Volatilidade de Carteira",
        desc: `O escritório possui R$ ${kpis.valorCausasAtivas.toLocaleString("pt-BR")} em causas ativas. Sugere-se intensificar acordos processuais de alta liquidez para acelerar o fluxo de caixa cível.`,
        type: "success"
      });
    }

    // Insight 2: Prazos e Riscos operacionais
    if (kpis.taxaPrazo < 85) {
      insights.push({
        title: "Gargalo Operacional na Agenda",
        desc: `O índice de prazos concluídos está em ${kpis.taxaPrazo}%, o que está abaixo do ideal de 95%. Recomenda-se disparar alertas automáticos via WhatsApp com maior antecedência.`,
        type: "warning"
      });
    } else {
      insights.push({
        title: "Excelente Eficiência em Prazos",
        desc: `Parabéns! O índice de cumprimento de prazos está saudável em ${kpis.taxaPrazo}%. A equipe jurídica está em alto desempenho operacional.`,
        type: "success"
      });
    }

    // Insight 3: Fluxo Financeiro e Custos
    const totalRecebido = filteredFinances.filter(f => f.type === "revenue" && f.status === "Pago").reduce((a, b) => a + b.amount, 0);
    const totalGasto = filteredFinances.filter(f => f.type === "expense" && f.status === "Pago").reduce((a, b) => a + b.amount, 0);
    if (totalGasto > totalRecebido && totalRecebido > 0) {
      insights.push({
        title: "Atenção ao Cash-Burn Rate",
        desc: "As despesas operacionais líquidas pagas superaram as receitas recebidas no período analisado. Recomenda-se realizar auditoria na categoria 'Custas e despesas judiciais'.",
        type: "danger"
      });
    }

    // Insight 4: Atração de Leads
    if (kpis.novosClientes > 5) {
      insights.push({
        title: "Crescimento Acelerado de Clientes",
        desc: `Houve captação de ${kpis.novosClientes} novos clientes no período. Excelente conversão de marketing e indicação jurídica comercial.`,
        type: "info"
      });
    }

    return insights;
  }, [kpis, filteredFinances]);

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6" id="reports-bi-view">
      
      {/* Header do Módulo */}
      <div 
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 rounded-2xl border shadow-xl gap-4 transition-all"
        style={{ 
          backgroundColor: primaryColor,
          borderColor: isPrimaryLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'
        }}
      >
        <div>
          <h2 className={`text-xl font-semibold tracking-tight ${isPrimaryLight ? "text-slate-900" : "text-white"} flex items-center gap-2`}>
            <BarChart3 className="w-5 h-5 animate-pulse" /> Business Intelligence (BI) e Relatórios Gerenciais
          </h2>
          <p className={`text-xs mt-1 ${isPrimaryLight ? "text-slate-600" : "text-slate-200"}`}>
            Análises analíticas de desempenho processual, indicadores operacionais, faturamento e insights estratégicos.
          </p>
        </div>
        
        <div className="flex gap-2 shrink-0">
          <button
            onClick={exportPDF}
            className={`text-xs font-semibold px-4 py-2 rounded-xl border flex items-center gap-1.5 transition-all hover:opacity-90 cursor-pointer shadow-xs ${
              isPrimaryLight 
                ? "bg-slate-900/10 border-slate-900/10 text-slate-800" 
                : "bg-white/10 border-white/10 text-slate-100"
            }`}
          >
            <Download className="w-4 h-4" /> Exportar Relatório Executivo
          </button>
        </div>
      </div>

      {/* Painel de Filtros Globais */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-2xs print:hidden">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>FILTRAR BI:</span>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* Período */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Período:</span>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs outline-none focus:border-indigo-500"
            >
              <option value="30">Últimos 30 Dias</option>
              <option value="90">Últimos 90 Dias</option>
              <option value="365">Último Ano</option>
              <option value="all">Todo o Histórico</option>
            </select>
          </div>

          {/* Área Processual */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Área Jurídica:</span>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs outline-none focus:border-indigo-500"
            >
              <option value="all">Todas as Áreas</option>
              {areasDisponiveis.map((area, idx) => (
                <option key={idx} value={area}>{area}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid de KPIs Básicos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Faturamento */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Faturamento Líquido</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <strong className="text-lg font-bold text-slate-800 font-mono block mt-2">
            R$ {kpis.faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </strong>
          <span className="text-[9px] text-slate-400 mt-1 block">Receitas liquidadas no período</span>
        </div>

        {/* KPI 2: Valor sob Gestão */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Valor sob Gestão (Causas)</span>
            <Scale className="w-4 h-4 text-slate-400" />
          </div>
          <strong className="text-lg font-bold text-slate-800 font-mono block mt-2">
            R$ {kpis.valorCausasAtivas.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </strong>
          <span className="text-[9px] text-slate-400 mt-1 block">Soma de valores de causas ativas</span>
        </div>

        {/* KPI 3: Inadimplência */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Inadimplência</span>
            <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md ${
              kpis.inadimplencia > 15 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
            }`}>
              {kpis.inadimplencia}%
            </span>
          </div>
          <strong className="text-lg font-bold text-slate-800 font-mono block mt-2">
            {kpis.inadimplencia}%
          </strong>
          <span className="text-[9px] text-slate-400 mt-1 block">Média de pendências financeiras</span>
        </div>

        {/* KPI 4: Conclusão de Prazos */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Eficiência de Prazos</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <strong className="text-lg font-bold text-slate-800 font-mono block mt-2">
            {kpis.taxaPrazo}%
          </strong>
          <span className="text-[9px] text-slate-400 mt-1 block">Compromissos cumpridos</span>
        </div>

        {/* KPI 5: Novos Clientes */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs sm:col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Captações (Novos Clientes)</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <strong className="text-lg font-bold text-slate-800 block mt-2">
            +{kpis.novosClientes}
          </strong>
          <span className="text-[9px] text-slate-400 mt-1 block">Clientes cadastrados no período</span>
        </div>
      </div>

      {/* Grid de Gráficos de Alta Fidelidade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico 1: Fluxo de Caixa (Área Chart) */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Histórico Financeiro Recorrente (Receitas vs Despesas)
            </h3>
            
            {chartCashFlow.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartCashFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={primaryColor} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR")}`} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="Receitas" stroke={primaryColor} strokeWidth={2} fillOpacity={1} fill="url(#colorRec)" />
                    <Area type="monotone" dataKey="Despesas" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDesp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                Nenhum dado financeiro encontrado no período selecionado.
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Distribuição de Processos por Área (Pie Chart) */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 mb-4">
              <PieIcon className="w-4 h-4 text-indigo-500" /> Distribuição da Carteira Jurídica por Área de Atuação
            </h3>

            {chartProcessByArea.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="h-56 md:col-span-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartProcessByArea}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartProcessByArea.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value} processos`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {chartProcessByArea.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600 line-clamp-1">{item.name}:</span>
                      <strong className="text-slate-800 ml-auto">{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                Nenhum processo cadastrado.
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 3: Status dos Processos (Bar Chart) */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 mb-4">
            <Scale className="w-4 h-4 text-slate-500" /> Volume Processual por Status Interno
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartProcessStatus} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Quantidade" fill={secondaryColor} radius={[6, 6, 0, 0]}>
                  {chartProcessStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === "Ativo" ? primaryColor : secondaryColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Coluna de Insights Inteligentes via "IA" */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 mb-4">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" /> Insights do Consultor de IA Gerencial
            </h3>

            <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
              {aiInsights.map((insight, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1 hover:bg-slate-100/50 transition-all">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      insight.type === "success" ? "bg-emerald-500" :
                      insight.type === "warning" ? "bg-amber-500" :
                      insight.type === "danger" ? "bg-red-500" : "bg-indigo-500"
                    }`} />
                    <h4 className="text-xs font-bold text-slate-800">{insight.title}</h4>
                  </div>
                  <p className="text-[10px] text-slate-500 pl-4">{insight.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Análise preditiva gerada automaticamente</span>
            <span className="font-semibold text-slate-500">LegalOne Intelligence</span>
          </div>
        </div>

      </div>

    </div>
  );
}
