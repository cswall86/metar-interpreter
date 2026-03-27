import { useState, useRef } from "react";

const SYSTEM_PROMPT = `You are an expert meteorologist interpreting METAR surface observations for forecasting. Respond ONLY with valid JSON, no markdown, no backticks, no preamble. Use this exact structure: {"station":"ICAO code","observed":"date/time UTC","summary":"1-2 sentence plain English overview","elements":[{"category":"Wind or Visibility or Sky or Temperature/Dewpoint or Pressure or Precipitation or Remarks","raw":"raw token(s)","decoded":"plain English 1 sentence","forecast_note":"forecasting implication 1-2 sentences meteorologically specific"}],"overall_assessment":"2-3 sentences on atmospheric state and short-term forecast implications"} Keep every field brief. If multiple METARs given analyze most recent and note trends in overall_assessment.`;

const categoryColors = {
  "Wind": "#38bdf8",
  "Visibility": "#a78bfa",
  "Sky": "#94a3b8",
  "Temperature/Dewpoint": "#f97316",
  "Pressure": "#34d399",
  "Precipitation": "#60a5fa",
  "Remarks": "#fbbf24",
  "default": "#cbd5e1"
};

function CategoryBadge({ category }) {
  const color = categoryColors[category] || categoryColors["default"];
  return (
    <span style={{
      background: color + "18",
      color: color,
      border: `1px solid ${color}40`,
      borderRadius: "4px",
      padding: "2px 8px",
      fontSize: "12px",
      fontFamily: "'Space Mono', monospace",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontWeight: "700"
    }}>{category}</span>
  );
}

