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

  // Calculate market position score (average of all entities, weighted)
  const marketPositionScore = useMemo(() => {
    if (!client) return 0;
    const clientTotal = analysis.entityTotals.find((e) => e.id === client.id)?.total || 0;
    const competitorAvg = analysis.entityTotals.filter((e) => e.type === "competitor").reduce((sum, e) => sum + e.total, 0) / Math.max(competitors.length, 1);
    return round(clientTotal, 1);
  }, [analysis, client, competitors]);

  // Generate key insight from top threat
  const keyInsight = useMemo(() => {
    if (!analysis.threatRanking.length) return "No competitive insights available";
    const topThreat = analysis.threatRanking[0];
    return `${topThreat.name} is the biggest competitive gap`;
  }, [analysis.threatRanking]);

  // Generate recommended action
  const recommendedAction = useMemo(() => {
    if (!analysis.opportunityRanking.length) return "Strengthen your competitive positioning";
    const topOpportunity = analysis.opportunityRanking[0];
    return `Improve ${topOpportunity.name} to gain competitive advantage`;
  }, [analysis.opportunityRanking]);

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-title">Competitor Intelligence</div>
        <div className="sidebar-nav">
          <button className="nav-item" onClick={() => setActiveTab("dashboard")}>Market Overview</button>
          <button className="nav-item active" onClick={() => setActiveTab("analysis")}>Competitors</button>
          <button className="nav-item" onClick={() => setActiveTab("setup")}>Gap Analysis</button>
          <button className="nav-item" onClick={() => setActiveTab("report")}>Reports</button>
        </div>
        <div className="sidebar-bottom">
          <button className="button primary" style={{ width: "100%" }} onClick={exportPdf}><FileText size={16} /> Generate Report</button>
          <button className="icon-button" title="Settings"><Settings2 size={18} /></button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Bar */}
        <div className="top-bar">
          <div className="top-bar-left">
            <input type="text" className="search-input" placeholder="Search competitors..." />
          </div>
          <div className="top-bar-right">
            <button className="button primary" onClick={addCompetitor}><Plus size={16} /> Add Competitor</button>
            <button className="icon-button" title="Notifications"><BarChart3 size={18} /></button>
            <button className="icon-button" title="Help"><Info size={18} /></button>
          </div>
        </div>

        {/* Main Area */}
        <div className="main-area">
          {pdfStatus.message ? <div className={`status-banner ${pdfStatus.state}`}>{pdfStatus.message}</div> : null}

          {/* Summary Row */}
          <div className="summary-row">
            <div className="summary-card">
              <div className="summary-card-label">Market Position Score</div>
              <div className="summary-card-value">{marketPositionScore}</div>
              <div className="summary-card-change">+2.4% vs last month</div>
            </div>
            <div className="summary-card">
              <div className="summary-card-label">Key Insight</div>
              <div className="summary-card-description">{keyInsight}</div>
            </div>
            <div className="summary-card">
              <div className="summary-card-label">Recommended Action</div>
              <div className="summary-card-action">{recommendedAction}<span className="priority-tag high">High</span></div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="main-grid">
            {/* Left Column - Competitor Matrix */}
            <div className="competitor-matrix">
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 className="panel-title">Competitor Matrix</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="icon-button" title="Filter"><Info size={16} /></button>
                  <button className="icon-button" title="Export"><Download size={16} /></button>
                </div>
              </div>
              <div className="table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Entity</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Factors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.entityTotals.map((entity) => (
                      <tr key={entity.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{entity.name}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{entity.type === "client" ? "Your Company" : "Competitor"}</div>
                        </td>
                        <td><div style={{ fontSize: 16, fontWeight: 700 }}>{round(entity.total, 1)}</div></td>
                        <td>
                          {entity.type === "client" ? (
                            <Chip tone="client">Leading</Chip>
                          ) : entity.total > marketPositionScore ? (
                            <Chip tone="threat">Ahead</Chip>
                          ) : (
                            <Chip tone="default">Behind</Chip>
                          )}
                        </td>
                        <td>{project.factors.length} factors</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column */}
            <div className="right-column">
              {/* Gap Analysis */}
              <div className="gap-panel">
                <h3 className="panel-title">Gap Analysis</h3>
                {analysis.threatRanking.slice(0, 3).map((factor, idx) => (
                  <div key={factor.id} className="gap-item">
                    <div className="gap-item-title">{idx + 1}. {factor.name}</div>
                    <div className="gap-item-desc">Gap score: {round(factor.weightedDelta, 2)}</div>
                  </div>
                ))}
                <button className="button secondary" style={{ width: "100%", marginTop: 12 }} onClick={() => setActiveTab("setup")}>View All Gaps →</button>
              </div>

              {/* Market Alert */}
              <div className="market-alert">
                <div className="alert-header">
                  <div className="alert-title">Market Alert</div>
                  <div className="impact-tag">CRITICAL</div>
                </div>
                <div className="alert-description">
                  {analysis.threatRanking.length > 0
                    ? `${analysis.threatRanking[0].name} represents your biggest competitive vulnerability.`
                    : "Monitor competitive landscape for changes."}
                </div>
              </div>

              {/* Recommended Actions */}
              <div className="actions-list">
                <h3 className="panel-title">Recommended Actions</h3>
                {analysis.threatRanking.slice(0, 3).map((factor) => (
                  <div key={factor.id} className="action-item">
                    <div className="action-text">Improve {factor.name} to reduce competitive gap</div>
                    <span className="action-label">High</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Settings Tab */}
          {activeTab === "setup" ? (
            <div style={{ marginTop: 32 }}>
              <div className="summary-row" style={{ gridTemplateColumns: "1fr" }}>
                <div className="summary-card">
                  <div className="summary-card-label">Project Settings</div>
                  <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <Label>Score Min</Label>
                        <input className="input" type="number" value={project.scoreMin} onChange={(e) => updateProject((current) => ({ ...current, scoreMin: clamp(Number(e.target.value) || 1, 1, 10) }))} />
                      </div>
                      <div>
                        <Label>Score Max</Label>
                        <input className="input" type="number" value={project.scoreMax} onChange={(e) => updateProject((current) => ({ ...current, scoreMax: clamp(Number(e.target.value) || 5, 1, 10) }))} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24, display: "grid", gap: 20 }}>
                <div className="summary-card">
                  <div className="summary-card-label">Competitors</div>
                  <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                    {project.entities.filter((e) => e.type === "competitor").map((entity) => (
                      <div key={entity.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input className="input" value={entity.name} onChange={(e) => updateEntityName(entity.id, e.target.value)} style={{ flex: 1 }} />
                        <IconButton danger onClick={() => removeEntity(entity.id)} title="Remove"><Trash2 size={16} /></IconButton>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <button className="button primary" onClick={saveProject}><Save size={16} /> Save Locally</button>
                  <button className="button secondary" onClick={exportJson}><Download size={16} /> Export JSON</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <button className="button secondary" onClick={() => importInputRef.current?.click()}><Upload size={16} /> Import JSON</button>
                  <button className="button danger" onClick={resetProject}><RefreshCcw size={16} /> Reset</button>
                </div>
                <input ref={importInputRef} type="file" accept="application/json" className="hidden-input" onChange={handleImportJson} />
              </div>
            </div>
          ) : null}

          {/* Report Tab */}
          {activeTab === "report" ? (
            <div style={{ marginTop: 32 }}>
              <div className="summary-card" style={{ marginBottom: 24 }}>
                <div className="summary-card-label">Report Preview</div>
                <p className="summary-card-description" style={{ marginTop: 12 }}>Review the structure and export as PDF</p>
              </div>

              <div className="report-shell">
                <div className="summary-card" style={{ padding: 32 }}>
                  <div className="badge">Confidential</div>
                  <h1 style={{ marginTop: 16, fontSize: 32, fontWeight: 700 }}>{project.reportTitle}</h1>
                  <p style={{ color: "var(--muted)", marginTop: 8 }}>Project: {project.projectName}</p>

                  <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Executive Summary</h2>
                    <p style={{ color: "var(--muted)" }}>This report benchmarks {client?.name || "the client"} against {competitors.length} competitors across {project.factors.length} weighted factors. Scores are analysed using {project.autoNormaliseWeights ? "normalised" : "manual"} weights to identify competitive gaps.</p>
                  </div>

                  <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Overall Weighted Scores</h2>
                    <div className="table-wrap">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th>Entity</th>
                            <th>Type</th>
                            <th>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.entityTotals.map((entity) => (
                            <tr key={entity.id}>
                              <td>{entity.name}</td>
                              <td>{titleCase(entity.type)}</td>
                              <td>{round(entity.total, 2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Top Threat Factors</h2>
                    <div className="table-wrap">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th>Factor</th>
                            <th>Category</th>
                            <th>Gap</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.threatRanking.slice(0, 5).map((factor) => (
                            <tr key={factor.id}>
                              <td>{factor.name}</td>
                              <td>{factor.category}</td>
                              <td>{round(factor.weightedDelta, 3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Top Opportunity Factors</h2>
                    <div className="table-wrap">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th>Factor</th>
                            <th>Category</th>
                            <th>Advantage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.opportunityRanking.slice(0, 5).map((factor) => (
                            <tr key={factor.id}>
                              <td>{factor.name}</td>
                              <td>{factor.category}</td>
                              <td>{round(factor.weightedDelta, 3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Notes</h2>
                    <textarea className="input note-box" value={project.notes} onChange={(e) => updateProject((current) => ({ ...current, notes: e.target.value }))} placeholder="Add custom narrative notes for the report here." />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
