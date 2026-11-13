import React, { useState } from "react";
import {
  MapPin, Users, TrendingUp, Search, ChevronLeft, ChevronRight,
  Check, AlertTriangle, X, Phone, MessageCircle, Filter, ChevronDown,
  UserCheck, Cake, ClipboardList, Lock, Calendar, Send, Image as ImageIcon,
  ChevronUp, Eye, ShieldAlert, Info
} from "lucide-react";

// ---------- Design tokens ----------
// Navy/teal civic palette — deliberately away from warm-cream/terracotta and dark+neon defaults.
const C = {
  ink: "#152238",       // near-black navy, primary text
  navy: "#1B2A4A",      // deep navy, headers/nav
  teal: "#2D6E7E",      // primary accent, links/actions
  tealLight: "#DCEAEA",
  amber: "#C98A3E",     // secondary accent — alerts/priority
  amberLight: "#F5E6CE",
  paper: "#F6F4EF",     // background
  card: "#FFFFFF",
  line: "#E4E1D8",
  muted: "#6B7280",
  low: "#E3E7D3",       // engagement scale: low coverage
  mid: "#B9D2C4",
  high: "#5C9A80",
  veryhigh: "#2D6E4F",
  danger: "#B85450",
};

const bairros = [
  { id: 1, nome: "Vila Esperança", cobertura: 0.82, gap: -320, lideranças: 3, demandas: 4, engajamento: { apoio: 44, simp: 26, neutro: 20, neg: 6, semLeitura: 4 } },
  { id: 2, nome: "Jardim Primavera", cobertura: 0.31, gap: 610, lideranças: 1, demandas: 9, engajamento: { apoio: 18, simp: 22, neutro: 34, neg: 8, semLeitura: 18 } },
  { id: 3, nome: "Centro", cobertura: 0.66, gap: 90, lideranças: 4, demandas: 2, engajamento: { apoio: 38, simp: 30, neutro: 22, neg: 5, semLeitura: 5 } },
  { id: 4, nome: "Bela Vista", cobertura: 0.19, gap: 780, lideranças: 0, demandas: 12, engajamento: { apoio: 10, simp: 15, neutro: 30, neg: 10, semLeitura: 35 } },
  { id: 5, nome: "São Miguel", cobertura: 0.54, gap: 210, lideranças: 2, demandas: 5, engajamento: { apoio: 29, simp: 27, neutro: 25, neg: 9, semLeitura: 10 } },
  { id: 6, nome: "Recanto Verde", cobertura: 0.90, gap: -410, lideranças: 5, demandas: 1, engajamento: { apoio: 51, simp: 24, neutro: 15, neg: 6, semLeitura: 4 } },
];

function coberturaColor(v) {
  if (v < 0.3) return C.low;
  if (v < 0.55) return C.mid;
  if (v < 0.75) return C.high;
  return C.veryhigh;
}

