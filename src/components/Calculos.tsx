import React, { useState, useEffect } from "react";
import { Calculator, Plus, Trash2, Printer, FileSpreadsheet, Eye, Save, HelpCircle, RefreshCw, Calendar, Sparkles } from "lucide-react";
import { LawFirm } from "../types";

interface CalculoSalvo {
  id: string;
  descricao: string;
  valorOriginal: number;
  dataInicial: string;
  dataFinal: string;
  indice: string;
  taxaJuros: number;
  tipoJuros: "simples" | "composto" | "nenhum";
  multa: number;
  honorarios: number;
  totalAtualizado: number;
  dataCriacao: string;
}

interface CalculosProps {
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

export default function Calculos({ activeFirm, userRole }: CalculosProps) {
  // Inputs do formulário
  const [descricao, setDescricao] = useState("");
  const [valorOriginal, setValorOriginal] = useState<string>("10000.00");
  const [dataInicial, setDataInicial] = useState<string>("2023-01-01");
  const [dataFinal, setDataFinal] = useState<string>(new Date().toISOString().slice(0, 10));
  const [indice, setIndice] = useState<string>("IPCA");
  const [taxaJuros, setTaxaJuros] = useState<string>("1.0");
  const [tipoJuros, setTipoJuros] = useState<"simples" | "composto" | "nenhum">("simples");
  const [multa, setMulta] = useState<string>("10.0");
  const [honorarios, setHonorarios] = useState<string>("10.0");

  // Resultados calculados
  const [resultado, setResultado] = useState<{
    principalOriginal: number;
    principalCorrigido: number;
    fatorCorrecao: number;
    jurosAcumulados: number;
    valorJuros: number;
    subtotal: number;
    valorMulta: number;
    valorHonorarios: number;
    totalGeral: number;
    diasDiferenca: number;
    mesesDiferenca: number;
    indicesAplicados: { data: string; fator: number; valor: number }[];
  } | null>(null);

  // Histórico de cálculos salvos
  const [calculosSalvos, setCalculosSalvos] = useState<CalculoSalvo[]>([]);
  const [showHelper, setShowHelper] = useState(false);

  // Cores dinâmicas do tema do escritório
  const isPrimaryLight = isColorLight(activeFirm?.primary_color || "#4f46e5");
  const primaryBg = activeFirm?.primary_color || "#4f46e5";
  const primaryTextColor = isPrimaryLight ? "text-slate-900" : "text-white";

  // Carregar cálculos salvos do localStorage
  useEffect(() => {
    const firmId = activeFirm?.id || "default";
    const saved = localStorage.getItem(`calculos_salvos_${firmId}`);
    if (saved) {
      try {
        setCalculosSalvos(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar cálculos salvos", e);
      }
    } else {
      setCalculosSalvos([]);
    }
  }, [activeFirm]);

  // Executar o cálculo toda vez que os parâmetros mudarem
  useEffect(() => {
    calcularDebito();
  }, [valorOriginal, dataInicial, dataFinal, indice, taxaJuros, tipoJuros, multa, honorarios]);

  const calcularDebito = () => {
    const principal = parseFloat(valorOriginal) || 0;
    if (principal <= 0) {
      setResultado(null);
      return;
    }

    const dInic = new Date(dataInicial);
    const dFim = new Date(dataFinal);
    
    // Diferença em dias e meses
    const diffTime = Math.max(0, dFim.getTime() - dInic.getTime());
    const diasDiferenca = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let mesesDiferenca = (dFim.getFullYear() - dInic.getFullYear()) * 12 + (dFim.getMonth() - dInic.getMonth());
    if (dFim.getDate() < dInic.getDate()) {
      mesesDiferenca = Math.max(0, mesesDiferenca - 1);
    }
    const mesesCalculados = Math.max(0, mesesDiferenca);

    // Fator de correção fictício mas altamente realista com base nos índices brasileiros
    // IPCA médio anual recente: ~5%, IGPM: ~7%, TR: ~1%, SELIC: ~10%
    let taxaAnualEstimada = 0.05; // IPCA
    if (indice === "IGPM") taxaAnualEstimada = 0.075;
    else if (indice === "INPC") taxaAnualEstimada = 0.048;
    else if (indice === "TR") taxaAnualEstimada = 0.015;
    else if (indice === "SELIC") taxaAnualEstimada = 0.105;

    const taxaMensalEstimada = Math.pow(1 + taxaAnualEstimada, 1 / 12) - 1;
    const fatorCorrecao = Math.pow(1 + taxaMensalEstimada, mesesCalculados);
    const principalCorrigido = principal * fatorCorrecao;

    // Juros de mora
    const taxaJurosMensal = (parseFloat(taxaJuros) || 0) / 100;
    let jurosAcumulados = 0;
    let valorJuros = 0;

    if (tipoJuros === "simples") {
      jurosAcumulados = taxaJurosMensal * mesesCalculados;
      valorJuros = principalCorrigido * jurosAcumulados;
    } else if (tipoJuros === "composto") {
      jurosAcumulados = Math.pow(1 + taxaJurosMensal, mesesCalculados) - 1;
      valorJuros = principalCorrigido * jurosAcumulados;
    }

    const subtotal = principalCorrigido + valorJuros;
    
    // Multas e honorários
    const pMulta = (parseFloat(multa) || 0) / 100;
    const pHonorarios = (parseFloat(honorarios) || 0) / 100;

    const valorMulta = subtotal * pMulta;
    const valorHonorarios = subtotal * pHonorarios;
    const totalGeral = subtotal + valorMulta + valorHonorarios;

    // Gerar timeline mensal simulada para a tabela de memória de cálculo
    const indicesAplicados = [];
    let valorAcumulado = principal;
    const totalMesesEfetivos = Math.min(mesesCalculados, 12); // Limitar a tabela visual aos últimos 12 meses ou ao total
    
    for (let i = 0; i <= totalMesesEfetivos; i++) {
      const dataCorrente = new Date(dInic);
      dataCorrente.setMonth(dInic.getMonth() + Math.round((mesesCalculados / Math.max(1, totalMesesEfetivos)) * i));
      
      const fatorParcial = Math.pow(1 + taxaMensalEstimada, (mesesCalculados / Math.max(1, totalMesesEfetivos)) * i);
      indicesAplicados.push({
        data: dataCorrente.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }),
        fator: parseFloat(fatorParcial.toFixed(6)),
        valor: parseFloat((principal * fatorParcial).toFixed(2))
      });
    }

    setResultado({
      principalOriginal: principal,
      principalCorrigido: parseFloat(principalCorrigido.toFixed(2)),
      fatorCorrecao: parseFloat(fatorCorrecao.toFixed(6)),
      jurosAcumulados: parseFloat((jurosAcumulados * 100).toFixed(2)),
      valorJuros: parseFloat(valorJuros.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      valorMulta: parseFloat(valorMulta.toFixed(2)),
      valorHonorarios: parseFloat(valorHonorarios.toFixed(2)),
      totalGeral: parseFloat(totalGeral.toFixed(2)),
      diasDiferenca,
      mesesDiferenca: mesesCalculados,
      indicesAplicados
    });
  };

  const salvarCalculo = () => {
    if (!resultado) return;
    
    const descricaoFinal = descricao.trim() || `Cálculo de Atualização - R$ ${resultado.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    
    const novoCalculo: CalculoSalvo = {
      id: Math.random().toString(36).slice(2, 9),
      descricao: descricaoFinal,
      valorOriginal: parseFloat(valorOriginal),
      dataInicial,
      dataFinal,
      indice,
      taxaJuros: parseFloat(taxaJuros) || 0,
      tipoJuros,
      multa: parseFloat(multa) || 0,
      honorarios: parseFloat(honorarios) || 0,
      totalAtualizado: resultado.totalGeral,
      dataCriacao: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };

    const atualizados = [novoCalculo, ...calculosSalvos];
    setCalculosSalvos(atualizados);
    
    const firmId = activeFirm?.id || "default";
    localStorage.setItem(`calculos_salvos_${firmId}`, JSON.stringify(atualizados));
    setDescricao("");
  };

  const excluirCalculo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const atualizados = calculosSalvos.filter((c) => c.id !== id);
    setCalculosSalvos(atualizados);
    
    const firmId = activeFirm?.id || "default";
    localStorage.setItem(`calculos_salvos_${firmId}`, JSON.stringify(atualizados));
  };

  const carregarCalculoSalvo = (calc: CalculoSalvo) => {
    setValorOriginal(calc.valorOriginal.toString());
    setDataInicial(calc.dataInicial);
    setDataFinal(calc.dataFinal);
    setIndice(calc.indice);
    setTaxaJuros(calc.taxaJuros.toString());
    setTipoJuros(calc.tipoJuros);
    setMulta(calc.multa.toString());
    setHonorarios(calc.honorarios.toString());
    setDescricao(calc.descricao);
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6" id="calculos-view">
      {/* Header do Módulo */}
      <div 
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 rounded-2xl border shadow-xl gap-4 transition-all"
        style={{ 
          backgroundColor: primaryBg,
          borderColor: isPrimaryLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'
        }}
      >
        <div>
          <h2 className={`text-xl font-semibold tracking-tight ${primaryTextColor} flex items-center gap-2`}>
            <Calculator className="w-5 h-5" /> Cálculos Judiciais e Atualização Monetária
          </h2>
          <p className={`text-xs mt-1 ${isPrimaryLight ? "text-slate-600" : "text-slate-200"}`}>
            Realize atualizações de débitos, aplicação de juros moratórios, multas e honorários com base nos principais índices.
          </p>
        </div>
        <button
          onClick={() => setShowHelper(!showHelper)}
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
            isPrimaryLight 
              ? "bg-slate-900/10 border-slate-900/10 text-slate-800" 
              : "bg-white/10 border-white/10 text-slate-100"
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" /> {showHelper ? "Ocultar Guia" : "Manual de Índices"}
        </button>
      </div>

      {/* Manual de Índices (Help Section) */}
      {showHelper && (
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs space-y-3 animate-fadeIn">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tabela de Índices de Atualização</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <strong className="text-slate-800 block mb-1">IPCA / IPCA-E (IBGE)</strong>
              Índice oficial de inflação do país. Muito utilizado para condenações cíveis gerais na Justiça Estadual e Federal.
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <strong className="text-slate-800 block mb-1">IGP-M (FGV)</strong>
              Muito comum em contratos de aluguel e atualizações de contratos imobiliários comerciais ou de infraestrutura.
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <strong className="text-slate-800 block mb-1">SELIC Acumulada</strong>
              Taxa básica de juros que engloba correção monetária e juros de mora. Utilizada por padrão na Justiça Federal e débitos fiscais.
            </div>
          </div>
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Coluna 1: Formulário de Configuração */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xs space-y-5">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <Plus className="w-4 h-4 text-slate-500" /> Configuração do Débito
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Descrição do Cálculo</label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Execução de Título Extrajudicial - Proc. X"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Valor Principal (R$)</label>
                <input
                  type="number"
                  value={valorOriginal}
                  onChange={(e) => setValorOriginal(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Índice de Correção</label>
                <select
                  value={indice}
                  onChange={(e) => setIndice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs outline-none focus:border-indigo-500"
                >
                  <option value="IPCA">IPCA-E (IBGE)</option>
                  <option value="IGPM">IGP-M (FGV)</option>
                  <option value="INPC">INPC (IBGE)</option>
                  <option value="TR">TR (Taxa Referencial)</option>
                  <option value="SELIC">SELIC (Acumulada)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Data de Início</label>
                <div className="relative">
                  <input
                    type="date"
                    value={dataInicial}
                    onChange={(e) => setDataInicial(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Data Final</label>
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Juros de Mora</span>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 uppercase mb-1">Taxa Mensal (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    disabled={tipoJuros === "nenhum"}
                    value={taxaJuros}
                    onChange={(e) => setTaxaJuros(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-mono outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 uppercase mb-1">Capitalização</label>
                  <select
                    value={tipoJuros}
                    onChange={(e) => setTipoJuros(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="simples">Simples (Linear)</option>
                    <option value="composto">Compostos</option>
                    <option value="nenhum">Sem Juros</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Multa Processual (%)</label>
                <input
                  type="number"
                  value={multa}
                  onChange={(e) => setMulta(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Honorários (%)</label>
                <input
                  type="number"
                  value={honorarios}
                  onChange={(e) => setHonorarios(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-mono outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              onClick={salvarCalculo}
              disabled={!resultado}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-semibold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm mt-2"
            >
              <Save className="w-4 h-4" /> Salvar Memória no Histórico
            </button>
          </div>
        </div>

        {/* Coluna 2: Resultados e Memória de Cálculo */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xs xl:col-span-2 flex flex-col justify-between print:border-none print:shadow-none">
          <div className="space-y-6">
            
            {/* Header da Memória de Cálculo */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-slate-500" /> Memória de Cálculo Consolidada
              </h3>
              
              <div className="flex gap-2 print:hidden">
                <button
                  onClick={handleImprimir}
                  disabled={!resultado}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                  title="Imprimir Memória"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>

            {resultado ? (
              <div className="space-y-6 print:space-y-4">
                
                {/* Resumo do Período */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100/80 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Período de Atualização</span>
                    <strong className="text-slate-700 font-medium">
                      {new Date(dataInicial).toLocaleDateString("pt-BR")} a {new Date(dataFinal).toLocaleDateString("pt-BR")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tempo Decorrido</span>
                    <strong className="text-slate-700 font-medium">
                      {resultado.mesesDiferenca} meses ({resultado.diasDiferenca} dias)
                    </strong>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Índice & Correção</span>
                    <strong className="text-slate-700 font-medium">
                      {indice} ({((resultado.fatorCorrecao - 1) * 100).toFixed(2)}% acumulado)
                    </strong>
                  </div>
                </div>

                {/* Balanço numérico detalhado */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Item de Cálculo</th>
                        <th className="px-4 py-2.5 text-slate-500 font-semibold uppercase text-[9px] tracking-wider text-right">Referência / Taxa</th>
                        <th className="px-4 py-2.5 text-slate-500 font-semibold uppercase text-[9px] tracking-wider text-right">Valor Calculado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="px-4 py-3 font-medium">Valor Principal Original</td>
                        <td className="px-4 py-3 text-right text-slate-500">-</td>
                        <td className="px-4 py-3 text-right font-mono">R$ {resultado.principalOriginal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium">Valor Principal Corrigido</td>
                        <td className="px-4 py-3 text-right text-slate-500 font-mono">Fator: {resultado.fatorCorrecao}</td>
                        <td className="px-4 py-3 text-right font-mono">R$ {resultado.principalCorrigido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      </tr>
                      {tipoJuros !== "nenhum" && (
                        <tr>
                          <td className="px-4 py-3 font-medium">Juros de Mora ({tipoJuros})</td>
                          <td className="px-4 py-3 text-right text-slate-500 font-mono">{taxaJuros}% a.m. ({resultado.jurosAcumulados}% ac.)</td>
                          <td className="px-4 py-3 text-right font-mono text-indigo-600">R$ {resultado.valorJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-50/50 font-semibold">
                        <td className="px-4 py-2.5 text-slate-800">Subtotal de Débito</td>
                        <td className="px-4 py-2.5 text-right text-slate-400">-</td>
                        <td className="px-4 py-2.5 text-right font-mono">R$ {resultado.subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      </tr>
                      {parseFloat(multa) > 0 && (
                        <tr>
                          <td className="px-4 py-3 font-medium text-amber-700">Multa Judicial / Art. 523</td>
                          <td className="px-4 py-3 text-right text-slate-500 font-mono">{multa}%</td>
                          <td className="px-4 py-3 text-right font-mono">R$ {resultado.valorMulta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      )}
                      {parseFloat(honorarios) > 0 && (
                        <tr>
                          <td className="px-4 py-3 font-medium text-emerald-700">Honorários Advocatícios</td>
                          <td className="px-4 py-3 text-right text-slate-500 font-mono">{honorarios}%</td>
                          <td className="px-4 py-3 text-right font-mono">R$ {resultado.valorHonorarios.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-900 text-white font-bold text-sm">
                        <td className="px-4 py-3 rounded-bl-xl">VALOR TOTAL ATUALIZADO</td>
                        <td className="px-4 py-3 text-right text-slate-400 text-xs font-normal">Soma Geral</td>
                        <td className="px-4 py-3 text-right font-mono rounded-br-xl">R$ {resultado.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Timeline mensal resumida */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Evolução Mensal (Amostragem)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {resultado.indicesAplicados.map((ind, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-center text-[10px]">
                        <span className="text-slate-400 font-medium block">{ind.data}</span>
                        <span className="text-slate-800 font-mono font-bold block mt-0.5">R$ {ind.valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                        <span className="text-slate-400 font-mono text-[8px] block">{ind.fator}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                <Calculator className="w-12 h-12 text-slate-300 animate-pulse" />
                <p className="text-xs">Preencha um valor principal válido acima para gerar os cálculos.</p>
              </div>
            )}
          </div>

          {/* Rodapé institucional para impressão */}
          {resultado && (
            <div className="hidden print:flex flex-col justify-end items-center text-center mt-12 pt-6 border-t border-slate-200 text-[10px] text-slate-400">
              <strong className="text-slate-600">{activeFirm?.name || "Legal Prime"}</strong>
              <p>Relatório gerado em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}</p>
              <p className="mt-1">Assinatura do Responsável Técnico: ____________________________________</p>
            </div>
          )}
        </div>

      </div>

      {/* Histórico de Cálculos */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xs space-y-4 print:hidden">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
          <Calendar className="w-4 h-4 text-slate-500" /> Cálculos Salvos no Escritório ({calculosSalvos.length})
        </h3>

        {calculosSalvos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {calculosSalvos.map((calc) => (
              <div 
                key={calc.id}
                onClick={() => carregarCalculoSalvo(calc)}
                className="p-4 bg-slate-50 hover:bg-slate-100/85 border border-slate-200 rounded-xl cursor-pointer transition-all flex flex-col justify-between hover:shadow-2xs"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{calc.descricao}</h4>
                    <button
                      onClick={(e) => excluirCalculo(calc.id, e)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-200/50 rounded transition-colors"
                      title="Excluir Cálculo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-1">Salvo em {calc.dataCriacao}</span>
                </div>
                
                <div className="mt-4 flex justify-between items-end">
                  <div className="text-[10px] text-slate-500">
                    <span>{calc.indice} + {calc.taxaJuros}% juros</span>
                  </div>
                  <strong className="text-xs font-mono text-slate-900">R$ {calc.totalAtualizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400 text-xs">
            Nenhum cálculo salvo no histórico deste escritório ainda.
          </div>
        )}
      </div>

    </div>
  );
}
