import React, { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Download,
  FileSearch,
  FileText,
  Info,
  Plus,
  RefreshCcw,
  Save,
  Settings2,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

const STORAGE_KEY = "competitive-analysis-dashboard-v2";
const MAX_FACTORS = 20;

const uid = () => Math.random().toString(36).slice(2, 10);
const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const deepClone = (value) => JSON.parse(JSON.stringify(value));
const safeFileName = (value) =>
  String(value || "competitive-analysis-report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "competitive-analysis-report";
const titleCase = (value) => String(value || "").replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const templateFactory = {
  blank: () => ({
    name: "Blank Template",
    factors: [{ id: uid(), category: "Custom", name: "Factor 1", description: "", weight: 10 }],
  }),
  productMarketing: () => ({
    name: "Product Marketing",
    factors: [
      { id: uid(), category: "Positioning", name: "Clarity of positioning", description: "How clearly the brand communicates what it is and who it is for.", weight: 12 },
      { id: uid(), category: "Messaging", name: "Message differentiation", description: "How distinct the core message is relative to alternatives.", weight: 11 },
      { id: uid(), category: "Product", name: "Feature depth", description: "Breadth and depth of relevant product capabilities.", weight: 10 },
      { id: uid(), category: "Proof", name: "Social proof", description: "Quality of testimonials, case studies, and trust signals.", weight: 9 },
      { id: uid(), category: "Go-to-market", name: "Launch strength", description: "How well the company activates launches and updates in-market.", weight: 8 },
    ],
  }),
  growthMarketing: () => ({
    name: "Growth Marketing",
    factors: [
      { id: uid(), category: "Acquisition", name: "Paid acquisition maturity", description: "Strength of paid channels, targeting, and optimisation.", weight: 12 },
      { id: uid(), category: "Acquisition", name: "Organic visibility", description: "SEO, content discoverability, and inbound presence.", weight: 11 },
      { id: uid(), category: "Conversion", name: "Landing page conversion", description: "How effectively the brand converts traffic into leads or signups.", weight: 10 },
      { id: uid(), category: "Lifecycle", name: "Retention engine", description: "Lifecycle, CRM, and engagement strength after signup or purchase.", weight: 9 },
      { id: uid(), category: "Data", name: "Experimentation capability", description: "Ability to test, learn, and iterate quickly.", weight: 8 },
    ],
  }),
  performanceMarketing: () => ({
    name: "Performance Marketing",
    factors: [
      { id: uid(), category: "Media", name: "Channel mix quality", description: "Strength and suitability of the paid channel mix across the funnel.", weight: 12 },
      { id: uid(), category: "Creative", name: "Creative testing depth", description: "Breadth and pace of creative iteration and testing.", weight: 11 },
      { id: uid(), category: "Measurement", name: "Tracking and attribution", description: "Reliability of conversion tracking, attribution, and signal quality.", weight: 10 },
      { id: uid(), category: "Optimisation", name: "Bid and budget efficiency", description: "How effectively spend is allocated and optimised.", weight: 9 },
      { id: uid(), category: "Landing Pages", name: "Post-click conversion strength", description: "Ability of landing pages and forms to convert paid traffic.", weight: 8 },
    ],
  }),
  brandMarketing: () => ({
    name: "Brand Marketing",
    factors: [
      { id: uid(), category: "Brand", name: "Brand awareness", description: "How visible and familiar the brand is in the market.", weight: 12 },
      { id: uid(), category: "Brand", name: "Brand distinctiveness", description: "How recognisable and ownable the brand system is.", weight: 11 },
      { id: uid(), category: "Creative", name: "Creative quality", description: "Strength and consistency of creative execution.", weight: 10 },
      { id: uid(), category: "Narrative", name: "Narrative coherence", description: "How consistently the brand tells a compelling story.", weight: 9 },
      { id: uid(), category: "Presence", name: "Channel consistency", description: "Consistency of brand expression across touchpoints.", weight: 8 },
    ],
  }),
  contentSeo: () => ({
    name: "Content and SEO",
    factors: [
      { id: uid(), category: "SEO", name: "Keyword coverage", description: "Breadth and relevance of coverage across important search themes.", weight: 12 },
      { id: uid(), category: "Content", name: "Content quality and depth", description: "Strength, utility, and differentiation of content assets.", weight: 11 },
      { id: uid(), category: "Distribution", name: "Content distribution", description: "How effectively content is repurposed and distributed across channels.", weight: 10 },
      { id: uid(), category: "Authority", name: "Topical authority", description: "Perceived subject matter depth and consistency in a given area.", weight: 9 },
      { id: uid(), category: "Conversion", name: "Content-to-conversion path", description: "Ability of content to lead users into meaningful actions.", weight: 8 },
    ],
  }),
  lifecycleCrm: () => ({
    name: "Lifecycle and CRM",
    factors: [
      { id: uid(), category: "Lifecycle", name: "Onboarding journey", description: "How effectively new users are activated after signup.", weight: 12 },
      { id: uid(), category: "CRM", name: "Segmentation maturity", description: "Depth and relevance of audience segmentation.", weight: 11 },
      { id: uid(), category: "Messaging", name: "Lifecycle message relevance", description: "Quality and timing of lifecycle messaging.", weight: 10 },
      { id: uid(), category: "Retention", name: "Retention programme strength", description: "Ability to drive repeat engagement and reduce churn.", weight: 9 },
      { id: uid(), category: "Experimentation", name: "Lifecycle testing cadence", description: "How actively the team tests flows, copy, and triggers.", weight: 8 },
    ],
  }),
};

const buildTemplate = (key) => (templateFactory[key] || templateFactory.blank)();

const createDefaultProject = () => {
  const clientId = uid();
  const competitorIds = [uid(), uid(), uid()];
  const template = buildTemplate("productMarketing");
  const entities = [
    { id: clientId, name: "Client", type: "client" },
    ...competitorIds.map((id, index) => ({ id, name: `Competitor ${index + 1}`, type: "competitor" })),
  ];
  const scores = {};
  template.factors.forEach((factor) => {
    scores[factor.id] = {
      [clientId]: 3,
      [competitorIds[0]]: 4,
      [competitorIds[1]]: 3,
      [competitorIds[2]]: 2,
    };
  });
  return {
    projectName: "Competitive Analysis Project",
    reportTitle: "Competitive Analysis Report",
    template: "productMarketing",
    autoNormaliseWeights: true,
    scoreMin: 1,
    scoreMax: 5,
    entities,
    factors: template.factors,
    scores,
    notes: "",
  };
};

const ensureScoresExist = (project) => {
  const next = deepClone(project);
  next.scores = next.scores || {};
  next.factors.forEach((factor) => {
    if (!next.scores[factor.id]) next.scores[factor.id] = {};
    next.entities.forEach((entity) => {
      if (typeof next.scores[factor.id][entity.id] !== "number") next.scores[factor.id][entity.id] = next.scoreMin || 1;
    });
  });
  Object.keys(next.scores).forEach((factorId) => {
    if (!next.factors.some((factor) => factor.id === factorId)) delete next.scores[factorId];
  });
  return next;
};

function Surface({ children, className = "" }) {
  return <section className={`surface ${className}`}>{children}</section>;
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle ? <p className="section-copy">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function Label({ children }) {
  return <label className="label">{children}</label>;
}

function StatCard({ label, value, helper }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {helper ? <div className="stat-helper">{helper}</div> : null}
    </div>
  );
}

function InfoPanel({ title, icon: Icon, children }) {
  return (
    <div className="info-box">
      <div className="info-title">
        {Icon ? <Icon size={16} /> : null}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Chip({ children, tone = "default" }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

function TabButton({ active, icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className={`tab-button ${active ? "active" : ""}`}>
      <Icon size={16} />
      {label}
    </button>
  );
}

function IconButton({ onClick, danger = false, children, title }) {
  return (
    <button onClick={onClick} className={`icon-button ${danger ? "danger" : ""}`} title={title}>
      {children}
    </button>
  );
}

function ReportTable({ headers, children }) {
  return (
    <div className="table-wrap">
      <table className="report-table">
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [project, setProject] = useState(() => ensureScoresExist(createDefaultProject()));
  const [activeTab, setActiveTab] = useState("setup");
  const [pdfStatus, setPdfStatus] = useState({ state: "idle", message: "" });
  const importInputRef = useRef(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      setProject(ensureScoresExist(JSON.parse(raw)));
    } catch (error) {
      console.error("Failed to load saved project", error);
    }
  }, []);

  const scoreOptions = useMemo(() => {
    const min = Number(project.scoreMin) || 1;
    const max = Number(project.scoreMax) || 5;
    const start = Math.min(min, max);
    const end = Math.max(min, max);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [project.scoreMin, project.scoreMax]);

  const client = useMemo(() => project.entities.find((entity) => entity.type === "client"), [project.entities]);
  const competitors = useMemo(() => project.entities.filter((entity) => entity.type === "competitor"), [project.entities]);

  const normalisedWeights = useMemo(() => {
    const total = project.factors.reduce((sum, factor) => sum + (Number(factor.weight) || 0), 0);
    if (!project.autoNormaliseWeights) {
      return project.factors.reduce((acc, factor) => {
        acc[factor.id] = Number(factor.weight) || 0;
        return acc;
      }, {});
    }
    return project.factors.reduce((acc, factor) => {
      acc[factor.id] = total > 0 ? (Number(factor.weight) || 0) / total : 0;
      return acc;
    }, {});
  }, [project.factors, project.autoNormaliseWeights]);

  const analysis = useMemo(() => {
    const factors = project.factors.map((factor) => {
      const clientScore = client ? Number(project.scores[factor.id]?.[client.id] || 0) : 0;
      const competitorScores = competitors.map((competitor) => Number(project.scores[factor.id]?.[competitor.id] || 0));
      const avgCompetitorScore = competitorScores.length ? competitorScores.reduce((sum, score) => sum + score, 0) / competitorScores.length : 0;
      const weightValue = normalisedWeights[factor.id] || 0;
      const delta = avgCompetitorScore - clientScore;
      return { ...factor, clientScore, avgCompetitorScore, weightValue, delta, weightedDelta: delta * weightValue };
    });

    const entityTotals = project.entities.map((entity) => {
      const total = factors.reduce((sum, factor) => sum + Number(project.scores[factor.id]?.[entity.id] || 0) * (normalisedWeights[factor.id] || 0), 0);
      return { ...entity, total: round(total, 3) };
    });

    return {
      factors,
      entityTotals,
      threatRanking: [...factors].sort((a, b) => b.weightedDelta - a.weightedDelta),
      opportunityRanking: [...factors].sort((a, b) => a.weightedDelta - b.weightedDelta),
    };
  }, [project, client, competitors, normalisedWeights]);

  const rawWeightTotal = useMemo(() => round(project.factors.reduce((sum, factor) => sum + (Number(factor.weight) || 0), 0), 2), [project.factors]);
  const weightModeLabel = project.autoNormaliseWeights ? "Normalised" : "Manual";
  const scoreScaleLabel = `${Math.min(project.scoreMin, project.scoreMax)} to ${Math.max(project.scoreMin, project.scoreMax)}`;

  const updateProject = (updater) => {
    setProject((current) => ensureScoresExist(typeof updater === "function" ? updater(current) : updater));
  };

  const saveProject = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  };

  const resetProject = () => {
    const next = ensureScoresExist(createDefaultProject());
    setProject(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPdfStatus({ state: "idle", message: "" });
  };

  const applyTemplate = (templateKey) => {
    const template = buildTemplate(templateKey);
    updateProject((current) => {
      const nextScores = {};
      template.factors.forEach((factor) => {
        nextScores[factor.id] = {};
        current.entities.forEach((entity) => {
          nextScores[factor.id][entity.id] = current.scoreMin || 1;
        });
      });
      return { ...current, template: templateKey, factors: template.factors, scores: nextScores };
    });
  };

  const addFactor = () => {
    if (project.factors.length >= MAX_FACTORS) return;
    const factorId = uid();
    updateProject((current) => ({
      ...current,
      factors: [...current.factors, { id: factorId, category: "Custom", name: `Factor ${current.factors.length + 1}`, description: "", weight: 10 }],
      scores: {
        ...current.scores,
        [factorId]: current.entities.reduce((acc, entity) => {
          acc[entity.id] = current.scoreMin;
          return acc;
        }, {}),
      },
    }));
  };

  const removeFactor = (factorId) => {
    if (project.factors.length <= 1) return;
    updateProject((current) => {
      const nextScores = { ...current.scores };
      delete nextScores[factorId];
      return { ...current, factors: current.factors.filter((factor) => factor.id !== factorId), scores: nextScores };
    });
  };

  const moveFactor = (factorId, direction) => {
    updateProject((current) => {
      const index = current.factors.findIndex((factor) => factor.id === factorId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || targetIndex < 0 || targetIndex >= current.factors.length) return current;
      const nextFactors = [...current.factors];
      const [moved] = nextFactors.splice(index, 1);
      nextFactors.splice(targetIndex, 0, moved);
      return { ...current, factors: nextFactors };
    });
  };

  const updateFactor = (factorId, field, value) => {
    updateProject((current) => ({
      ...current,
      factors: current.factors.map((factor) => factor.id === factorId ? { ...factor, [field]: field === "weight" ? Number(value) || 0 : value } : factor),
    }));
  };

  const addCompetitor = () => {
    const competitorId = uid();
    updateProject((current) => ({
      ...current,
      entities: [...current.entities, { id: competitorId, name: `Competitor ${current.entities.filter((item) => item.type === "competitor").length + 1}`, type: "competitor" }],
      scores: Object.keys(current.scores).reduce((acc, factorId) => {
        acc[factorId] = { ...current.scores[factorId], [competitorId]: current.scoreMin };
        return acc;
      }, {}),
    }));
  };

  const removeEntity = (entityId) => {
    const entity = project.entities.find((item) => item.id === entityId);
    if (!entity || entity.type === "client") return;
    if (project.entities.filter((item) => item.type === "competitor").length <= 1) return;
    updateProject((current) => {
      const nextScores = {};
      Object.keys(current.scores).forEach((factorId) => {
        const rest = { ...current.scores[factorId] };
        delete rest[entityId];
        nextScores[factorId] = rest;
      });
      return { ...current, entities: current.entities.filter((item) => item.id !== entityId), scores: nextScores };
    });
  };

  const updateEntityName = (entityId, value) => {
    updateProject((current) => ({
      ...current,
      entities: current.entities.map((entity) => entity.id === entityId ? { ...entity, name: value } : entity),
    }));
  };

  const updateScore = (factorId, entityId, value) => {
    const safeValue = clamp(Number(value) || project.scoreMin, project.scoreMin, project.scoreMax);
    updateProject((current) => ({
      ...current,
      scores: { ...current.scores, [factorId]: { ...current.scores[factorId], [entityId]: safeValue } },
    }));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${safeFileName(project.projectName || "competitive-analysis")}.json`);
  };

  const handleImportJson = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setProject(ensureScoresExist(JSON.parse(String(reader.result))));
        setPdfStatus({ state: "idle", message: "" });
      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const exportPdf = async () => {
    try {
      setPdfStatus({ state: "info", message: "Generating PDF report..." });
      const pdf = new jsPDF("p", "mm", "a4");
      const left = 14;
      const right = 14;
      const top = 16;
      const bottom = 16;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - left - right;
      let y = top;

      const ensureSpace = (needed = 8) => {
        if (y + needed > pageHeight - bottom) {
          pdf.addPage();
          y = top;
        }
      };

      const addParagraph = (text, fontSize = 10, lineHeight = 5) => {
        const lines = pdf.splitTextToSize(String(text || ""), contentWidth);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(70, 70, 70);
        lines.forEach((line) => {
          ensureSpace(lineHeight);
          pdf.text(line, left, y);
          y += lineHeight;
        });
      };

      const addTitle = (text, size = 20) => {
        ensureSpace(10);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(size);
        pdf.setTextColor(20, 20, 20);
        pdf.text(String(text || ""), left, y);
        y += 10;
      };

      const addSectionTitle = (text) => {
        ensureSpace(9);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(20, 20, 20);
        pdf.text(String(text || ""), left, y);
        y += 7;
      };

      const addDivider = () => {
        ensureSpace(4);
        pdf.setDrawColor(220, 220, 220);
        pdf.line(left, y, pageWidth - right, y);
        y += 5;
      };

      const addTable = (columns, rows) => {
        const baseWidths = columns.map((column) => column.width);
        const totalWidth = baseWidths.reduce((sum, value) => sum + value, 0);
        const scale = totalWidth > contentWidth ? contentWidth / totalWidth : 1;
        const widths = baseWidths.map((value) => value * scale);
        const rowLineHeight = 4.2;
        const headerHeight = 7;

        const drawHeader = () => {
          ensureSpace(headerHeight);
          let x = left;
          pdf.setFillColor(245, 247, 250);
          pdf.rect(left, y - 5, contentWidth, headerHeight, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(30, 30, 30);
          columns.forEach((column, index) => {
            pdf.text(column.label, x + 1.5, y);
            x += widths[index];
          });
          y += headerHeight;
        };

        drawHeader();

        rows.forEach((row) => {
          const wrapped = columns.map((column, index) => pdf.splitTextToSize(String(row[index] ?? ""), Math.max(widths[index] - 3, 8)));
          const rowHeight = Math.max(...wrapped.map((cell) => cell.length), 1) * rowLineHeight + 2;
          if (y + rowHeight > pageHeight - bottom) {
            pdf.addPage();
            y = top;
            drawHeader();
          }
          let x = left;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(55, 55, 55);
          wrapped.forEach((cellLines, index) => {
            pdf.rect(x, y - 4.5, widths[index], rowHeight);
            cellLines.forEach((line, lineIndex) => pdf.text(line, x + 1.5, y + lineIndex * rowLineHeight));
            x += widths[index];
          });
          y += rowHeight;
        });

        y += 4;
      };

      const summaryText = `This report benchmarks ${client?.name || "the client"} against ${competitors.length} competitors across ${project.factors.length} weighted factors. Scores are analysed using ${project.autoNormaliseWeights ? "normalised" : "manual"} weights to identify the most material competitive threats and the strongest areas of advantage.`;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.text("Confidential", left, y);
      y += 6;
      addTitle(project.reportTitle || "Competitive Analysis Report");
      addParagraph(`Project: ${project.projectName}`);
      y += 2;
      addDivider();
      addSectionTitle("Executive Summary");
      addParagraph(summaryText);
      y += 2;
      addSectionTitle("How to Read Delta");
      addParagraph("Delta is the average competitor score minus the client score. Positive delta means competitors are ahead on that factor. Negative delta means the client is ahead. Weighted delta means that gap has been multiplied by the factor weight, so more important factors affect the result more strongly.");
      y += 2;
      addSectionTitle("Overall Weighted Scores");
      addTable([
        { label: "Entity", width: 70 },
        { label: "Type", width: 35 },
        { label: "Weighted Score", width: 45 },
      ], analysis.entityTotals.map((entity) => [entity.name, titleCase(entity.type), round(entity.total, 2)]));
      addSectionTitle("Top Threat Factors");
      addTable([
        { label: "Factor", width: 80 },
        { label: "Category", width: 35 },
        { label: "Weighted Delta", width: 40 },
      ], analysis.threatRanking.slice(0, 5).map((factor) => [factor.name, factor.category, round(factor.weightedDelta, 3)]));
      addSectionTitle("Top Opportunity Factors");
      addTable([
        { label: "Factor", width: 80 },
        { label: "Category", width: 35 },
        { label: "Weighted Delta", width: 40 },
      ], analysis.opportunityRanking.slice(0, 5).map((factor) => [factor.name, factor.category, round(factor.weightedDelta, 3)]));
      if (project.notes?.trim()) {
        addSectionTitle("Notes");
        addParagraph(project.notes.trim());
      }
      const fileName = `${safeFileName(project.reportTitle || project.projectName || "competitive-analysis-report")}.pdf`;
      downloadBlob(pdf.output("blob"), fileName);
      setPdfStatus({ state: "success", message: `PDF exported successfully as ${fileName}` });
    } catch (error) {
      console.error("PDF export failed", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setPdfStatus({ state: "error", message: `PDF export failed: ${errorMessage}` });
    }
  };

  return (
    <div className="app-shell">
      <div className="stack-24">
        <Surface className="header-card">
          <div className="header-top">
            <div>
              <div className="badge">Functional Prototype</div>
              <h1 className="hero-title">Competitive Analysis Dashboard Builder</h1>
              <p className="hero-copy">Build weighted marketing competitive analysis projects, adjust factors dynamically, compare the client against competitors, and export a clean PDF report.</p>
            </div>
            <div className="header-actions">
              <button className="button primary" onClick={saveProject}><Save size={16} /> Save Locally</button>
              <button className="button secondary" onClick={exportJson}><Download size={16} /> Export JSON</button>
              <button className="button secondary" onClick={() => importInputRef.current?.click()}><Upload size={16} /> Import JSON</button>
              <button className="button secondary" onClick={exportPdf}><FileText size={16} /> Export PDF</button>
              <button className="button danger" onClick={resetProject}><RefreshCcw size={16} /> Reset</button>
              <input ref={importInputRef} type="file" accept="application/json" className="hidden-input" onChange={handleImportJson} />
            </div>
          </div>
          <div className="header-bottom">
            <div className="stats-grid">
              <StatCard label="Factors" value={`${project.factors.length} / ${MAX_FACTORS}`} helper="Active scoring factors" />
              <StatCard label="Competitors" value={competitors.length} helper="Compared against the client" />
              <StatCard label="Raw Weight Total" value={rawWeightTotal} helper="Before normalisation" />
              <StatCard label="Weight Mode" value={weightModeLabel} helper="How factor weights are applied" />
              <StatCard label="Score Scale" value={scoreScaleLabel} helper="Minimum to maximum score" />
            </div>
          </div>
        </Surface>

        {pdfStatus.message ? <div className={`status-banner ${pdfStatus.state}`}>{pdfStatus.message}</div> : null}

        <div className="tab-bar">
          <TabButton active={activeTab === "setup"} icon={Settings2} label="Setup" onClick={() => setActiveTab("setup")} />
          <TabButton active={activeTab === "scoring"} icon={Users} label="Scoring" onClick={() => setActiveTab("scoring")} />
          <TabButton active={activeTab === "analysis"} icon={BarChart3} label="Analysis" onClick={() => setActiveTab("analysis")} />
          <TabButton active={activeTab === "report"} icon={FileSearch} label="Report Preview" onClick={() => setActiveTab("report")} />
        </div>

        {activeTab === "setup" ? (
          <div className="stack-24">
            <div className="grid-main">
              <Surface className="surface-pad">
                <SectionHeader title="Project Setup" subtitle="Configure the project, template, score range, and competitors." />
                <div className="form-grid">
                  <div>
                    <Label>Project Name</Label>
                    <input className="input" value={project.projectName} onChange={(e) => updateProject((current) => ({ ...current, projectName: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Report Title</Label>
                    <input className="input" value={project.reportTitle} onChange={(e) => updateProject((current) => ({ ...current, reportTitle: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Template</Label>
                    <select className="input" value={project.template} onChange={(e) => applyTemplate(e.target.value)}>
                      <option value="blank">Blank Template</option>
                      <option value="productMarketing">Product Marketing</option>
                      <option value="growthMarketing">Growth Marketing</option>
                      <option value="performanceMarketing">Performance Marketing</option>
                      <option value="brandMarketing">Brand Marketing</option>
                      <option value="contentSeo">Content and SEO</option>
                      <option value="lifecycleCrm">Lifecycle and CRM</option>
                    </select>
                  </div>
                  <div className="toggle-card">
                    <div>
                      <div style={{ fontWeight: 700 }}>Auto-Normalise Weights</div>
                      <div className="section-copy">Keep factor importance scaled automatically.</div>
                    </div>
                    <input type="checkbox" checked={project.autoNormaliseWeights} onChange={(e) => updateProject((current) => ({ ...current, autoNormaliseWeights: e.target.checked }))} />
                  </div>
                  <div>
                    <Label>Score Minimum</Label>
                    <input className="input" type="number" min="1" max="10" value={project.scoreMin} onChange={(e) => updateProject((current) => ({ ...current, scoreMin: clamp(Number(e.target.value) || 1, 1, 10) }))} />
                  </div>
                  <div>
                    <Label>Score Maximum</Label>
                    <input className="input" type="number" min="1" max="10" value={project.scoreMax} onChange={(e) => updateProject((current) => ({ ...current, scoreMax: clamp(Number(e.target.value) || 5, 1, 10) }))} />
                  </div>
                </div>

                <div style={{ marginTop: 24 }}>
                  <SectionHeader title="Entities" subtitle="One client and any number of competitors." action={<button className="button secondary" onClick={addCompetitor}><Plus size={16} /> Add Competitor</button>} />
                  <div className="entities-list" style={{ marginTop: 16 }}>
                    {project.entities.map((entity) => (
                      <div key={entity.id} className="entity-row">
                        <Chip tone={entity.type === "client" ? "client" : "default"}>{titleCase(entity.type)}</Chip>
                        <input className="input" value={entity.name} onChange={(e) => updateEntityName(entity.id, e.target.value)} />
                        {entity.type === "competitor" ? <IconButton danger onClick={() => removeEntity(entity.id)} title="Remove competitor"><Trash2 size={16} /></IconButton> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </Surface>

              <div className="stack-24">
                <Surface className="surface-pad">
                  <SectionHeader title="Scoring Logic" subtitle="Use these definitions to understand the calculations." />
                  <div className="info-box" style={{ marginTop: 20 }}>
                    <p><strong>Threat factor:</strong> Each criterion you want to assess competitively.</p>
                    <p><strong>Delta:</strong> Average competitor score minus client score.</p>
                    <p><strong>Positive delta:</strong> Competitors are ahead on that factor.</p>
                    <p><strong>Negative delta:</strong> The client is ahead on that factor.</p>
                    <p><strong>Weighted delta:</strong> Delta multiplied by the factor weight, so more important factors matter more.</p>
                    <p><strong>Top threats:</strong> Factors where competitors outperform the client most after weight is applied.</p>
                    <p><strong>Opportunities:</strong> Factors where the client is strongest relative to competitors.</p>
                  </div>
                </Surface>

                <Surface className="surface-pad">
                  <InfoPanel title="Quick Summary" icon={Info}>
                    <div className="key-value">
                      <div className="key-row"><span>Factors in project</span><strong>{project.factors.length} / {MAX_FACTORS}</strong></div>
                      <div className="key-row"><span>Competitors</span><strong>{competitors.length}</strong></div>
                      <div className="key-row"><span>Raw weight total</span><strong>{rawWeightTotal}</strong></div>
                      <div className="key-row"><span>Weight mode</span><strong>{weightModeLabel}</strong></div>
                      <div className="key-row"><span>Score scale</span><strong>{scoreScaleLabel}</strong></div>
                    </div>
                  </InfoPanel>
                </Surface>
              </div>
            </div>

            <Surface className="surface-pad">
              <SectionHeader title="Factor Builder" subtitle="Adjust from 1 to 20 factors. Categories, names, descriptions, and weights are fully editable." action={<button className="button secondary" onClick={addFactor} disabled={project.factors.length >= MAX_FACTORS}><Plus size={16} /> Add Factor</button>} />
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Category</th>
                      <th>Factor</th>
                      <th>Description</th>
                      <th>Weight</th>
                      <th>Normalised</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.factors.map((factor, index) => (
                      <tr key={factor.id}>
                        <td>
                          <div className="order-cell">
                            <span>{index + 1}</span>
                            <div className="order-controls">
                              <IconButton onClick={() => moveFactor(factor.id, "up")} title="Move up"><ArrowUp size={14} /></IconButton>
                              <IconButton onClick={() => moveFactor(factor.id, "down")} title="Move down"><ArrowDown size={14} /></IconButton>
                            </div>
                          </div>
                        </td>
                        <td><input className="input" value={factor.category} onChange={(e) => updateFactor(factor.id, "category", e.target.value)} /></td>
                        <td><input className="input" value={factor.name} onChange={(e) => updateFactor(factor.id, "name", e.target.value)} /></td>
                        <td><textarea className="input" value={factor.description} onChange={(e) => updateFactor(factor.id, "description", e.target.value)} style={{ minHeight: 92 }} /></td>
                        <td><input className="input" type="number" value={factor.weight} onChange={(e) => updateFactor(factor.id, "weight", e.target.value)} /></td>
                        <td><div className="readout">{project.autoNormaliseWeights ? `${round((normalisedWeights[factor.id] || 0) * 100, 1)}%` : round(normalisedWeights[factor.id] || 0, 2)}</div></td>
                        <td><IconButton danger onClick={() => removeFactor(factor.id)} title="Remove factor"><Trash2 size={16} /></IconButton></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          </div>
        ) : null}

        {activeTab === "scoring" ? (
          <Surface className="surface-pad">
            <SectionHeader title="Score Matrix" subtitle="Input scores for the client and each competitor across all active factors." />
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Factor</th>
                    <th>Weight</th>
                    {project.entities.map((entity) => <th key={entity.id}>{entity.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {project.factors.map((factor) => (
                    <tr key={factor.id}>
                      <td>{factor.category}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{factor.name}</div>
                        {factor.description ? <div className="stat-helper">{factor.description}</div> : null}
                      </td>
                      <td>{project.autoNormaliseWeights ? `${round((normalisedWeights[factor.id] || 0) * 100, 1)}%` : factor.weight}</td>
                      {project.entities.map((entity) => (
                        <td key={entity.id}>
                          <select className="input score-select" value={project.scores[factor.id]?.[entity.id] ?? project.scoreMin} onChange={(e) => updateScore(factor.id, entity.id, e.target.value)}>
                            {scoreOptions.map((score) => <option key={score} value={score}>{score}</option>)}
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        ) : null}

        {activeTab === "analysis" ? (
          <div className="analysis-grid">
            <Surface className="surface-pad">
              <SectionHeader title="Understanding the Analysis" subtitle="How to interpret competitive gaps and advantages." />
              <div className="delta-explainer" style={{ marginTop: 16 }}>
                <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--text-secondary)" }}>
                  <strong>Delta</strong> = average competitor score minus client score.
                  <br />
                  <strong>Positive delta</strong> means competitors are ahead.
                  <br />
                  <strong>Negative delta</strong> means the client is ahead.
                  <br />
                  <strong> Weighted delta</strong> multiplies the gap by factor importance. More important factors have bigger impacts.
                </p>
              </div>
            </Surface>

            <div className="score-card-grid">
              {analysis.entityTotals.map((entity) => <StatCard key={entity.id} label={entity.type === "client" ? "Client Score" : "Competitor Avg"} value={round(entity.total, 2)} helper={entity.name} />)}
            </div>

            <Surface className="surface-pad">
              <SectionHeader title="Key Competitive Insights" subtitle="Ranked by weighted impact on overall competitiveness." />
              
              <div style={{ marginTop: 24 }}>
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Biggest Gaps</h3>
                  <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)" }}>Factors where competitors are outperforming you (positive weighted delta)</p>
                  <div className="insight-stack">
                    {analysis.factors.filter((f) => f.weightedDelta > 0).sort((a, b) => b.weightedDelta - a.weightedDelta).slice(0, 5).length > 0 ? (
                      analysis.factors.filter((f) => f.weightedDelta > 0).sort((a, b) => b.weightedDelta - a.weightedDelta).slice(0, 5).map((factor) => (
                        <div key={factor.id} className="insight-card">
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                              <Chip>{factor.category}</Chip>
                              <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 8 }}>{factor.name}</div>
                              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                You: {round(factor.clientScore, 1)} vs Competitors: {round(factor.avgCompetitorScore, 1)} 
                                {project.autoNormaliseWeights ? ` · Weight: ${round(factor.weightValue * 100, 0)}%` : ""}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                              <Chip tone="threat" style={{ fontSize: 12, padding: "6px 10px" }}>+{round(factor.weightedDelta, 2)}</Chip>
                              <div style={{ fontSize: 11, color: "var(--danger-text)", fontWeight: 600 }}>Gap</div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>No significant gaps detected</div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Strongest Advantages</h3>
                  <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)" }}>Factors where you're outperforming competitors (negative weighted delta)</p>
                  <div className="insight-stack">
                    {analysis.factors.filter((f) => f.weightedDelta < 0).sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta)).slice(0, 5).length > 0 ? (
                      analysis.factors.filter((f) => f.weightedDelta < 0).sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta)).slice(0, 5).map((factor) => (
                        <div key={factor.id} className="insight-card">
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                              <Chip>{factor.category}</Chip>
                              <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 8 }}>{factor.name}</div>
                              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                You: {round(factor.clientScore, 1)} vs Competitors: {round(factor.avgCompetitorScore, 1)} 
                                {project.autoNormaliseWeights ? ` · Weight: ${round(factor.weightValue * 100, 0)}%` : ""}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                              <Chip tone="opportunity" style={{ fontSize: 12, padding: "6px 10px" }}>-{round(Math.abs(factor.weightedDelta), 2)}</Chip>
                              <div style={{ fontSize: 11, color: "var(--success-text)", fontWeight: 600 }}>Advantage</div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>No significant advantages detected</div>
                    )}
                  </div>
                </div>
              </div>
            </Surface>

            <Surface className="surface-pad">
              <SectionHeader title="Detailed Factor Analysis" subtitle="Complete breakdown including unweighted delta." />
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Factor</th>
                      <th>Client Score</th>
                      <th>Competitor Avg</th>
                      <th>Weight</th>
                      <th>Weighted Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.factors.map((factor) => (
                      <tr key={factor.id}>
                        <td>{factor.category}</td>
                        <td>{factor.name}</td>
                        <td>{round(factor.clientScore, 1)}</td>
                        <td>{round(factor.avgCompetitorScore, 1)}</td>
                        <td>{project.autoNormaliseWeights ? `${round(factor.weightValue * 100, 0)}%` : round(factor.weightValue, 2)}</td>
                        <td style={{ fontWeight: 700, color: factor.weightedDelta > 0.01 ? "var(--danger-text)" : factor.weightedDelta < -0.01 ? "var(--success-text)" : "var(--muted-secondary)" }}>
                          {factor.weightedDelta > 0 ? "+" : ""}{round(factor.weightedDelta, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          </div>
        ) : null}

        {activeTab === "report" ? (
          <div className="stack-24">
            <Surface className="surface-pad">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Report Preview</h2>
                  <p className="section-copy">Review the structure before exporting. The PDF uses structured report data, not a screenshot.</p>
                </div>
                <button className="button primary" onClick={exportPdf}><FileText size={16} /> Export PDF Now</button>
              </div>
            </Surface>

            <div className="report-shell">
              <Surface className="report-document">
                <div className="report-section">
                  <div className="badge">Confidential</div>
                  <h1 className="hero-title" style={{ fontSize: "2.5rem" }}>{project.reportTitle}</h1>
                  <p className="hero-copy">Project: {project.projectName}</p>
                </div>

                <section className="report-section">
                  <h2 className="report-title">Executive Summary</h2>
                  <p className="hero-copy">This report benchmarks {client?.name || "the client"} against {competitors.length} competitors across {project.factors.length} weighted factors. Scores are analysed using {project.autoNormaliseWeights ? "normalised" : "manual"} weights to identify the most material competitive threats and the strongest areas of advantage.</p>
                </section>

                <section className="report-section">
                  <h2 className="report-title">How to Read Delta</h2>
                  <div className="info-box">
                    <p><strong>Delta</strong> is the average competitor score minus the client score.</p>
                    <p><strong>Positive delta</strong> means competitors are ahead on that factor.</p>
                    <p><strong>Negative delta</strong> means the client is ahead on that factor.</p>
                    <p><strong>Weighted delta</strong> means the gap has been multiplied by the factor weight, so more important factors affect the result more strongly.</p>
                  </div>
                </section>

                <section className="report-section">
                  <h2 className="report-title">Overall Weighted Scores</h2>
                  <ReportTable headers={["Entity", "Type", "Weighted Score"]}>
                    {analysis.entityTotals.map((entity) => (
                      <tr key={entity.id}>
                        <td>{entity.name}</td>
                        <td>{titleCase(entity.type)}</td>
                        <td>{round(entity.total, 2)}</td>
                      </tr>
                    ))}
                  </ReportTable>
                </section>

                <section className="report-section">
                  <h2 className="report-title">Top Threat Factors</h2>
                  <ReportTable headers={["Factor", "Category", "Weighted Delta"]}>
                    {analysis.threatRanking.slice(0, 5).map((factor) => (
                      <tr key={factor.id}>
                        <td>{factor.name}</td>
                        <td>{factor.category}</td>
                        <td>{round(factor.weightedDelta, 3)}</td>
                      </tr>
                    ))}
                  </ReportTable>
                </section>

                <section className="report-section">
                  <h2 className="report-title">Top Opportunity Factors</h2>
                  <ReportTable headers={["Factor", "Category", "Weighted Delta"]}>
                    {analysis.opportunityRanking.slice(0, 5).map((factor) => (
                      <tr key={factor.id}>
                        <td>{factor.name}</td>
                        <td>{factor.category}</td>
                        <td>{round(factor.weightedDelta, 3)}</td>
                      </tr>
                    ))}
                  </ReportTable>
                </section>

                <section className="report-section">
                  <h2 className="report-title">Notes</h2>
                  <textarea className="input note-box" value={project.notes} onChange={(e) => updateProject((current) => ({ ...current, notes: e.target.value }))} placeholder="Add custom narrative notes for the report here." />
                </section>
              </Surface>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
