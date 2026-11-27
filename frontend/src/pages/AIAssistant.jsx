import { useCallback, useEffect, useRef, useState } from "react";
import { TOKEN_KEY, postJsonAuth } from "../lib/api";
import "./AIAssistant.css";

const INITIAL_MESSAGE = {
  role: "assistant",
  content:
    "Hello! I'm TovNa's AI Travel Assistant. I can help you discover destinations in Cambodia and plan a trip that matches your budget and interests. Where would you like to start?",
};

const SUGGESTIONS = [
  "Plan a 3-day beach trip from Phnom Penh",
  "Cheap nature getaways near Phnom Penh",
  "When is the best time to visit Koh Rong?",
  "What should I pack for the islands?",
];

/* =========================================================
   Helpers
========================================================= */

function humanize(key) {
  const label = key.replace(/_/g, " ").trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatPreference(key, value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value))) {
    if (/budget/i.test(key)) return `USD ${value} per person`;
    if (/day|duration/i.test(key))
      return `${value} ${Number(value) === 1 ? "day" : "days"}`;
  }
  return String(value);
}

function getPreferenceEntries(preferences) {
  return Object.entries(preferences || {}).filter(([, value]) => {
    if (value == null || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return typeof value !== "object";
  });
}

function getBudget(preferences) {
  const raw =
    preferences?.budget_per_person ??
    preferences?.budget ??
    preferences?.max_budget;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function renderInline(text) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

/* Turns plain assistant text into paragraphs and bullet lists.
   Also splits inline " - Name: ..." runs into separate bullets. */
function RichText({ text }) {
  const normalized = String(text || "").replace(
    /\s+-\s+(?=[A-Z][^:\n]{1,40}:)/g,
    "\n- ",
  );

  const blocks = [];
  let list = [];

  const flushList = () => {
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  };

  normalized.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
    } else if (/^[-*•]\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-*•]\s+/, ""));
    } else {
      flushList();
      blocks.push({ type: "text", value: trimmed });
    }
  });
  flushList();

  return blocks.map((block, index) =>
    block.type === "list" ? (
      <ul className="ai-richtext-list" key={index}>
        {block.items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    ) : (
      <p key={index}>{renderInline(block.value)}</p>
    ),
  );
}