// ---------- Shared phone-frame chrome ----------
function PhoneFrame({ title, children }) {
  return (
    <div style={{ width: 390, borderRadius: 36, background: "#0E1420", padding: 10, boxShadow: "0 20px 50px rgba(21,34,56,0.35)" }}>
      <div style={{ borderRadius: 28, overflow: "hidden", background: C.paper, minHeight: 720, display: "flex", flexDirection: "column", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: C.navy, color: "#fff", padding: "14px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, letterSpacing: 0.4, opacity: 0.75, fontWeight: 500 }}>9:41</span>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.2 }}>{title}</span>
          <span style={{ fontSize: 13, opacity: 0.75 }}>●●●</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

// ---------- MAP SCREEN ----------
function MapScreen() {
  const [selected, setSelected] = useState(bairros[1]);
  const [metric, setMetric] = useState("cobertura");
  const [showFilters, setShowFilters] = useState(false);

  const metrics = [
    { key: "cobertura", label: "Cobertura" },
    { key: "gap", label: "Gap eleitoral" },
    { key: "demandas", label: "Demandas" },
  ];

  return (
    <div>
      {/* Metric selector */}
      <div style={{ padding: "12px 14px 8px", background: C.card, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", gap: 6 }}>
          {metrics.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              style={{
                flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                background: metric === m.key ? C.navy : C.paper,
                color: metric === m.key ? "#fff" : C.muted,
              }}
            >
              {m.label}
            </button>
          ))}
          <button
            onClick={() => setShowFilters((s) => !s)}
            style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer" }}
          >
            <Filter size={14} color={C.ink} />
          </button>
        </div>
        {showFilters && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Região", "Período", "Com liderança", "Prioritário"].map((f) => (
              <span key={f} style={{ fontSize: 11, background: C.tealLight, color: C.teal, padding: "4px 9px", borderRadius: 999, fontWeight: 600 }}>
                {f} <ChevronDown size={10} style={{ display: "inline", verticalAlign: -1 }} />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* "Map" — choropleth grid standing in for real tiles */}
      <div style={{ padding: 14, background: "#EAE7DD" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {bairros.map((b) => {
            const val = metric === "cobertura" ? b.cobertura : metric === "gap" ? (b.gap > 0 ? 0.3 : 0.85) : (1 - b.demandas / 12);
            const isSel = selected.id === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                style={{
                  position: "relative", textAlign: "left", border: isSel ? `2px solid ${C.navy}` : "2px solid transparent",
                  borderRadius: 10, padding: "12px 10px", cursor: "pointer",
                  background: coberturaColor(val), minHeight: 78,
                  boxShadow: isSel ? "0 4px 10px rgba(21,34,56,0.25)" : "0 1px 3px rgba(21,34,56,0.08)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{b.nome}</span>
                {b.lideranças > 0 && (
                  <span style={{ position: "absolute", top: 8, right: 8, background: "#fff", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <UserCheck size={10} color={C.teal} />
                  </span>
                )}
                {b.gap > 400 && (
                  <span style={{ position: "absolute", bottom: 8, right: 8, background: C.amber, borderRadius: "50%", width: 8, height: 8 }} title="prioritário" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: C.muted }}>
          <span>Baixa</span>
          {[C.low, C.mid, C.high, C.veryhigh].map((c, i) => (
            <span key={i} style={{ width: 16, height: 8, background: c, borderRadius: 2 }} />
          ))}
          <span>Alta</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, background: C.amber, borderRadius: "50%" }} /> prioritário
          </span>
        </div>
      </div>

      {/* Bottom sheet — selected bairro detail */}
      <div style={{ background: C.card, borderTop: `1px solid ${C.line}`, padding: 16, borderRadius: "16px 16px 0 0", marginTop: -8, position: "relative" }}>
        <div style={{ width: 36, height: 4, background: C.line, borderRadius: 2, margin: "0 auto 12px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: C.ink, fontWeight: 700 }}>{selected.nome}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>
              {Math.round(selected.cobertura * 100)}% de cobertura · {selected.lideranças} liderança(s)
            </p>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
            background: selected.gap > 400 ? C.amberLight : C.tealLight,
            color: selected.gap > 400 ? C.amber : C.teal,
          }}>
            gap {selected.gap > 0 ? "+" : ""}{selected.gap}
          </span>
        </div>

        {/* Engagement distribution — always aggregated, never individual */}
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 11, color: C.muted, margin: "0 0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Engajamento agregado
          </p>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${selected.engajamento.apoio}%`, background: C.veryhigh }} />
            <div style={{ width: `${selected.engajamento.simp}%`, background: C.high }} />
            <div style={{ width: `${selected.engajamento.neutro}%`, background: C.mid }} />
            <div style={{ width: `${selected.engajamento.neg}%`, background: C.danger }} />
            <div style={{ width: `${selected.engajamento.semLeitura}%`, background: C.line }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 10, color: C.muted, flexWrap: "wrap" }}>
            <span>● Apoio {selected.engajamento.apoio}%</span>
            <span>● Simpatia {selected.engajamento.simp}%</span>
            <span>● Neutro {selected.engajamento.neutro}%</span>
            <span>● Negativo {selected.engajamento.neg}%</span>
            <span>● Sem leitura {selected.engajamento.semLeitura}%</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <div style={{ flex: 1, background: C.paper, borderRadius: 10, padding: "10px 12px" }}>
            <ClipboardList size={14} color={C.teal} />
            <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 700, color: C.ink }}>{selected.demandas}</p>
            <p style={{ margin: 0, fontSize: 10.5, color: C.muted }}>demandas abertas</p>
          </div>
          <div style={{ flex: 1, background: C.paper, borderRadius: 10, padding: "10px 12px" }}>
            <Users size={14} color={C.teal} />
            <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 700, color: C.ink }}>{selected.lideranças}</p>
            <p style={{ margin: 0, fontSize: 10.5, color: C.muted }}>lideranças ativas</p>
          </div>
        </div>

        <button style={{
          marginTop: 14, width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
          background: C.navy, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>
          Abrir painel completo da comunidade
        </button>
      </div>
    </div>
  );
}

// ---------- FIELD REGISTRATION FLOW ----------
function CadastroScreen() {
  const [step, setStep] = useState(0); // 0 search, 1 basic, 2 engagement, 3 consent, 4 done
  const [dup, setDup] = useState(true); // simulate a fuzzy-match hit for demo
  const [engEnabled] = useState(true); // simulate operator WITH permission
  const [form, setForm] = useState({ nome: "", telefone: "", bairro: "", status: "", origem: "", confianca: "", consentimento: "" });

  const steps = ["Buscar", "Dados", "Leitura", "Consentimento", "Pronto"];

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Stepper */}
      <div style={{ display: "flex", padding: "14px 16px 10px", gap: 4 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, background: i <= step ? C.teal : C.line, marginBottom: 4 }} />
            <span style={{ fontSize: 9.5, color: i <= step ? C.teal : C.muted, fontWeight: i === step ? 700 : 500 }}>{s}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 16px 16px", flex: 1 }}>
        {step === 0 && (
          <div>
            <h3 style={{ fontSize: 16, color: C.ink, margin: "8px 0 4px" }}>Novo contato</h3>
            <p style={{ fontSize: 12.5, color: C.muted, margin: "0 0 14px" }}>Buscar antes de cadastrar evita duplicidade na base.</p>
            <div style={{ display: "flex", alignItems: "center", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
              <Search size={16} color={C.muted} />
              <input
                placeholder="Nome ou telefone"
                defaultValue="Maria da Silva"
                style={{ border: "none", outline: "none", marginLeft: 8, fontSize: 13.5, flex: 1, background: "transparent" }}
              />
            </div>

            {dup && (
              <div style={{ marginTop: 14, background: C.amberLight, border: `1px solid ${C.amber}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertTriangle size={16} color={C.amber} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: C.ink }}>Registro parecido encontrado</p>
                    <p style={{ margin: "3px 0 8px", fontSize: 12, color: C.muted }}>
                      "Maria S. Silva" · (11) 9****-2231 · Vila Esperança — cadastrado há 4 meses.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: C.navy, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>
                        Ver e mesclar
                      </button>
                      <button onClick={() => setStep(1)} style={{ fontSize: 11.5, fontWeight: 700, color: C.navy, background: "transparent", border: `1px solid ${C.navy}`, borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>
                        É pessoa diferente
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!dup && (
              <button onClick={() => setStep(1)} style={{ marginTop: 14, width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: C.navy, color: "#fff", fontWeight: 700, fontSize: 13 }}>
                Continuar cadastro
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 style={{ fontSize: 16, color: C.ink, margin: "8px 0 14px" }}>Dados básicos</h3>
            <Field label="Nome completo *" placeholder="Nome do contato" value={form.nome} onChange={(v) => set("nome", v)} />
            <Field label="Telefone / WhatsApp *" placeholder="(00) 00000-0000" icon={<Phone size={13} />} value={form.telefone} onChange={(v) => set("telefone", v)} />
            <Field label="Bairro / comunidade *" placeholder="Selecionar bairro" icon={<MapPin size={13} />} value={form.bairro} onChange={(v) => set("bairro", v)} />
            <p style={{ fontSize: 10.5, color: C.muted, marginTop: -4 }}>* obrigatório — sem bairro não é possível territorializar o contato.</p>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ fontSize: 16, color: C.ink, margin: "8px 0 4px" }}>Leitura de engajamento</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 14px" }}>
              Registro interno da equipe — trate como percepção, não como fato confirmado.
            </p>

            <p style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>Status</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {["Apoiador", "Simpatizante", "Neutro", "Percepção negativa", "Desconhecido"].map((s) => (
                <Chip key={s} label={s} active={form.status === s} onClick={() => set("status", s)} />
              ))}
            </div>

            <p style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>Origem</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {["Autodeclarado", "Percepção da liderança", "Percepção da equipe"].map((s) => (
                <Chip key={s} label={s} active={form.origem === s} onClick={() => set("origem", s)} />
              ))}
            </div>

            <p style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>Confiança</p>
            <div style={{ display: "flex", gap: 6 }}>
              {["Alta", "Média", "Baixa"].map((s) => (
                <Chip key={s} label={s} active={form.confianca === s} onClick={() => set("confianca", s)} />
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={{ fontSize: 16, color: C.ink, margin: "8px 0 4px" }}>Consentimento de comunicação</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 14px" }}>
              A pessoa aceita receber mensagens institucionais (aniversário, notícias, lembretes)?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["Sim, aceitou", "Não aceitou", "Não perguntado ainda"].map((s) => (
                <button
                  key={s}
                  onClick={() => set("consentimento", s)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, textAlign: "left",
                    border: form.consentimento === s ? `2px solid ${C.teal}` : `1px solid ${C.line}`,
                    background: form.consentimento === s ? C.tealLight : "#fff", cursor: "pointer", fontSize: 13,
                  }}
                >
                  <MessageCircle size={15} color={C.teal} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.veryhigh, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Check size={28} color="#fff" />
            </div>
            <h3 style={{ fontSize: 16, color: C.ink, margin: "0 0 4px" }}>Contato salvo</h3>
            <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}>Vila Esperança · sincronizado</p>
            <button onClick={() => setStep(0)} style={{ marginTop: 24, fontSize: 13, fontWeight: 700, color: C.teal, background: "transparent", border: "none", cursor: "pointer" }}>
              Cadastrar outro contato
            </button>
          </div>
        )}
      </div>

      {/* Nav footer */}
      {step < 4 && (
        <div style={{ display: "flex", gap: 8, padding: "12px 16px 18px", borderTop: `1px solid ${C.line}`, background: "#fff" }}>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} style={{ padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer" }}>
              <ChevronLeft size={16} color={C.ink} />
            </button>
          )}
          {step > 0 && step < 3 && (
            <button
              onClick={() => setStep((s) => (s === 2 && !engEnabled ? 3 : s + 1))}
              style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: C.navy, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              Continuar <ChevronRight size={15} />
            </button>
          )}
          {step === 3 && (
            <button
              onClick={() => setStep(4)}
              style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: C.veryhigh, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Salvar contato
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- CONTACT PROFILE SCREEN ----------
function PerfilScreen() {
  const [showEngajamento, setShowEngajamento] = useState(false);

  const timeline = [
    { data: "12 ago 2026", tipo: "Visita", texto: "Visita de rotina. Relatou problema de iluminação na rua.", icon: MapPin },
    { data: "03 ago 2026", tipo: "Mensagem", texto: "Recebeu lembrete do mutirão de saúde do bairro.", icon: MessageCircle },
    { data: "14 jun 2026", tipo: "Demanda", texto: "Abriu demanda: iluminação pública — em andamento.", icon: ClipboardList },
    { data: "02 mar 2026", tipo: "Cadastro", texto: "Contato cadastrado por Ana (operadora de campo).", icon: UserCheck },
  ];

  return (
    <div>
      {/* Header card */}
      <div style={{ background: C.navy, padding: "20px 18px 24px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>
            MS
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Maria da Silva</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, opacity: 0.8 }}>Vila Esperança · cadastrada em mar/2026</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <a href="#" style={{ flex: 1, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 9, padding: "9px 0", fontSize: 12.5, color: "#fff", fontWeight: 600 }}>
            <Phone size={13} /> Ligar
          </a>
          <a href="#" style={{ flex: 1, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.high, borderRadius: 9, padding: "9px 0", fontSize: 12.5, color: "#fff", fontWeight: 600 }}>
            <MessageCircle size={13} /> WhatsApp
          </a>
          <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 9, padding: "9px 0", fontSize: 12.5, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            <ClipboardList size={13} /> Demanda
          </button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Basic info */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.line}`, padding: 14, marginBottom: 12 }}>
          <Row icon={<Phone size={13} color={C.muted} />} label="(11) 9****-2231" />
          <Row icon={<Cake size={13} color={C.muted} />} label="15 de setembro" />
          <Row icon={<MapPin size={13} color={C.muted} />} label="Vila Esperança, Rua das Acácias" />
          <Row icon={<MessageCircle size={13} color={C.muted} />} label="Consentimento: aceita mensagens" tag="ativo" tagColor={C.veryhigh} last />
        </div>

        {/* Sensitive block — collapsed by default, requires permission */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.line}`, marginBottom: 12, overflow: "hidden" }}>
          <button
            onClick={() => setShowEngajamento((s) => !s)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14, background: "transparent", border: "none", cursor: "pointer" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: C.ink }}>
              <Lock size={13} color={C.amber} /> Leitura de engajamento
            </span>
            {showEngajamento ? <ChevronUp size={15} color={C.muted} /> : <ChevronDown size={15} color={C.muted} />}
          </button>
          {showEngajamento && (
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", background: C.amberLight, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                <Info size={13} color={C.amber} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 10.5, color: C.ink }}>
                  Percepção interna da equipe — não é declaração confirmada pela pessoa. Visível só a Coordenação.
                </p>
              </div>
              <Row label="Status" value="Simpatizante" />
              <Row label="Origem" value="Percepção da liderança local" />
              <Row label="Confiança" value="Média" />
              <Row label="Última atualização" value="12 ago 2026 · por Ana (operadora)" last />
              <button style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: C.teal, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                Ver histórico de mudanças →
              </button>
            </div>
          )}
        </div>

        {/* Tags */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          {["Liderança comunitária", "Grupo Força Jovem", "Demanda ativa"].map((t) => (
            <span key={t} style={{ fontSize: 10.5, fontWeight: 600, background: C.tealLight, color: C.teal, padding: "4px 10px", borderRadius: 999 }}>{t}</span>
          ))}
        </div>

        {/* Timeline */}
        <p style={{ fontSize: 11, fontWeight: 700, color: C.ink, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 10px" }}>Histórico de interações</p>
        <div style={{ position: "relative", paddingLeft: 22 }}>
          <div style={{ position: "absolute", left: 8, top: 4, bottom: 4, width: 2, background: C.line }} />
          {timeline.map((t, i) => (
            <div key={i} style={{ position: "relative", marginBottom: 16 }}>
              <div style={{ position: "absolute", left: -22, top: 0, width: 18, height: 18, borderRadius: "50%", background: C.card, border: `2px solid ${C.teal}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <t.icon size={9} color={C.teal} />
              </div>
              <p style={{ margin: 0, fontSize: 10.5, color: C.muted, fontWeight: 600 }}>{t.data} · {t.tipo}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.ink }}>{t.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value, tag, tagColor, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: last ? "none" : `1px solid ${C.line}` }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.ink }}>
        {icon} {label && !value ? label : <span style={{ color: C.muted }}>{label}</span>}
        {value && <strong style={{ fontWeight: 600 }}>{value}</strong>}
      </span>
      {tag && <span style={{ fontSize: 10, fontWeight: 700, color: tagColor, background: `${tagColor}1A`, padding: "2px 8px", borderRadius: 999 }}>{tag}</span>}
    </div>
  );
}

// ---------- SEND MESSAGE SCREEN ----------
function MensagemScreen() {
  const [screen, setScreen] = useState("compose"); // compose | review
  const [template, setTemplate] = useState("Aniversário");
  const [audience, setAudience] = useState("Aniversariantes da semana");
  const flaggedWord = template === "Notícia" || template === "Convite para evento";

  const audiences = [
    { label: "Aniversariantes da semana", count: 24 },
    { label: "Bairro: Vila Esperança", count: 812 },
    { label: "Consentimento ativo — todos", count: 3401 },
    { label: "Lideranças e apoiadores", count: 96 },
  ];
  const selectedAudience = audiences.find((a) => a.label === audience);

  return (
    <div style={{ padding: 16 }}>
      {screen === "compose" ? (
        <>
          <h3 style={{ fontSize: 16, color: C.ink, margin: "4px 0 14px" }}>Nova mensagem</h3>

          <p style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>Modelo</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {["Aniversário", "Notícia", "Lembrete de evento", "Convite para evento", "Resposta a demanda"].map((t) => (
              <Chip key={t} label={t} active={template === t} onClick={() => setTemplate(t)} />
            ))}
          </div>

          <p style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>Público-alvo</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {audiences.map((a) => (
              <button
                key={a.label}
                onClick={() => setAudience(a.label)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 9, textAlign: "left", cursor: "pointer",
                  border: audience === a.label ? `2px solid ${C.teal}` : `1px solid ${C.line}`,
                  background: audience === a.label ? C.tealLight : "#fff",
                }}
              >
                <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 600 }}>{a.label}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{a.count} contatos</span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 10.5, color: C.muted, margin: "-8px 0 16px" }}>
            <ShieldAlert size={11} style={{ display: "inline", verticalAlign: -1 }} color={C.amber} /> Envio restrito a contatos com consentimento ativo para esta finalidade — {selectedAudience?.count} elegíveis.
          </p>

          <p style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>Mensagem</p>
          <textarea
            defaultValue={
              template === "Aniversário"
                ? "Oi {{primeiro_nome}}! Passando pra desejar um feliz aniversário 🎉 Um abraço da nossa equipe."
                : "Oi {{primeiro_nome}}, olha essa novidade sobre o mutirão de saúde no seu bairro esta semana."
            }
            style={{ width: "100%", minHeight: 90, border: `1px solid ${C.line}`, borderRadius: 9, padding: 12, fontSize: 13, color: C.ink, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }}
          />
          <button style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, background: "transparent", border: "none", color: C.teal, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            <ImageIcon size={13} /> Anexar imagem
          </button>

          {flaggedWord && (
            <div style={{ display: "flex", gap: 8, background: C.amberLight, borderRadius: 9, padding: "10px 12px", marginTop: 14 }}>
              <AlertTriangle size={15} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 11.5, color: C.ink }}>
                Este modelo pode se aproximar de propaganda antecipada em período pré-eleitoral. Revisão da coordenação recomendada antes do envio.
              </p>
            </div>
          )}

          <button
            onClick={() => setScreen("review")}
            style={{ marginTop: 18, width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: C.navy, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
          >
            <Eye size={14} /> Revisar e enviar
          </button>
        </>
      ) : (
        <>
          <h3 style={{ fontSize: 16, color: C.ink, margin: "4px 0 4px" }}>Confirmar envio</h3>
          <p style={{ fontSize: 12, color: C.muted, margin: "0 0 16px" }}>Revise antes de disparar — a fila respeita o limite da API do WhatsApp.</p>

          {/* WhatsApp-style preview bubble */}
          <div style={{ background: "#DCF3E6", borderRadius: "12px 12px 12px 2px", padding: "10px 12px", maxWidth: "88%", marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 13, color: C.ink, lineHeight: 1.4 }}>
              Oi Maria! Passando pra desejar um feliz aniversário 🎉 Um abraço da nossa equipe.
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 10, color: "#5C9A80", textAlign: "right" }}>09:41 ✓✓</p>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <Row label="Público" value={audience} />
            <Row label="Destinatários" value={`${selectedAudience?.count} contatos`} />
            <Row label="Consentimento" value="Verificado automaticamente" tag="ok" tagColor={C.veryhigh} last />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setScreen("compose")} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Voltar
            </button>
            <button style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: C.veryhigh, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Send size={14} /> Enviar para fila
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, placeholder, icon, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, display: "block", marginBottom: 5 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 12px" }}>
        {icon && <span style={{ color: C.muted }}>{icon}</span>}
        <input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent", color: C.ink }}
        />
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11.5, fontWeight: 600, padding: "7px 12px", borderRadius: 999, cursor: "pointer",
        border: active ? `1px solid ${C.teal}` : `1px solid ${C.line}`,
        background: active ? C.teal : "#fff",
        color: active ? "#fff" : C.ink,
      }}
    >
      {label}
    </button>
  );
}

// ---------- App shell: side-by-side comparison ----------
export default function Wireframes() {
  const [tab, setTab] = useState("mapa");

  return (
    <div style={{ minHeight: "100vh", background: "#EDEAE1", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: C.teal, textTransform: "uppercase", margin: "0 0 6px" }}>
            Wireframe · Plataforma de Gestão Territorial
          </p>
          <h1 style={{ fontSize: 24, color: C.ink, margin: 0, fontWeight: 800 }}>Mapa e Cadastro em Campo</h1>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <TabButton label="Tela do mapa" active={tab === "mapa"} onClick={() => setTab("mapa")} />
          <TabButton label="Fluxo de cadastro" active={tab === "cadastro"} onClick={() => setTab("cadastro")} />
          <TabButton label="Perfil do eleitor" active={tab === "perfil"} onClick={() => setTab("perfil")} />
          <TabButton label="Enviar mensagem" active={tab === "mensagem"} onClick={() => setTab("mensagem")} />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          {tab === "mapa" && <PhoneFrame title="Mapa Territorial"><MapScreen /></PhoneFrame>}
          {tab === "cadastro" && <PhoneFrame title="Cadastro"><CadastroScreen /></PhoneFrame>}
          {tab === "perfil" && <PhoneFrame title="Contato"><PerfilScreen /></PhoneFrame>}
          {tab === "mensagem" && <PhoneFrame title="Comunicação"><MensagemScreen /></PhoneFrame>}
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 16px", borderRadius: 9, border: "none", cursor: "pointer",
        fontSize: 13, fontWeight: 700,
        background: active ? C.navy : "#fff",
        color: active ? "#fff" : C.ink,
        boxShadow: active ? "none" : "0 1px 2px rgba(21,34,56,0.08)",
      }}
    >
      {label}
    </button>
  );
}