export default function MetarInterpreter() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  async function analyze() {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: input.trim() }]
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setError(`API error: ${data.error?.message || response.statusText}`);
        return;
      }

      const text = (data.content || []).map(b => b.text || "").join("").trim();
      if (!text) {
        setError("Empty response from API. Try again.");
        return;
      }

      const clean = text.replace(/^```json|^```|```$/gm, "").trim();
      try {
        const parsed = JSON.parse(clean);
        setResult(parsed);
      } catch (parseErr) {
        setError(`Parse error: ${parseErr.message}\n\n${text.slice(0, 300)}`);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Request timed out after 30s. Try again.");
      } else {
        setError(`Error: ${err.message}`);
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  function reset() {
    setInput("");
    setResult(null);
    setError(null);
    setLoading(false);
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") analyze();
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#cbd5e1",
      color: "#1e293b",
      fontFamily: "'IBM Plex Sans', sans-serif",
      padding: "0",
      overflowX: "hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #e2e8f0; }
        ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 2px; }
        .metar-input::placeholder { color: #94a3b8; }
        .metar-input:focus { outline: none; border-color: #0ea5e9 !important; box-shadow: 0 0 0 2px #bae6fd; }
        .analyze-btn { transition: all 0.15s ease; }
        .analyze-btn:hover:not(:disabled) { background: #0ea5e9 !important; transform: translateY(-1px); }
        .analyze-btn:active:not(:disabled) { transform: translateY(0); }
        .element-card { transition: border-color 0.2s; }
        .element-card:hover { border-color: #94a3b8 !important; }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fadeIn 0.35s ease forwards; }
        .scanline {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: none;
          pointer-events: none; z-index: 0;
        }
      `}</style>

      <div className="scanline" />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "820px", margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#0ea5e9",
              boxShadow: "0 0 8px #7dd3fc",
              animation: "pulse-dot 2s ease infinite"
            }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", color: "#0284c7", letterSpacing: "0.15em", textTransform: "uppercase" }}>Surface Analysis</span>
          </div>
          <h1 style={{
            fontSize: "30px", fontWeight: "600", color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1.2
          }}>METAR Interpreter</h1>
          <p style={{ marginTop: "6px", fontSize: "15px", color: "#64748b", lineHeight: 1.6 }}>
            Paste one or more raw METARs for forecasting-grade interpretation — not just decoding.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: "16px" }}>
          <textarea
            ref={textareaRef}
            className="metar-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={"KORD 271454Z 27015G24KT 10SM FEW040 BKN070 12/03 A2998 RMK AO2 SLP152..."}
            rows={5}
            style={{
              width: "100%",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "14px 16px",
              color: "#334155",
              fontFamily: "'Space Mono', monospace",
              fontSize: "12.5px",
              lineHeight: "1.7",
              resize: "vertical",
              display: "block"
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
            <span style={{ fontSize: "13px", color: "#94a3b8", fontFamily: "'Space Mono', monospace" }}>⌘↵ to analyze</span>
            <button
              className="analyze-btn"
              onClick={analyze}
              disabled={loading || !input.trim()}
              style={{
                background: loading ? "#e2e8f0" : "#0c4a6e",
                border: "1px solid " + (loading ? "#cbd5e1" : "#0ea5e9"),
                color: loading ? "#94a3b8" : "#0369a1",
                borderRadius: "6px",
                padding: "8px 20px",
                fontSize: "14px",
                fontFamily: "'Space Mono', monospace",
                fontWeight: "700",
                letterSpacing: "0.08em",
                cursor: loading ? "not-allowed" : "pointer",
                textTransform: "uppercase"
              }}
            >
              {loading ? "Analyzing..." : "Interpret →"}
            </button>
            {(result || error) && (
              <button
                onClick={reset}
                style={{
                  background: "transparent",
                  border: "1px solid #94a3b8",
                  color: "#64748b",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontFamily: "'Space Mono', monospace",
                  cursor: "pointer",
                  marginLeft: "8px"
                }}
              >Clear</button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "#1c0a0a", border: "1px solid #7f1d1d",
            borderRadius: "8px", padding: "12px 16px",
            color: "#fca5a5", fontSize: "14px", marginBottom: "24px",
            fontFamily: "'Space Mono', monospace", whiteSpace: "pre-wrap", lineHeight: "1.6"
          }}>{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", letterSpacing: "0.1em" }}>
              PROCESSING OBSERVATION...
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="fade-in">

            {/* Station Header */}
            <div style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: "20px", marginBottom: "24px", flexWrap: "wrap", gap: "12px"
            }}>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "30px", fontWeight: "700", color: "#0f172a", letterSpacing: "0.04em" }}>
                  {result.station}
                </div>
                <div style={{ fontSize: "14px", color: "#64748b", marginTop: "3px", fontFamily: "'Space Mono', monospace" }}>
                  {result.observed}
                </div>
              </div>
              <div style={{
                background: "#ffffff", border: "1px solid #cbd5e1",
                borderRadius: "8px", padding: "12px 16px", maxWidth: "420px"
              }}>
                <div style={{ fontSize: "13px", color: "#0284c7", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em", marginBottom: "6px", textTransform: "uppercase" }}>Summary</div>
                <p style={{ fontSize: "15px", lineHeight: "1.65", color: "#334155" }}>{result.summary}</p>
              </div>
            </div>

            {/* Elements Grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {result.elements?.map((el, i) => (
                <div key={i} className="element-card" style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  alignItems: "start"
                }}>
                  <div>
                    <div style={{ marginBottom: "8px" }}>
                      <CategoryBadge category={el.category} />
                    </div>
                    <div style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "11.5px", color: "#64748b",
                      marginBottom: "5px", wordBreak: "break-all"
                    }}>{el.raw}</div>
                    <div style={{ fontSize: "15px", color: "#1e293b", lineHeight: "1.5" }}>{el.decoded}</div>
                  </div>
                  <div style={{
                    borderLeft: "1px solid #e2e8f0",
                    paddingLeft: "14px"
                  }}>
                    <div style={{ fontSize: "12px", color: "#7dd3fc", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em", marginBottom: "5px", textTransform: "uppercase" }}>Forecast Implication</div>
                    <p style={{ fontSize: "12.5px", color: "#475569", lineHeight: "1.65" }}>{el.forecast_note}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Overall Assessment */}
            <div style={{
              background: "#f8fafc",
              border: "1px solid #bae6fd",
              borderRadius: "8px",
              padding: "20px"
            }}>
              <div style={{ fontSize: "12px", color: "#0284c7", fontFamily: "'Space Mono', monospace", letterSpacing: "0.12em", marginBottom: "10px", textTransform: "uppercase" }}>
                ▸ Overall Forecast Assessment
              </div>
              <p style={{ fontSize: "13.5px", lineHeight: "1.75", color: "#334155" }}>{result.overall_assessment}</p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}