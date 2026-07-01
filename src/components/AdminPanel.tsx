import React, { useState, useEffect } from "react";
import { ShieldAlert, Users, ClipboardCheck, Database, Save, Check, Download, Info, ToggleLeft, ToggleRight, Trash2, KeyRound, Building2, UserPlus, ShieldAlert as AlertIcon, ShieldCheck, Shield, Mail, Send } from "lucide-react";
import { User, AuditLog, LawFirm } from "../types";

interface AdminPanelProps {
  users: User[];
  token: string;
  onRefresh: () => Promise<void>;
  userRole: string;
  currentUser?: User;
}

export default function AdminPanel({ users, token, onRefresh, userRole, currentUser }: AdminPanelProps) {
  const [subTab, setSubTab] = useState<"users" | "lawFirms" | "audit" | "backup" | "smtp">("users");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Estados de Configuração SMTP do Servidor de E-mail
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSenderName, setSmtpSenderName] = useState("Legal Prime");
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpSuccess, setSmtpSuccess] = useState<string | null>(null);
  const [smtpError, setSmtpError] = useState<string | null>(null);

  // Estados do E-mail de Teste SMTP
  const [testEmail, setTestEmail] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailSuccess, setTestEmailSuccess] = useState<string | null>(null);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);
  
  // Law Firms state
  const [lawFirms, setLawFirms] = useState<LawFirm[]>([]);
  const [firmsLoading, setFirmsLoading] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState<LawFirm | null>(null);
  const [showCreateFirmForm, setShowCreateFirmForm] = useState(false);
  const [firmName, setFirmName] = useState("");
  const [firmCnpj, setFirmCnpj] = useState("");
  const [firmLicenses, setFirmLicenses] = useState(5);
  const [firmActive, setFirmActive] = useState(true);
  const [firmLogoUrl, setFirmLogoUrl] = useState("");
  const [firmPrimaryColor, setFirmPrimaryColor] = useState("#4f46e5");
  const [firmSecondaryColor, setFirmSecondaryColor] = useState("#111827");
  const [savingFirm, setSavingFirm] = useState(false);
  const [deleteFirmConfirmId, setDeleteFirmConfirmId] = useState<string | null>(null);

  // User edit state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<any>("");
  const [editingActive, setEditingActive] = useState(true);
  const [editingFirmId, setEditingFirmId] = useState("");
  const [editingPerms, setEditingPerms] = useState<string[]>([]);
  const [editingOab, setEditingOab] = useState("");
  const [loadingSave, setLoadingSave] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // User creation state
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<any>("lawyer");
  const [newUserFirmId, setNewUserFirmId] = useState("1");
  const [newUserPerms, setNewUserPerms] = useState<string[]>(["READ", "WRITE"]);
  const [newUserOab, setNewUserOab] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [creationError, setCreationError] = useState("");

  useEffect(() => {
    fetchLawFirms();
  }, []);

  useEffect(() => {
    if (subTab === "audit") {
      fetchAuditLogs();
    } else if (subTab === "smtp") {
      fetchSmtpSettings();
    }
  }, [subTab]);

  const fetchSmtpSettings = async () => {
    setSmtpLoading(true);
    setSmtpSuccess(null);
    setSmtpError(null);
    try {
      const res = await fetch("/api/admin/smtp", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSmtpHost(data.host || "");
        setSmtpPort(data.port || 587);
        setSmtpSecure(data.secure === 1 || data.secure === true);
        setSmtpUser(data.user || "");
        setSmtpPassword(data.password || "");
        setSmtpSenderName(data.sender_name || "Legal Prime");
      }
    } catch (e: any) {
      setSmtpError("Erro ao carregar configurações de e-mail.");
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpSaving(true);
    setSmtpSuccess(null);
    setSmtpError(null);
    try {
      const res = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort),
          secure: smtpSecure ? 1 : 0,
          user: smtpUser,
          password: smtpPassword,
          sender_name: smtpSenderName,
        }),
      });
      if (res.ok) {
        setSmtpSuccess("Configurações do servidor SMTP atualizadas com sucesso!");
      } else {
        const data = await res.json();
        setSmtpError(data.error || "Erro ao salvar configurações do servidor SMTP.");
      }
    } catch (e: any) {
      setSmtpError("Erro ao comunicar com o servidor.");
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) {
      setTestEmailError("Informe um endereço de e-mail válido para realizar o teste de disparo.");
      return;
    }
    setTestEmailLoading(true);
    setTestEmailSuccess(null);
    setTestEmailError(null);
    try {
      const res = await fetch("/api/admin/smtp/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ toEmail: testEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestEmailSuccess(
          data.simulated
            ? "Simulação Realizada com Sucesso! Como as configurações atuais são fictícias, o e-mail foi simulado com total sucesso no console de logs do servidor."
            : "E-mail de Teste Disparado com Sucesso! Verifique a caixa de entrada do e-mail de destino."
        );
      } else {
        setTestEmailError(data.error || "Falha ao disparar o e-mail de teste SMTP.");
      }
    } catch (e: any) {
      setTestEmailError("Erro de comunicação ao disparar e-mail de teste.");
    } finally {
      setTestEmailLoading(false);
    }
  };

  const fetchLawFirms = async () => {
    setFirmsLoading(true);
    try {
      const res = await fetch("/api/admin/law-firms", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setLawFirms(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFirmsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch("/api/admin/audit-logs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setEditingRole(user.role);
    setEditingActive(user.active);
    setEditingFirmId(user.law_firm_id || "");
    setEditingPerms(user.permissions || []);
    setEditingOab(user.oab || "");
    setDeleteConfirmId(null);
    setShowCreateUserForm(false);
  };

  const handleTogglePerm = (perm: string) => {
    if (editingPerms.includes(perm)) {
      setEditingPerms(editingPerms.filter((p) => p !== perm));
    } else {
      setEditingPerms([...editingPerms, perm]);
    }
  };

  const handleToggleNewUserPerm = (perm: string) => {
    if (newUserPerms.includes(perm)) {
      setNewUserPerms(newUserPerms.filter((p) => p !== perm));
    } else {
      setNewUserPerms([...newUserPerms, perm]);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (deleteConfirmId !== userId) {
      setDeleteConfirmId(userId);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setDeleteConfirmId(null);
        setSelectedUser(null);
        await onRefresh();
      } else {
        const errData = await res.json();
        alert(errData.error || "Erro ao excluir operador.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveUserPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setLoadingSave(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: editingRole,
          active: editingActive,
          law_firm_id: editingFirmId,
          permissions: editingPerms,
          oab: editingOab,
        }),
      });

      if (res.ok) {
        await onRefresh();
        setSelectedUser(null);
        alert("Operador atualizado com sucesso!");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao salvar permissões de usuário.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSave(false);
    }
  };

  // User registration
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreationError("");
    if (!newUserName || !newUserEmail || !newUserPassword || !newUserRole) {
      setCreationError("Preencha todos os campos obrigatórios.");
      return;
    }

    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          law_firm_id: newUserFirmId,
          permissions: newUserPerms,
          oab: newUserOab
        }),
      });

      if (res.ok) {
        // Clear form
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserRole("lawyer");
        setNewUserPerms(["READ", "WRITE"]);
        setNewUserOab("");
        setShowCreateUserForm(false);
        await onRefresh();
        alert("Novo operador cadastrado com sucesso!");
      } else {
        const errData = await res.json();
        setCreationError(errData.error || "Erro ao cadastrar operador.");
      }
    } catch (e) {
      setCreationError("Falha de comunicação com o servidor.");
    } finally {
      setCreatingUser(false);
    }
  };

  // Law Firm Actions
  const handleCreateFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName) {
      alert("O nome do escritório é obrigatório.");
      return;
    }

    setSavingFirm(true);
    try {
      const res = await fetch("/api/admin/law-firms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: firmName,
          cnpj: firmCnpj,
          licenses: Number(firmLicenses),
          active: firmActive,
          logo_url: firmLogoUrl,
          primary_color: firmPrimaryColor,
          secondary_color: firmSecondaryColor
        }),
      });

      if (res.ok) {
        setFirmName("");
        setFirmCnpj("");
        setFirmLicenses(5);
        setFirmActive(true);
        setFirmLogoUrl("");
        setFirmPrimaryColor("#4f46e5");
        setFirmSecondaryColor("#111827");
        setShowCreateFirmForm(false);
        await fetchLawFirms();
        alert("Novo escritório cadastrado com sucesso!");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao cadastrar escritório.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingFirm(false);
    }
  };

  const handleUpdateFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFirm) return;

    setSavingFirm(true);
    try {
      const res = await fetch(`/api/admin/law-firms/${selectedFirm.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(selectedFirm),
      });

      if (res.ok) {
        setSelectedFirm(null);
        await fetchLawFirms();
        alert("Escritório atualizado com sucesso!");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao atualizar escritório.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingFirm(false);
    }
  };

  const handleDeleteFirm = async (firmId: string) => {
    if (deleteFirmConfirmId !== firmId) {
      setDeleteFirmConfirmId(firmId);
      return;
    }

    try {
      const res = await fetch(`/api/admin/law-firms/${firmId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setDeleteFirmConfirmId(null);
        setSelectedFirm(null);
        await fetchLawFirms();
        alert("Escritório removido do sistema.");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao excluir escritório.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getFirmUsersCount = (firmId: string) => {
    const firmUsers = users.filter((u) => u.law_firm_id === firmId || (!u.law_firm_id && firmId === "1"));
    const activeCount = firmUsers.filter((u) => u.active).length;
    return { active: activeCount, total: firmUsers.length };
  };

  const handleTriggerBackup = async () => {
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `backup_legalone_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert("Erro ao processar backup do banco de dados.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const hasAccess = userRole === "admin" || userRole === "partner" || currentUser?.permissions?.includes("BYPASS_LGPD");

  if (!hasAccess) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-100 rounded-3xl max-w-md mx-auto space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto animate-bounce" />
        <h3 className="font-bold text-slate-800 text-sm">Acesso Restrito - Área de Segurança</h3>
        <p className="text-xs text-slate-500">
          Você não possui privilégios de Administrador ou Sócio Diretor para visualizar logs de conformidade LGPD ou reconfigurar permissões de operador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="admin-module-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Painel de Administração e Clusters de Escritórios</h2>
          <p className="text-xs text-slate-400 mt-1">Controle de acessos, gestão de licenças, auditoria imutável LGPD e isolamento multi-tenant.</p>
        </div>
      </div>

      {/* Sub Tabs switcher */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start inline-flex overflow-x-auto max-w-full">
        <button
          onClick={() => setSubTab("users")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            subTab === "users" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Controle de Operadores ({users.length})
        </button>
        <button
          onClick={() => setSubTab("lawFirms")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            subTab === "lawFirms" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Escritórios / Clusters ({lawFirms.length})
        </button>
        <button
          onClick={() => setSubTab("audit")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            subTab === "audit" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Trilhas de Auditoria LGPD
        </button>
        <button
          onClick={() => setSubTab("backup")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            subTab === "backup" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Segurança e Backup
        </button>
        <button
          onClick={() => setSubTab("smtp")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            subTab === "smtp" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Configurações de E-mail (SMTP)
        </button>
      </div>

      {/* Tab 1: Operator list & creation */}
      {subTab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* User list */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2">
              <span className="text-xs text-slate-500 font-semibold">Tabela de Operadores</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setNewUserName("");
                    setNewUserEmail("");
                    setNewUserPassword("");
                    setNewUserRole("admin");
                    setNewUserFirmId(""); // Nenhum (Superadmin Global)
                    setNewUserPerms(["all", "READ", "WRITE", "DELETE", "EXPORT_FINANCES", "EXECUTE_AI"]);
                    setShowCreateUserForm(true);
                    setSelectedUser(null);
                  }}
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Cadastrar Superadmin
                </button>
                <button
                  onClick={() => {
                    setNewUserName("");
                    setNewUserEmail("");
                    setNewUserPassword("");
                    setNewUserRole("lawyer");
                    setNewUserFirmId("1");
                    setNewUserPerms(["READ", "WRITE"]);
                    setShowCreateUserForm(!showCreateUserForm);
                    setSelectedUser(null);
                  }}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Cadastrar Operador
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                      <th className="p-4">Operador</th>
                      <th className="p-4">Cargo / Role</th>
                      <th className="p-4">Escritório (Cluster)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Configurações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => {
                      const isUserSuperAdmin = user.role === "admin" && !user.law_firm_id;
                      const firm = isUserSuperAdmin ? null : lawFirms.find((f) => f.id === user.law_firm_id || (!user.law_firm_id && f.id === "1"));
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/20 text-slate-700">
                          <td className="p-4">
                            <p className="font-semibold text-slate-800">{user.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {user.email}
                              {user.oab && <span className="ml-1.5 text-indigo-600 font-sans font-semibold">| OAB: {user.oab}</span>}
                            </p>
                          </td>
                          <td className="p-4">
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full text-[10px] uppercase">
                              {user.role}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-slate-600">
                            {isUserSuperAdmin ? (
                              <span className="bg-amber-50 border border-amber-200 text-amber-700 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                ⭐ Superadmin (Global)
                              </span>
                            ) : (
                              firm ? firm.name : "Sem escritório"
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                              user.active ? "text-emerald-600" : "text-slate-400"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${user.active ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                              {user.active ? "Ativo" : "Suspenso"}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleSelectUser(user)}
                              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                            >
                              Gerenciar Acesso →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* User privileges editor OR User creation form */}
          <div className="lg:col-span-5">
            {showCreateUserForm ? (
              <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-semibold text-indigo-950 text-sm flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-indigo-600" />
                    Cadastrar Novo Operador (Licença)
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Adiciona uma credencial ao cluster de usuários de um escritório.</p>
                </div>

                {creationError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                    <AlertIcon className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                    <span>{creationError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Ex: Dr. Roberto Alencar"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">E-mail de Login</label>
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="roberto@aall.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Senha Inicial</label>
                    <input
                      type="password"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Senha segura de acesso"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Número da OAB (Opcional)</label>
                    <input
                      type="text"
                      value={newUserOab}
                      onChange={(e) => setNewUserOab(e.target.value)}
                      placeholder="Ex: 123456/SP"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 font-semibold"
                    />
                    <p className="text-[9px] text-slate-400 mt-0.5">Se preenchido, o sistema efetuará varreduras automáticas de publicações usando este número.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Nível / Role</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewUserRole(val as any);
                          if (val === "admin") {
                            setNewUserFirmId("");
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-800 outline-none focus:border-indigo-500"
                      >
                        <option value="admin">Administrador</option>
                        <option value="partner">Sócio Diretor</option>
                        <option value="lawyer">Advogado</option>
                        <option value="finance">Financeiro</option>
                        <option value="secretary">Secretária</option>
                        <option value="intern">Estagiário</option>
                        <option value="client">Cliente (Portal)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Escritório Alvo</label>
                      <select
                        value={newUserFirmId}
                        onChange={(e) => setNewUserFirmId(e.target.value)}
                        disabled={newUserRole === "admin"}
                        className={`w-full border border-slate-200 rounded-xl px-2 py-2 text-slate-800 outline-none focus:border-indigo-500 font-medium ${
                          newUserRole === "admin"
                            ? "bg-slate-100 opacity-60 cursor-not-allowed"
                            : "bg-slate-50"
                        }`}
                      >
                        <option value="">Nenhum (Superadmin Global)</option>
                        {lawFirms.map((f) => {
                          const counts = getFirmUsersCount(f.id);
                          return (
                            <option key={f.id} value={f.id}>
                              {f.name} ({counts.active}/{f.licenses} licenças)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Access financial module toggle */}
                  <div className="flex justify-between items-center bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                    <div>
                      <span className="font-semibold text-emerald-950 block text-[11px]">Acesso ao Módulo Financeiro</span>
                      <span className="text-[9px] text-emerald-800">Concede permissão para visualizar caixa e Pix.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleNewUserPerm("FINANCIAL_ACCESS")}
                      className="text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      {newUserPerms.includes("FINANCIAL_ACCESS") ? (
                        <ToggleRight className="w-8 h-8 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Explicit Permissions checklist */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase">Permissões Específicas</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px]">
                      {["READ", "WRITE", "DELETE", "EXPORT_FINANCES", "EXECUTE_AI"].map((p) => (
                        <label key={p} className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                          <input
                            type="checkbox"
                            checked={newUserPerms.includes(p)}
                            onChange={() => handleToggleNewUserPerm(p)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>
                            {p === "READ" ? "Ler dados" :
                             p === "WRITE" ? "Escrever" :
                             p === "DELETE" ? "Excluir" :
                             p === "EXPORT_FINANCES" ? "Exportar" : "Executar IA"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowCreateUserForm(false)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-3 py-1.5 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creatingUser}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1 shadow-sm"
                    >
                      {creatingUser ? "Salvando..." : "Criar e Ativar"}
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedUser ? (
              <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-5 animate-fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-semibold text-slate-900 text-sm">Privilégios de Acesso</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{selectedUser.name} ({selectedUser.email})</p>
                </div>

                <form onSubmit={handleSaveUserPermissions} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Nível Administrativo</label>
                      <select
                        value={editingRole}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingRole(val as any);
                          if (val === "admin") {
                            setEditingFirmId("");
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-800 outline-none focus:border-indigo-500"
                      >
                        <option value="admin">Administrador Geral</option>
                        <option value="partner">Sócio Diretor (Partner)</option>
                        <option value="lawyer">Advogado Sênior/Associado</option>
                        <option value="finance">Financeiro do Escritório</option>
                        <option value="secretary">Secretária</option>
                        <option value="intern">Estagiário</option>
                        <option value="client">Cliente (Portal)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Escritório Associado</label>
                      <select
                        value={editingFirmId}
                        onChange={(e) => setEditingFirmId(e.target.value)}
                        disabled={editingRole === "admin"}
                        className={`w-full border border-slate-200 rounded-xl px-2 py-2 text-slate-800 outline-none focus:border-indigo-500 font-medium ${
                          editingRole === "admin"
                            ? "bg-slate-100 opacity-60 cursor-not-allowed"
                            : "bg-slate-50"
                        }`}
                      >
                        <option value="">Nenhum (Superadmin Global)</option>
                        {lawFirms.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Número da OAB (Opcional)</label>
                    <input
                      type="text"
                      value={editingOab}
                      onChange={(e) => setEditingOab(e.target.value)}
                      placeholder="Ex: 123456/SP"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 font-semibold"
                    />
                    <p className="text-[9px] text-slate-400 mt-0.5">Se preenchido, o sistema efetuará varreduras automáticas de publicações usando este número.</p>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-800 block">Status da Conta</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Operadores suspensos perdem acesso imediato.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingActive(!editingActive)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {editingActive ? (
                        <ToggleRight className="w-9 h-9 text-indigo-600" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Financial Module Access Toggle */}
                  <div className="flex justify-between items-center bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                    <div>
                      <span className="font-semibold text-emerald-950 block">Acesso ao Módulo Financeiro</span>
                      <span className="text-[10px] text-emerald-800 mt-0.5">Permite visualizar fluxo de caixa, faturas e Pix.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePerm("FINANCIAL_ACCESS")}
                      className="text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      {editingPerms.includes("FINANCIAL_ACCESS") ? (
                        <ToggleRight className="w-9 h-9 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Explicit Permissions checklist */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Permissões Específicas</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {["READ", "WRITE", "DELETE", "EXPORT_FINANCES", "EXECUTE_AI", "BYPASS_LGPD"].map((p) => (
                        <label key={p} className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700">
                          <input
                            type="checkbox"
                            checked={editingPerms.includes(p)}
                            onChange={() => handleTogglePerm(p)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>
                            {p === "WRITE" ? "Editar Dados" : 
                             p === "DELETE" ? "Excluir Registros" : 
                             p === "EXPORT_FINANCES" ? "Exportar Relatórios" : p}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Save & Delete actions */}
                  <div className="flex flex-col sm:flex-row gap-2 justify-between pt-3 border-t border-slate-100">
                    {/* Excluir Operador */}
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => handleDeleteUser(selectedUser.id)}
                      className={`text-xs font-semibold px-3 py-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                        deleteConfirmId === selectedUser.id
                          ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse"
                          : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-100"
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deleting
                        ? "Excluindo..."
                        : deleteConfirmId === selectedUser.id
                        ? "Confirmar Exclusão?"
                        : "Excluir Operador"}
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(null);
                          setDeleteConfirmId(null);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-4 py-2 rounded-xl text-center"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={loadingSave}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-1 transition-colors shadow-sm text-center"
                      >
                        <Save className="w-3.5 h-3.5" /> {loadingSave ? "Salvando..." : "Salvar Permissões"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 bg-slate-50/50 p-6 rounded-2xl text-center text-slate-400 text-xs h-40 flex flex-col items-center justify-center">
                <Users className="w-8 h-8 text-slate-300 mb-1 opacity-70 animate-pulse" />
                <p className="font-semibold text-slate-500">Selecione um Operador</p>
                <p className="text-[10px] text-slate-400 mt-1">Ajuste níveis de permissões, suspenda acessos, associe a clusters ou adicione novos membros.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Law Firms / Clusters CRUD */}
      {subTab === "lawFirms" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Firms list */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">Tabela de Escritórios (Clusters Multi-tenant)</span>
              <button
                onClick={() => {
                  setShowCreateFirmForm(!showCreateFirmForm);
                  setSelectedFirm(null);
                }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              >
                <Building2 className="w-3.5 h-3.5" />
                Cadastrar Escritório
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                      <th className="p-4">Nome do Escritório</th>
                      <th className="p-4">CNPJ</th>
                      <th className="p-4">Licenças Utilizadas</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lawFirms.map((firm) => {
                      const stats = getFirmUsersCount(firm.id);
                      return (
                        <tr key={firm.id} className="hover:bg-slate-50/20 text-slate-700">
                          <td className="p-4">
                            <p className="font-semibold text-slate-800">{firm.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono">ID do Cluster: #{firm.id}</p>
                          </td>
                          <td className="p-4 font-mono text-slate-500">
                            {firm.cnpj || "Sem CNPJ cadastrado"}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 font-semibold rounded-full text-[10px] ${
                              stats.active >= firm.licenses ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>
                              {stats.active} / {firm.licenses} Ativas
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                              firm.active ? "text-emerald-600" : "text-slate-400"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${firm.active ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                              {firm.active ? "Ativo" : "Bloqueado"}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedFirm(firm);
                                setShowCreateFirmForm(false);
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                            >
                              Configurar Escritório →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Create or Edit Firm details */}
          <div className="lg:col-span-5">
            {showCreateFirmForm ? (
              <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-semibold text-indigo-950 text-sm flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    Cadastrar Escritório de Advocacia
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Cria um cluster autônomo com um teto de licenças operacionais.</p>
                </div>

                <form onSubmit={handleCreateFirm} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Nome do Escritório / Razão Social</label>
                    <input
                      type="text"
                      required
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value)}
                      placeholder="Ex: AALL Advogados Associados"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">CNPJ do Escritório</label>
                    <input
                      type="text"
                      value={firmCnpj}
                      onChange={(e) => setFirmCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Licenças Disponíveis (Teto de Usuários Ativos)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={firmLicenses}
                      onChange={(e) => setFirmLicenses(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">URL da Logomarca do Escritório</label>
                    <input
                      type="text"
                      value={firmLogoUrl}
                      onChange={(e) => setFirmLogoUrl(e.target.value)}
                      placeholder="https://exemplo.com/logo.png"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                    <p className="text-[9px] text-slate-400 mt-0.5">URL de imagem hospedada ou arquivo público com a logo do escritório.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Cor Primária</label>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="color"
                          value={firmPrimaryColor}
                          onChange={(e) => setFirmPrimaryColor(e.target.value)}
                          className="h-8 w-8 bg-transparent border-0 rounded-md cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={firmPrimaryColor}
                          onChange={(e) => setFirmPrimaryColor(e.target.value)}
                          placeholder="#4f46e5"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] text-slate-800 outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Cor Secundária</label>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="color"
                          value={firmSecondaryColor}
                          onChange={(e) => setFirmSecondaryColor(e.target.value)}
                          className="h-8 w-8 bg-transparent border-0 rounded-md cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={firmSecondaryColor}
                          onChange={(e) => setFirmSecondaryColor(e.target.value)}
                          placeholder="#111827"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] text-slate-800 outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-800 block text-[11px]">Estado do Cluster</span>
                      <span className="text-[9px] text-slate-400">Escritórios desativados têm todos os acessos bloqueados em bloco.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFirmActive(!firmActive)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {firmActive ? (
                        <ToggleRight className="w-8 h-8 text-indigo-600" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-slate-300" />
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowCreateFirmForm(false)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-3 py-1.5 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingFirm}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingFirm ? "Salvando..." : "Cadastrar Cluster"}
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedFirm ? (
              <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-semibold text-slate-900 text-sm">Configuração de Cluster</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Gerenciamento do escritório #{selectedFirm.id} ({selectedFirm.name})</p>
                </div>

                <form onSubmit={handleUpdateFirm} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Nome / Razão Social</label>
                    <input
                      type="text"
                      required
                      value={selectedFirm.name}
                      onChange={(e) => setSelectedFirm({ ...selectedFirm, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">CNPJ do Escritório</label>
                    <input
                      type="text"
                      value={selectedFirm.cnpj || ""}
                      onChange={(e) => setSelectedFirm({ ...selectedFirm, cnpj: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Número de Licenças Contratadas</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={selectedFirm.licenses}
                      onChange={(e) => setSelectedFirm({ ...selectedFirm, licenses: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">URL da Logomarca do Escritório</label>
                    <input
                      type="text"
                      value={selectedFirm.logo_url || ""}
                      onChange={(e) => setSelectedFirm({ ...selectedFirm, logo_url: e.target.value })}
                      placeholder="https://exemplo.com/logo.png"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                    />
                    <p className="text-[9px] text-slate-400 mt-0.5">URL de imagem hospedada ou arquivo público com a logo do escritório.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Cor Primária</label>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="color"
                          value={selectedFirm.primary_color || "#4f46e5"}
                          onChange={(e) => setSelectedFirm({ ...selectedFirm, primary_color: e.target.value })}
                          className="h-8 w-8 bg-transparent border-0 rounded-md cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={selectedFirm.primary_color || "#4f46e5"}
                          onChange={(e) => setSelectedFirm({ ...selectedFirm, primary_color: e.target.value })}
                          placeholder="#4f46e5"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] text-slate-800 outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Cor Secundária</label>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="color"
                          value={selectedFirm.secondary_color || "#111827"}
                          onChange={(e) => setSelectedFirm({ ...selectedFirm, secondary_color: e.target.value })}
                          className="h-8 w-8 bg-transparent border-0 rounded-md cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={selectedFirm.secondary_color || "#111827"}
                          onChange={(e) => setSelectedFirm({ ...selectedFirm, secondary_color: e.target.value })}
                          placeholder="#111827"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] text-slate-800 outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SMTP / Configurações de E-mail do Escritório */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-600" />
                      <span className="font-semibold text-slate-800 block text-[11px] uppercase tracking-wider">Conta para Envio de E-mails (SMTP)</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Configure as credenciais SMTP individuais deste escritório. Se deixado em branco, o sistema usará as configurações globais padrão para enviar e-mails de redefinição de senha e alertas.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Servidor SMTP (Host)</label>
                        <input
                          type="text"
                          value={selectedFirm.smtp_host || ""}
                          onChange={(e) => setSelectedFirm({ ...selectedFirm, smtp_host: e.target.value })}
                          placeholder="Ex: smtp.seudominio.com"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Porta SMTP</label>
                        <input
                          type="number"
                          value={selectedFirm.smtp_port || ""}
                          onChange={(e) => setSelectedFirm({ ...selectedFirm, smtp_port: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="Ex: 587 ou 465"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Usuário / E-mail</label>
                        <input
                          type="text"
                          value={selectedFirm.smtp_user || ""}
                          onChange={(e) => setSelectedFirm({ ...selectedFirm, smtp_user: e.target.value })}
                          placeholder="Ex: envio@seudominio.com"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Senha SMTP</label>
                        <input
                          type="password"
                          value={selectedFirm.smtp_pass || ""}
                          onChange={(e) => setSelectedFirm({ ...selectedFirm, smtp_pass: e.target.value })}
                          placeholder="••••••••••••••••"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Nome do Remetente</label>
                        <input
                          type="text"
                          value={selectedFirm.smtp_sender || ""}
                          onChange={(e) => setSelectedFirm({ ...selectedFirm, smtp_sender: e.target.value })}
                          placeholder="Ex: Cardoso Advogados"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Conexão Segura (SSL/TLS)</label>
                        <select
                          value={selectedFirm.smtp_secure ? "yes" : "no"}
                          onChange={(e) => setSelectedFirm({ ...selectedFirm, smtp_secure: e.target.value === "yes" })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 text-xs"
                        >
                          <option value="no">Não (Porta 587 comum)</option>
                          <option value="yes">Sim (SSL/TLS na porta 465)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-800 block">Estado do Escritório</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Desativar suspende todos os usuários do cluster de uma vez.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFirm({ ...selectedFirm, active: !selectedFirm.active })}
                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {selectedFirm.active ? (
                        <ToggleRight className="w-9 h-9 text-indigo-600" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 justify-between pt-3 border-t border-slate-100">
                    {/* Delete cluster */}
                    {selectedFirm.id !== "1" ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteFirm(selectedFirm.id)}
                        className={`text-xs font-semibold px-3 py-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                          deleteFirmConfirmId === selectedFirm.id
                            ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse"
                            : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-100"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deleteFirmConfirmId === selectedFirm.id ? "Confirmar Exclusão?" : "Excluir Escritório"}
                      </button>
                    ) : (
                      <div className="text-[10px] text-slate-400 self-center">Escritório padrão (#1) protegido.</div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFirm(null);
                          setDeleteFirmConfirmId(null);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-4 py-2 rounded-xl text-center"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={savingFirm}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-1 transition-colors shadow-sm text-center"
                      >
                        <Save className="w-3.5 h-3.5" /> {savingFirm ? "Salvando..." : "Salvar Configuração"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 bg-slate-50/50 p-6 rounded-2xl text-center text-slate-400 text-xs h-40 flex flex-col items-center justify-center">
                <Building2 className="w-8 h-8 text-slate-300 mb-1 opacity-70 animate-pulse" />
                <p className="font-semibold text-slate-500">Selecione um Escritório de Advocacia</p>
                <p className="text-[10px] text-slate-400 mt-1">Configure o CNPJ, teto de licenças ativas, crie novos clusters isolados ou edite as razões sociais.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: LGPD Audit logs */}
      {subTab === "audit" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
            <div>
              <h3 className="font-semibold text-slate-900 text-xs sm:text-sm">Registro de Operações sob Regulamentação LGPD</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Trilhas de auditoria imutáveis e isoladas por cluster de escritório. Captura visualizações e alterações críticas.</p>
            </div>
            <button
              onClick={fetchAuditLogs}
              disabled={auditLoading}
              className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-xl border border-indigo-100"
            >
              {auditLoading ? "Carregando..." : "Atualizar Logs"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <th className="p-4">Data/Hora</th>
                  <th className="p-4">Operador</th>
                  <th className="p-4">Escritório</th>
                  <th className="p-4">Ação / Evento</th>
                  <th className="p-4">Tabela Alvo</th>
                  <th className="p-4">ID Registro</th>
                  <th className="p-4">Metadados de Conformidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {auditLoading ? "Carregando registros..." : "Nenhum log de auditoria encontrado para este escritório."}
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    const firm = lawFirms.find((f) => f.id === log.law_firm_id || (!log.law_firm_id && f.id === "1"));
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/20">
                        <td className="p-4 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-4 font-semibold text-slate-800">{log.user_name}</td>
                        <td className="p-4 text-slate-500 font-medium">{firm ? firm.name : "Padrão"}</td>
                        <td className="p-4 text-indigo-700 font-medium">{log.action}</td>
                        <td className="p-4 font-mono text-slate-600">{log.table_name}</td>
                        <td className="p-4 font-mono text-slate-400">#{log.record_id}</td>
                        <td className="p-4 max-w-xs truncate text-[10px] text-slate-500 font-sans" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Security and Backup */}
      {subTab === "backup" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-xl mx-auto space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Database className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Segurança, Backup e Implantação cPanel</h3>
              <p className="text-xs text-slate-400 mt-0.5">Sistemas de contingência offline e exportações prontas para hospedagem externa.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">Exportação de Dados LGPD</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Em conformidade estrita com o Artigo 16 da LGPD, o escritório pode exportar o banco de dados inteiro em formato aberto de alta portabilidade (JSON) para backups de segurança ou migrações sistêmicas.
            </p>

            <button
              onClick={handleTriggerBackup}
              className="w-full bg-slate-950 hover:bg-slate-800 text-white font-semibold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs shadow-xs"
            >
              <Download className="w-4 h-4 text-emerald-400" /> Exportar Backup Integral (Formato JSON)
            </button>
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-4">
            <h4 className="font-semibold text-xs text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
              🚀 Implantação em Servidor de Produção (cPanel / HostGator)
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Baixe os arquivos prontos e compilados para colocar o aplicativo no ar na sua própria hospedagem Node.js sem precisar de terminal.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <a
                href="/api/download/full-deploy"
                download
                className="flex items-center justify-between p-3.5 bg-indigo-50/60 hover:bg-indigo-50 text-indigo-950 border border-indigo-100 rounded-xl transition-all text-xs font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Download className="w-4 h-4 animate-bounce" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold">1. Pacote Pronto para cPanel (.ZIP)</p>
                    <p className="text-[10px] text-indigo-500 font-normal">Contém a pasta 'dist' compilada, server.js de inicialização e dependências.</p>
                  </div>
                </div>
              </a>

              <a
                href="/api/download/sql"
                download
                className="flex items-center justify-between p-3.5 bg-emerald-50/60 hover:bg-emerald-50 text-emerald-950 border border-emerald-100 rounded-xl transition-all text-xs font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold">2. Script SQL de Banco de Dados (.SQL)</p>
                    <p className="text-[10px] text-emerald-600 font-normal">Criação automática de todas as 10 tabelas com law_firm_id incluído.</p>
                  </div>
                </div>
              </a>

              <a
                href="/api/download/code"
                download
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl transition-all text-xs font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-slate-200 text-slate-700 rounded-lg">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold">3. Código-Fonte Completo (.ZIP)</p>
                    <p className="text-[10px] text-slate-500 font-normal">Para edições e modificações futuras por desenvolvedores.</p>
                  </div>
                </div>
              </a>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2.5 text-[11px] text-slate-600">
            <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-950 font-sans">Aviso Importante de Segurança</p>
              <p className="mt-0.5">Apenas administradores de sistema e Sócios Diretores com privilégios autorizados podem gerar e baixar backups contendo dados de operadores jurídicos.</p>
            </div>
          </div>
        </div>
      )}

      {subTab === "smtp" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn" id="admin-smtp-config-tab">
          {/* Formulário SMTP */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 font-sans flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-600" /> Servidor de Envio de E-mails (SMTP)
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Configure as credenciais SMTP do seu escritório para o envio automático de redefinições de senha, notificações de prazos e relatórios.
              </p>
            </div>

            {smtpError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{smtpError}</span>
              </div>
            )}

            {smtpSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span>{smtpSuccess}</span>
              </div>
            )}

            {smtpLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 font-semibold animate-pulse">
                Carregando configurações SMTP do banco de dados...
              </div>
            ) : (
              <form onSubmit={handleSaveSmtp} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Servidor SMTP (Host)</label>
                    <input
                      type="text"
                      required
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="Ex: smtp.hostgator.com.br"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-indigo-500 placeholder-slate-400 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Porta SMTP</label>
                    <input
                      type="number"
                      required
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      placeholder="Ex: 587, 465, 25"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-indigo-500 placeholder-slate-400 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Nome do Remetente</label>
                    <input
                      type="text"
                      required
                      value={smtpSenderName}
                      onChange={(e) => setSmtpSenderName(e.target.value)}
                      placeholder="Ex: Cardoso & Mendes Advogados"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-indigo-500 placeholder-slate-400 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Usuário (E-mail Autenticado)</label>
                    <input
                      type="email"
                      required
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="Ex: notificacoes@legalonefirm.com.br"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-indigo-500 placeholder-slate-400 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Senha de Autenticação</label>
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="Deixe em branco para manter a senha atual"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-indigo-500 placeholder-slate-400 font-medium"
                  />
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSmtpSecure(!smtpSecure)}
                    className="cursor-pointer text-indigo-600 focus:outline-none"
                  >
                    {smtpSecure ? (
                      <ToggleRight className="w-10 h-6 text-indigo-600" />
                    ) : (
                      <ToggleLeft className="w-10 h-6 text-slate-400" />
                    )}
                  </button>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Conexão Segura (SSL/TLS / SMTPS)</p>
                    <p className="text-[10px] text-slate-400">Ative para conexões seguras que utilizam certificados SSL na porta 465 (ex: Gmail/Outlook corporativo).</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={smtpSaving}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {smtpSaving ? "Gravando Configurações..." : "Gravar Configurações SMTP"}
                </button>
              </form>
            )}
          </div>

          {/* Teste de Disparo */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 font-sans flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-600" /> Testar Conexão SMTP
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Envie um e-mail de teste seguro para garantir que a rede e as credenciais configuradas estão corretas.
                </p>
              </div>

              {testEmailError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{testEmailError}</span>
                </div>
              )}

              {testEmailSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                  <span>{testEmailSuccess}</span>
                </div>
              )}

              <form onSubmit={handleTestSmtp} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Endereço de E-mail de Destino</label>
                  <input
                    type="email"
                    required
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Ex: seu-email-pessoal@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-indigo-500 placeholder-slate-400 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={testEmailLoading}
                  className="w-full bg-slate-950 hover:bg-slate-900 text-slate-200 border border-slate-800 font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  {testEmailLoading ? "Enviando E-mail..." : "Disparar E-mail de Teste"}
                </button>
              </form>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-950 font-sans">Dica do Ambiente de Preview</p>
                <p className="mt-0.5">
                  Por padrão, o Legal Prime vem com um servidor SMTP de demonstração fictício (`smtp.legalprime.com.br`). Quando você dispara testes ou solicita a redefinição de senha com este e-mail fictício, o sistema simula o disparo gerando os logs e o link no terminal e na interface do usuário com total interatividade.
                </p>
                <p className="mt-1 font-semibold text-amber-900">
                  Cadastre dados reais de SMTP (como de um provedor HostGator, Gmail, Locaweb, etc.) para testar envios corporativos em tempo real.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