/* =========================================================
   Small UI pieces
========================================================= */

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M12 2.5c.5 4.6 2.9 7 7.5 7.5-4.6.5-7 2.9-7.5 7.5-.5-4.6-2.9-7-7.5-7.5 4.6-.5 7-2.9 7.5-7.5Zm6.5 12c.25 2.2 1.3 3.25 3.5 3.5-2.2.25-3.25 1.3-3.5 3.5-.25-2.2-1.3-3.25-3.5-3.5 2.2-.25 3.25-1.3 3.5-3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M4 12 20 4l-4.5 16-3.5-6.5L4 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RecommendationCard({ destination, rank, budget }) {
  const [imageFailed, setImageFailed] = useState(false);

  const score = Number(destination.score);
  const hasScore = Number.isFinite(score);
  const percent = hasScore ? Math.max(0, Math.min(100, score)) : 0;

  const cost = Number(destination.estimated_total);
  const hasCost = destination.estimated_total != null && Number.isFinite(cost);
  const currency = destination.currency || "USD";

  const reasons = destination.reasons || [];
  const overBy = hasCost && budget && cost > budget ? cost - budget : null;
  const flaggedOver =
    overBy != null || reasons.some((r) => /above your budget/i.test(r));

  return (
    <article className="ai-rec-card">
      <div className="ai-rec-media">
        {destination.image_url && !imageFailed ? (
          <img
            src={destination.image_url}
            alt={destination.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="ai-rec-placeholder" aria-hidden="true">
            {destination.name?.charAt(0)}
          </span>
        )}
        <span className="ai-rec-rank">#{rank}</span>
      </div>

      <div className="ai-rec-body">
        <div className="ai-rec-top">
          <div>
            <h4>{destination.name}</h4>
            {destination.province && <p>{destination.province}</p>}
          </div>

          {hasScore && (
            <div
              className="ai-score-ring"
              style={{ "--score": `${percent}%` }}
              role="img"
              aria-label={`Match score ${score.toFixed(0)} out of 100`}
            >
              <span>{score.toFixed(0)}</span>
            </div>
          )}
        </div>

        {hasCost && (
          <div className={`ai-rec-cost ${flaggedOver ? "is-over" : "is-ok"}`}>
            <strong>
              {currency} {cost.toLocaleString()}
            </strong>
            <span>
              {overBy != null
                ? `${currency} ${overBy.toLocaleString()} over budget`
                : flaggedOver
                  ? "Over budget"
                  : "per person"}
            </span>
          </div>
        )}

        {reasons.length > 0 && (
          <ul className="ai-rec-reasons">
            {reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function TripSummary({ preferences, onReset, canReset }) {
  const entries = getPreferenceEntries(preferences);

  return (
    <aside className="ai-trip-panel" aria-label="Your trip so far">
      <h2>Your trip so far</h2>

      {entries.length === 0 ? (
        <p className="ai-trip-empty">
          Share your budget, trip length, starting point and interests. I'll
          keep them here as we chat.
        </p>
      ) : (
        <dl className="ai-trip-list">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{humanize(key)}</dt>
              <dd>{formatPreference(key, value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {canReset && (
        <button type="button" className="ai-ghost-btn" onClick={onReset}>
          Start a new trip
        </button>
      )}
    </aside>
  );
}

/* =========================================================
   Main component
========================================================= */

export default function AIAssistant({ user, onLogin }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [message, setMessage] = useState("");
  const [tripPreferences, setTripPreferences] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  // Keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, error]);

  // Cancel any in-flight request when leaving the page
  useEffect(() => () => abortRef.current?.abort(), []);

  // Grow the textarea with its content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [message]);

  const sendMessage = useCallback(
    async (rawText) => {
      const text = rawText.trim();
      if (!text || loading) return;

      if (!user) {
        onLogin?.();
        return;
      }

      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setError("Your session has expired. Please log in again.");
        onLogin?.();
        return;
      }

      const history = messages
        .filter((item) => item.role === "user" || item.role === "assistant")
        .slice(-10)
        .map(({ role, content }) => ({
          role,
          content: String(content).slice(0, 2000),
        }));
      setMessages((previous) => [...previous, { role: "user", content: text }]);
      setMessage("");
      setError("");
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await postJsonAuth(
          "/ai-assistant/chat",
          {
            message: text,
            history,
            trip_preferences: tripPreferences,
          },
          token,
          controller.signal,
        );

        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content: data.reply || "I'm sorry, I couldn't generate a response.",
            recommendations: data.recommendations || [],
            generalTips: data.general_tips || [],
          },
        ]);

        if (data.trip_preferences) {
          setTripPreferences(data.trip_preferences);
        }
      } catch (err) {
        if (err.name === "AbortError") return;

        // Take the unsent message back so the user can edit and resend it
        setMessages((previous) => previous.slice(0, -1));
        setMessage(text);

        if (err.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setError("Your session has expired. Please log in again.");
          onLogin?.();
        } else {
          setError(
            err.message ||
              "Unable to contact the AI Assistant. Please try again.",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, onLogin, tripPreferences, user],
  );

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage(message);
  }

  function handleKeyDown(event) {
    // Enter sends, Shift+Enter adds a new line
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      sendMessage(message);
    }
  }

  function handleReset() {
    abortRef.current?.abort();
    setMessages([INITIAL_MESSAGE]);
    setTripPreferences({});
    setMessage("");
    setError("");
    setLoading(false);
    textareaRef.current?.focus();
  }

  const budget = getBudget(tripPreferences);
  const isFreshChat = messages.length === 1;
  const hasConversation =
    messages.length > 1 || getPreferenceEntries(tripPreferences).length > 0;

  return (
    <main className="ai-page">
      <div className="ai-shell">
        <section className="ai-chat" aria-label="TovNa AI Assistant">
          <header className="ai-header">
            <div className="ai-avatar">
              <SparkIcon />
            </div>
            <div className="ai-header-text">
              <h1>TovNa AI Assistant</h1>
              <p>Your personal Cambodia travel planner</p>
            </div>
            <span className="ai-status">
              <i aria-hidden="true" />
              Online
            </span>
          </header>

          {!user ? (
            <div className="ai-login">
              <div className="ai-login-icon">
                <SparkIcon />
              </div>
              <h2>Plan your Cambodia trip in a chat</h2>
              <p>
                Log in to get destination matches based on your budget, trip
                length and interests.
              </p>
              <ul>
                <li>Compare destinations by cost and match score</li>
                <li>Get tips for transport, timing and packing</li>
                <li>Refine your plan as your preferences change</li>
              </ul>
              <button
                type="button"
                className="ai-primary-btn"
                onClick={onLogin}
              >
                Log in to continue
              </button>
            </div>
          ) : (
            <>
              <div className="ai-messages" role="log" aria-live="polite">
                {messages.map((item, index) => (
                  <div
                    className={`ai-msg ${item.role}`}
                    key={`${item.role}-${index}`}
                  >
                    {item.role === "assistant" && (
                      <span className="ai-msg-avatar" aria-hidden="true">
                        <SparkIcon />
                      </span>
                    )}

                    <div className="ai-bubble">
                      <div className="ai-richtext">
                        <RichText text={item.content} />
                      </div>

                      {item.recommendations?.length > 0 && (
                        <section className="ai-recs">
                          <h3>Recommended destinations</h3>
                          <div className="ai-recs-list">
                            {item.recommendations.map((destination, i) => (
                              <RecommendationCard
                                key={
                                  destination.id ?? `${destination.name}-${i}`
                                }
                                destination={destination}
                                rank={i + 1}
                                budget={budget}
                              />
                            ))}
                          </div>
                        </section>
                      )}

                      {item.generalTips?.length > 0 && (
                        <section className="ai-tips">
                          <h3>Travel tips</h3>
                          <ul>
                            {item.generalTips.map((tip, i) => (
                              <li key={i}>{tip}</li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </div>
                  </div>
                ))}

                {isFreshChat && !loading && (
                  <div className="ai-suggestions">
                    <p>Try asking</p>
                    <div>
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          type="button"
                          key={suggestion}
                          onClick={() => sendMessage(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="ai-msg assistant">
                    <span className="ai-msg-avatar" aria-hidden="true">
                      <SparkIcon />
                    </span>
                    <div
                      className="ai-bubble ai-typing"
                      aria-label="Assistant is typing"
                    >
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {error && (
                <p className="ai-error" role="alert">
                  {error}
                </p>
              )}

              <form className="ai-composer" onSubmit={handleSubmit}>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about destinations, budget or trip length..."
                  aria-label="Message"
                  rows={1}
                  maxLength={2000}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="ai-send-btn"
                  disabled={!message.trim() || loading}
                  aria-label="Send message"
                >
                  <SendIcon />
                  <span>Send</span>
                </button>
              </form>

              <p className="ai-disclaimer">
                TovNa AI can make mistakes. Check prices and travel details
                before you book.
              </p>
            </>
          )}
        </section>

        {user && (
          <TripSummary
            preferences={tripPreferences}
            onReset={handleReset}
            canReset={hasConversation}
          />
        )}
      </div>
    </main>
  );
}
