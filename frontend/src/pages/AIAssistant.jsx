import { useState } from "react";
import { TOKEN_KEY, postJsonAuth } from "../lib/api";
import "./AIAssistant.css";

const INITIAL_MESSAGE = {
  role: "assistant",
  content:
    "Hello! I'm TovNa's AI Travel Assistant. I can help you discover destinations in Cambodia and plan a trip that matches your budget and interests. Where would you like to start?",
};

export default function AIAssistant({ user, onLogin }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [message, setMessage] = useState("");
  const [tripPreferences, setTripPreferences] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(event) {
    event.preventDefault();

    const text = message.trim();
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
      .map(({ role, content }) => ({ role, content }));

    setMessages((previous) => [...previous, { role: "user", content: text }]);
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const data = await postJsonAuth(
        "/ai-assistant/chat",
        {
          message: text,
          history,
          trip_preferences: tripPreferences,
        },
        token,
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
  }

  return (
    <main className="ai-assistant-page">
      <section className="ai-assistant-container">
        <header className="ai-assistant-header">
          <div className="ai-assistant-avatar">✦</div>
          <div>
            <h1>TovNa AI Assistant</h1>
            <p>Your personal Cambodia travel planner</p>
          </div>
          <span className="ai-status">Online</span>
        </header>

        {!user ? (
          <div className="ai-login-prompt">
            <h2>Start planning your trip</h2>
            <p>Please log in to chat with TovNa's AI Travel Assistant.</p>
            <button type="button" onClick={onLogin}>
              Log in to continue
            </button>
          </div>
        ) : (
          <>
            <div className="ai-chat-messages">
              {messages.map((item, index) => (
                <div
                  className={`ai-message ${item.role}`}
                  key={`${item.role}-${index}`}
                >
                  <div className="ai-message-bubble">
                    {item.content}

                    {item.recommendations?.length > 0 && (
                      <div className="ai-recommendations">
                        <h3>Recommended destinations</h3>

                        {item.recommendations.map((destination) => (
                          <article
                            className="ai-recommendation-card"
                            key={destination.id}
                          >
                            {destination.image_url && (
                              <img
                                src={destination.image_url}
                                alt={destination.name}
                              />
                            )}

                            <div>
                              <h4>{destination.name}</h4>
                              {destination.province && (
                                <p>{destination.province}</p>
                              )}
                              {destination.score != null && (
                                <p>Match score: {destination.score}</p>
                              )}
                              {destination.estimated_total != null && (
                                <p>
                                  Estimated cost:{" "}
                                  {destination.currency || "USD"}{" "}
                                  {destination.estimated_total}
                                </p>
                              )}
                              {destination.reasons?.length > 0 && (
                                <ul>
                                  {destination.reasons.map((reason, i) => (
                                    <li key={i}>{reason}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                    {item.generalTips?.length > 0 && (
                      <div className="ai-general-tips">
                        <h3>Travel tips</h3>
                        <ul>
                          {item.generalTips.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="ai-message assistant">
                  <div className="ai-message-bubble ai-typing">Thinking...</div>
                </div>
              )}
            </div>

            {error && <p className="ai-error">{error}</p>}

            <form className="ai-chat-form" onSubmit={handleSend}>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Tell me where you want to travel..."
                rows={2}
                maxLength={2000}
                disabled={loading}
              />
              <button type="submit" disabled={!message.trim() || loading}>
                {loading ? "Sending..." : "Send"}
              </button>
            </form>

            <p className="ai-disclaimer">
              TovNa AI can make mistakes. Please verify important travel
              details.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
