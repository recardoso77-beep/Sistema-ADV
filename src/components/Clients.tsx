import React, { useState } from "react";
import { User, Users, Search, Plus, X, Phone, Mail, MapPin, ClipboardList, Info, AlertCircle } from "lucide-react";
import { Client, Process } from "../types";

interface ClientsProps {
  clients: Client[];
  processes: Process[];
  token: string;
  onRefresh: () => Promise<void>;
  userRole: string;
}

export default function Clients({ clients, processes, token, onRefresh, userRole }: ClientsProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "PF" | "PJ">("all");
  
  // Modals / Details state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"PF" | "PJ">("PF");
  const [formDocument, setFormDocument] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formZip, setFormZip] = useState("");
  
  // Secondary contacts inside form
  const [contacts, setContacts] = useState<{ name: string; phone: string; role: string }[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRole, setNewContactRole] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const filteredClients = clients.filter((c) => {
    const query = search.toLowerCase();
    const matchSearch =
      c.name.toLowerCase().includes(query) ||
      c.document.includes(query) ||
      (c.email && c.email.toLowerCase().includes(query));
    
    if (filterType === "all") return matchSearch;
    return matchSearch && c.type === filterType;
  });

  const handleAddContact = () => {
    if (!newContactName.trim()) return;
    setContacts([...contacts, { name: newContactName, phone: newContactPhone, role: newContactRole }]);
    setNewContactName("");
    setNewContactPhone("");
    setNewContactRole("");
  };

  const handleRemoveContact = (index: number) => {
    setContacts(contacts.filter((_, idx) => idx !== index));
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDocument.trim()) {
      setErrorMsg("O nome do cliente e CPF/CNPJ são obrigatórios.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const newClientPayload = {
      name: formName,
      type: formType,
      document: formDocument,
      email: formEmail,
      phone: formPhone,
      notes: formNotes,
      address: {
        street: formStreet,
        city: formCity,
        state: formState,
        zip: formZip,
      },
      contacts: contacts,
    };

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newClientPayload),
      });

      if (res.ok) {
        await onRefresh();
        setIsNewModalOpen(false);
        // Reset states
        setFormName("");
        setFormType("PF");
        setFormDocument("");
        setFormEmail("");
        setFormPhone("");
        setFormNotes("");
        setFormStreet("");
        setFormCity("");
        setFormState("");
        setFormZip("");
        setContacts([]);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Ocorreu um erro ao salvar o cliente.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="clients-module-view">
      {/* Header and Add client trigger button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">CRM de Clientes</h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie pessoas físicas e jurídicas do escritório.</p>
        </div>
        {userRole !== "client" && (
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo Cliente
          </button>
        )}
      </div>

      {/* Filter and search controllers */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome, e-mail ou documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs outline-none focus:border-indigo-500 text-slate-800"
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              filterType === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType("PF")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              filterType === "PF" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Pessoa Física
          </button>
          <button
            onClick={() => setFilterType("PJ")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              filterType === "PJ" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Pessoa Jurídica
          </button>
        </div>
      </div>

      {/* Clients Listing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => {
          const clientProcesses = processes.filter((p) => p.client_id === client.id);

          return (
            <div
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="bg-white border border-slate-200 hover:border-slate-300 p-5 rounded-2xl transition-all shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    client.type === "PJ" ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  }`}>
                    {client.type === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">ID: #{client.id}</span>
                </div>
                <h3 className="font-semibold text-slate-800 text-sm mt-3 line-clamp-1">{client.name}</h3>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">{client.document}</p>

                <div className="space-y-1.5 mt-4 text-[11px] text-slate-600">
                  {client.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px]">
                <span className="text-slate-500 font-medium">
                  {clientProcesses.length} {clientProcesses.length === 1 ? "Processo" : "Processos"}
                </span>
                <span className="text-indigo-600 font-semibold group-hover:underline">Visualizar Ficha →</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandable Client Drawer / Modal details */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-100">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${selectedClient.type === "PJ" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {selectedClient.type === "PJ" ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-950">{selectedClient.name}</h3>
                  <p className="text-[10px] font-mono text-slate-400">{selectedClient.document}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content body */}
            <div className="p-6 space-y-6 text-xs text-slate-700">
              {/* Address details */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" /> Endereço Principal
                </h4>
                {selectedClient.address?.street ? (
                  <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    {selectedClient.address.street}, {selectedClient.address.city} - {selectedClient.address.state}, CEP {selectedClient.address.zip}
                  </p>
                ) : (
                  <p className="text-slate-400 italic">Nenhum endereço completo cadastrado.</p>
                )}
              </div>

              {/* Contacts */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <Users className="w-4 h-4 text-slate-400" /> Contatos Adicionais e Representantes
                </h4>
                {selectedClient.contacts?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedClient.contacts.map((c, i) => (
                      <div key={i} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                        <p className="font-semibold text-slate-800">{c.name}</p>
                        <p className="text-[10px] text-slate-500">{c.role} • {c.phone}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Nenhum contato secundário cadastrado.</p>
                )}
              </div>

              {/* Linked processes */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <ClipboardList className="w-4 h-4 text-slate-400" /> Processos Vinculados
                </h4>
                {processes.filter((p) => p.client_id === selectedClient.id).length > 0 ? (
                  <div className="space-y-2">
                    {processes
                      .filter((p) => p.client_id === selectedClient.id)
                      .map((p) => (
                        <div key={p.id} className="p-2.5 border border-slate-100 hover:border-slate-200 rounded-lg flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-slate-800">{p.title}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{p.cnj} • {p.vara}</p>
                          </div>
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                            p.status === "Ativo" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            {p.status}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Nenhum processo judicial cadastrado para este cliente.</p>
                )}
              </div>

              {/* Notes */}
              {selectedClient.notes && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                    <Info className="w-4 h-4 text-slate-400" /> Notas Importantes
                  </h4>
                  <p className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-600 leading-relaxed italic">
                    "{selectedClient.notes}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Client Onboarding Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" /> Cadastrar Novo Cliente
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Basic Toggle */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Tipo de Pessoa</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      setFormType(e.target.value as "PF" | "PJ");
                      setFormDocument("");
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="PF">Pessoa Física (CPF)</option>
                    <option value="PJ">Pessoa Jurídica (CNPJ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    {formType === "PF" ? "CPF do Cliente" : "CNPJ da Empresa"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={formType === "PF" ? "000.000.000-00" : "00.000.000/0001-00"}
                    value={formDocument}
                    onChange={(e) => setFormDocument(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Name & Contact */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Razão Social / Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Roberto Silva ou Sportix Tech Ltda"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">E-mail Comercial</label>
                  <input
                    type="email"
                    placeholder="cliente@email.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Telefone/WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="font-semibold text-slate-800 text-[11px]">Endereço Postal</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Rua, Número e Bairro"
                      value={formStreet}
                      onChange={(e) => setFormStreet(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="CEP"
                      value={formZip}
                      onChange={(e) => setFormZip(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Estado (Ex: SP)"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Dynamic secondary contacts */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <h4 className="font-semibold text-slate-800 text-[11px]">Representantes Adicionais / Contatos Secundários</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none flex-1"
                  />
                  <input
                    type="text"
                    placeholder="Cargo"
                    value={newContactRole}
                    onChange={(e) => setNewContactRole(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none w-24"
                  />
                  <input
                    type="text"
                    placeholder="Telefone"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none w-28"
                  />
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {contacts.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {contacts.map((c, index) => (
                      <span key={index} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[10px] flex items-center gap-1">
                        {c.name} ({c.role})
                        <button type="button" onClick={() => handleRemoveContact(index)} className="text-slate-400 hover:text-rose-600">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1 font-semibold">Observações Internas</label>
                <textarea
                  rows={2}
                  placeholder="Indicações, faturamento fixo, prazos, etc."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-xl transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {loading ? "Gravando..." : "Salvar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
