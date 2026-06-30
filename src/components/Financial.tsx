import React, { useState } from "react";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Plus, X, Search, DollarSign, QrCode, ClipboardCheck, Info, Check, AlertCircle } from "lucide-react";
import { FinancialItem, Client, Process } from "../types";

interface FinancialProps {
  finances: FinancialItem[];
  clients: Client[];
  processes: Process[];
  token: string;
  onRefresh: () => Promise<void>;
  userRole: string;
}

export default function Financial({ finances, clients, processes, token, onRefresh, userRole }: FinancialProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "revenue" | "expense">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "Pago" | "Pendente" | "Atrasado">("all");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<FinancialItem | null>(null);
  const [copied, setCopied] = useState(false);

  // Form State
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState<"revenue" | "expense">("revenue");
  const [formCategory, setFormCategory] = useState("Honorários");
  const [formDueDate, setFormDueDate] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formProcessId, setFormProcessId] = useState("");
  const [formRecurrence, setFormRecurrence] = useState<"Único" | "Mensal">("Único");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const filteredFinances = finances.filter((item) => {
    const query = search.toLowerCase();
    const matchSearch = item.description.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);
    const matchType = filterType === "all" ? true : item.type === filterType;
    const matchStatus = filterStatus === "all" ? true : item.status === filterStatus;

    return matchSearch && matchType && matchStatus;
  });

  // Financial aggregates
  const totalPaidRevenue = finances
    .filter((f) => f.type === "revenue" && f.status === "Pago")
    .reduce((sum, item) => sum + item.amount, 0);

  const totalPaidExpense = finances
    .filter((f) => f.type === "expense" && f.status === "Pago")
    .reduce((sum, item) => sum + item.amount, 0);

  const outstandingReceivable = finances
    .filter((f) => f.type === "revenue" && f.status !== "Pago")
    .reduce((sum, item) => sum + item.amount, 0);

  const netBalance = totalPaidRevenue - totalPaidExpense;

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription.trim() || !formAmount || !formDueDate) {
      setErrorMsg("Descrição, valor e vencimento são obrigatórios.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const payload = {
      description: formDescription,
      amount: parseFloat(formAmount),
      type: formType,
      category: formCategory,
      due_date: new Date(formDueDate).toISOString().split("T")[0],
      status: "Pendente",
      client_id: formClientId || null,
      process_id: formProcessId || null,
      recurrence: formRecurrence,
    };

    try {
      const res = await fetch("/api/financial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await onRefresh();
        setIsNewModalOpen(false);
        // Reset form
        setFormDescription("");
        setFormAmount("");
        setFormDueDate("");
        setFormClientId("");
        setFormProcessId("");
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Erro ao registrar transação.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/financial/${id}/pay`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyPix = (pixCode: string) => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6" id="financial-module-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Fluxo de Caixa e Honorários</h2>
          <p className="text-xs text-slate-400 mt-1">Monitore repasses, custas e gere faturas Pix instantâneas para clientes.</p>
        </div>
        {userRole !== "client" && (
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Lançar Transação
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Entradas Conciliadas</span>
          <span className="text-2xl font-bold text-slate-900 block mt-2">R$ {totalPaidRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" /> Pago pelo cliente
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Despesas Baixadas</span>
          <span className="text-2xl font-bold text-rose-600 block mt-2">R$ {totalPaidExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-rose-500 font-medium flex items-center gap-0.5 mt-2">
            <ArrowDownRight className="w-3.5 h-3.5" /> Custo de Operações
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Honorários a Receber</span>
          <span className="text-2xl font-bold text-amber-600 block mt-2">R$ {outstandingReceivable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5 mt-2">
            Pendente de Depósito
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Balanço Líquido</span>
          <span className={`text-2xl font-bold block mt-2 ${netBalance >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
            R$ {netBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 block mt-2">
            Resultado financeiro geral
          </span>
        </div>
      </div>

      {/* Ledger Actions & Filters */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por descrição ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs outline-none focus:border-indigo-500 text-slate-800"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="all">Tipo: Todos</option>
            <option value="revenue">Receitas (Entradas)</option>
            <option value="expense">Despesas (Saídas)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="all">Status: Todos</option>
            <option value="Pago">Pago / Conciliado</option>
            <option value="Pendente">Pendente</option>
            <option value="Atrasado">Atrasado</option>
          </select>
        </div>
      </div>

      {/* Ledger ledger list table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <th className="p-4">Descrição</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Vencimento</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredFinances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Nenhum lançamento contábil correspondente aos filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredFinances.map((item) => {
                  const clientName = clients.find((c) => c.id === item.client_id)?.name;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/20">
                      <td className="p-4">
                        <p className="font-semibold text-slate-800">{item.description}</p>
                        {clientName && <p className="text-[10px] text-indigo-600">Sacado: {clientName}</p>}
                      </td>
                      <td className="p-4 font-semibold text-slate-900">
                        R$ {item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          item.type === "revenue" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                        }`}>
                          {item.type === "revenue" ? "Receita" : "Despesa"}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-slate-600">{item.category}</td>
                      <td className="p-4 font-mono text-slate-500">
                        {new Date(item.due_date).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                          item.status === "Pago" ? "text-emerald-600" :
                          item.status === "Atrasado" ? "text-rose-600" : "text-amber-600"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            item.status === "Pago" ? "bg-emerald-500" :
                            item.status === "Atrasado" ? "bg-rose-500" : "bg-amber-500"
                          }`} />
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {item.status !== "Pago" && item.type === "revenue" && (
                            <button
                              onClick={() => setSelectedInvoice(item)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              title="Gerar código e QR Code Pix para cobrança imediata"
                            >
                              <QrCode className="w-3.5 h-3.5" /> Cobrar
                            </button>
                          )}
                          {item.status !== "Pago" && userRole !== "client" && (
                            <button
                              onClick={() => handleMarkAsPaid(item.id)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer"
                            >
                              Baixar Pago
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pix Billing Qr Code invoice modal popup */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-5 border border-slate-100 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="font-semibold text-slate-800 text-xs sm:text-sm">Fatura / QR Code Pix de Cobrança</span>
              <button onClick={() => setSelectedInvoice(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-slate-900 text-xs">{selectedInvoice.description}</h4>
              <p className="text-xl font-bold text-indigo-600">
                R$ {selectedInvoice.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Simulated styled QR Code */}
            <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl inline-block relative">
              <svg className="w-40 h-40 mx-auto text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                {/* Simulated QR matrix blocks */}
                <rect x="5" y="5" width="20" height="20" />
                <rect x="9" y="9" width="12" height="12" fill="white" />
                <rect x="12" y="12" width="6" height="6" />

                <rect x="75" y="5" width="20" height="20" />
                <rect x="79" y="9" width="12" height="12" fill="white" />
                <rect x="82" y="12" width="6" height="6" />

                <rect x="5" y="75" width="20" height="20" />
                <rect x="9" y="79" width="12" height="12" fill="white" />
                <rect x="12" y="82" width="6" height="6" />

                {/* Random matrix noise points */}
                <rect x="35" y="10" width="5" height="15" />
                <rect x="45" y="5" width="8" height="5" />
                <rect x="30" y="30" width="25" height="5" />
                <rect x="60" y="35" width="5" height="20" />
                <rect x="10" y="45" width="15" height="5" />
                <rect x="70" y="70" width="15" height="15" />
                <rect x="35" y="65" width="20" height="10" />
                {/* Pix logo centered box */}
                <rect x="40" y="40" width="20" height="20" fill="white" stroke="indigo" strokeWidth="2" />
                <text x="50" y="52" fontSize="6" fontWeight="bold" textAnchor="middle" fill="indigo">PIX</text>
              </svg>
              <p className="text-[9px] text-slate-400 mt-2">Escaneie o código no aplicativo do seu banco.</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleCopyPix(selectedInvoice.pix_code || "00020126360014br.gov.bcb.pix0114testpixkey123520400005303986540550.005802BR5915LegalOneFirm6009SaoPaulo62070503cob")}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                {copied ? <ClipboardCheck className="w-4 h-4 text-emerald-300" /> : <ClipboardCheck className="w-4 h-4" />}
                {copied ? "Pix Copiado com Sucesso!" : "Copiar Chave Copia e Cola"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Lançamento Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" /> Lançar Nova Movimentação Financeira
              </h3>
              <button onClick={() => setIsNewModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Tipo de Lançamento</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      setFormType(e.target.value as any);
                      setFormCategory(e.target.value === "revenue" ? "Honorários" : "Custas");
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="revenue">Honorários / Entradas (Receitas)</option>
                    <option value="expense">Operacional / Saídas (Despesas)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Categoria</label>
                  {formType === "revenue" ? (
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                    >
                      <option value="Honorários">Honorários Contratuais</option>
                      <option value="Honorários Sucumbenciais">Honorários Sucumbenciais</option>
                      <option value="Repasse">Repasse de Clientes</option>
                    </select>
                  ) : (
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                    >
                      <option value="Custas">Custas Processuais</option>
                      <option value="Impostos">Impostos / DARF</option>
                      <option value="Salários">Salários / Pró-labore</option>
                      <option value="Infraestrutura">Aluguel / Internet / Softwares</option>
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pagamento 1ª Parcela Honorários Carlos Santos"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Valor da Operação (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 1500"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Data de Vencimento</label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Vincular Cliente (Opcional)</label>
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Vincular Processo (Opcional)</label>
                  <select
                    value={formProcessId}
                    onChange={(e) => setFormProcessId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    {processes.map((p) => (
                      <option key={p.id} value={p.id}>{p.court} - {p.cnj}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-sm cursor-pointer"
                >
                  {loading ? "Registrando..." : "Registrar Lançamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
