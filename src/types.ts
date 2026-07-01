export interface LawFirm {
  id: string;
  name: string;
  cnpj?: string;
  licenses: number; // Limite de licenças (usuários ativos)
  active: boolean;
  created_at: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_pass?: string | null;
  smtp_sender?: string | null;
  smtp_secure?: boolean | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "partner" | "lawyer" | "finance" | "secretary" | "intern" | "client";
  permissions: string[];
  active: boolean;
  law_firm_id?: string; // ID do escritório (cluster) ao qual pertence
  created_at?: string;
  oab?: string; // OAB do advogado para busca automática de diários
}

export interface Client {
  id: string;
  name: string;
  type: "PF" | "PJ";
  document: string; // CPF or CNPJ
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  contacts: { name: string; phone: string; role: string }[];
  notes?: string;
  law_firm_id?: string; // Isolamento por cluster
  created_at: string;
}

export interface Process {
  id: string;
  cnj: string; // CNJ format, e.g. 0012345-67.2026.8.26.0100
  title: string;
  client_id: string;
  area: string; // Cível, Trabalhista, Penal, Tributário, Família, Previdenciário
  court: string; // TJSP, TRF3, TST, STJ, STF, etc.
  comarca: string;
  vara: string;
  status: "Ativo" | "Suspenso" | "Arquivado" | "Sentenciado";
  lawyers: string[]; // List of lawyer names assigned
  description: string;
  value: number; // Process action value (R$)
  law_firm_id?: string; // Isolamento por cluster
  created_at: string;
}

export interface ProcessMovement {
  id: string;
  process_id: string;
  date: string;
  description: string;
  source: "Automatizado" | "Manual";
  law_firm_id?: string; // Isolamento por cluster
  created_at: string;
}

export interface AgendaEvent {
  id: string;
  title: string;
  description?: string;
  type: "hearing" | "deadline" | "meeting" | "reminder";
  start_date: string;
  end_date: string;
  status: "Pendente" | "Concluído" | "Cancelado";
  process_id?: string;
  assigned_to: string[]; // List of user names
  alerts_sent?: boolean;
  law_firm_id?: string; // Isolamento por cluster
  created_at: string;
}

export interface FinancialItem {
  id: string;
  description: string;
  amount: number;
  type: "revenue" | "expense";
  category: string; // Honorários, Custas, Aluguel, Salários, Impostos, etc.
  status: "Pago" | "Pendente" | "Atrasado";
  due_date: string;
  payment_date?: string | null;
  client_id?: string | null;
  process_id?: string | null;
  recurrence: "Único" | "Mensal" | "Trimestral" | "Anual";
  pix_code?: string;
  law_firm_id?: string; // Isolamento por cluster
  created_at: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  category: "Contrato" | "Procuração" | "Petição" | "Parecer" | "Outro" | "Pasta";
  file_path: string;
  version: number;
  process_id?: string | null;
  client_id?: string | null;
  created_by: string;
  signatures: { signed_by: string; signed_at: string; status: string }[];
  law_firm_id?: string; // Isolamento por cluster
  created_at: string;
  d4sign_id?: string | null;
  d4sign_status?: "rascunho" | "aguardando_assinaturas" | "arquivado" | "cancelado" | null;
  d4sign_signers?: { name: string; email: string; cpf: string; signed: boolean }[] | null;
}

export interface Workflow {
  id: string;
  name: string;
  trigger_event: "new_process" | "new_hearing" | "deadline_near";
  actions: { type: string; params: any }[];
  active: boolean;
  law_firm_id?: string; // Isolamento por cluster
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  table_name: string;
  record_id: string;
  details: string;
  law_firm_id?: string; // Isolamento por cluster
  created_at: string;
}
