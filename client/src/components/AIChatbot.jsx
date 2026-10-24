import React, { useState, useEffect, useRef, useContext } from "react";
import { AppContext } from "../context/AppContext";
import { useUser, useClerk, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

const AIChatbot = () => {
  const { backendUrl, setShowHotelReg } = useContext(AppContext);
  const { user } = useUser();
  const { getToken } = useAuth();
  const clerk = useClerk();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);
  const chatEndRef = useRef(null);

  // Initial welcome message
  useEffect(() => {
    const userName = user?.firstName || user?.fullName || "Guest";
    const initialGreeting = {
      sender: "bot",
      text: `Hello **${userName}**! 👋 Welcome to QuickStay.\n\nI am your **AI Concierge Assistant**. I can help you check your bookings, answer cancellation questions, find hotels, or guide you on property listing.`,
      actions: [
        { label: "📋 My Bookings", query: "What are my bookings?" },
        { label: "🏨 Find Rooms", query: "Show me available hotel rooms" },
        { label: "❌ Cancellation Rules", query: "What is your cancellation policy?" },
        { label: "💳 Payment Methods", query: "What payment methods are supported?" },
      ],
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages([initialGreeting]);
  }, [user]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadCount(0);
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg = {
      sender: "user",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue("");
    setIsLoading(true);

    try {
      const headers = { "Content-Type": "application/json" };
      // Verify identity with a Clerk session token; the server ignores plain
      // user id headers to prevent impersonation.
      if (user?.id) {
        try {
          const token = await getToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch (error) {
          console.error("[QuickStay] Could not get Clerk session token:", error);
        }
      }

      const res = await fetch(`${backendUrl}/api/chatbot/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        const botMsg = {
          sender: "bot",
          text: data.reply,
          actions: data.actions || [],
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error(data.message || "Failed to fetch AI reply");
      }
    } catch (err) {
      console.error("Chat error:", err);
      const errorMsg = {
        sender: "bot",
        text: "Sorry, I am having trouble connecting right now. Please try again shortly.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action) => {
    if (action.query) {
      handleSendMessage(action.query);
      return;
    }

    if (action.action === "navigate" && action.path) {
      navigate(action.path);
      setIsOpen(false);
    } else if (action.action === "login") {
      clerk.openSignIn();
    } else if (action.action === "open_hotel_reg") {
      setShowHotelReg(true);
      setIsOpen(false);
    }
  };

  // Basic markdown-like formatting helper
  const renderFormattedText = (rawText) => {
    if (!rawText) return null;
    const lines = rawText.split("\n");

    return lines.map((line, idx) => {
      let formattedLine = line;

      // Header h3
      if (formattedLine.startsWith("### ")) {
        return (
          <h4 key={idx} className="font-semibold text-gray-900 text-sm mt-2 mb-1">
            {formattedLine.replace("### ", "")}
          </h4>
        );
      }

      // Bold text formatting
      const parts = formattedLine.split(/(\*\*.*?\*\*)/g);
      const lineContent = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={pIdx} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      return (
        <p key={idx} className={`text-sm leading-relaxed ${line.trim().startsWith("•") ? "pl-2" : "mb-1"}`}>
          {lineContent}
        </p>
      );
    });
  };

  return (
    <div
      className="fixed right-4 sm:right-6 z-50 flex flex-col items-end"
      style={{
        bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Floating Chat Box Window */}
      {isOpen && (
        <div className="mb-4 w-[calc(100vw-2rem)] sm:w-[360px] md:w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 transform scale-100 opacity-100" style={{ height: 'min(540px, 70dvh)' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3.5 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-lg border border-white/30">
                  🤖
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-blue-600 rounded-full"></span>
              </div>
              <div>
                <h3 className="font-semibold text-sm leading-tight">QuickStay AI Concierge</h3>
                <p className="text-[11px] text-blue-100">Ask about bookings & stays</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([])}
                title="Clear Chat"
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-xs text-blue-100 hover:text-white"
              >
                🗑️
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white font-semibold text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 space-y-3.5" style={{ WebkitOverflowScrolling: 'touch' }}>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                  }`}
                >
                  {msg.sender === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <div>{renderFormattedText(msg.text)}</div>
                  )}

                  <span
                    className={`block text-[10px] mt-1 text-right ${
                      msg.sender === "user" ? "text-blue-100" : "text-gray-400"
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>

                {/* Quick Action Chips / Buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
                    {msg.actions.map((act, aIdx) => (
                      <button
                        key={aIdx}
                        onClick={() => handleActionClick(act)}
                        className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-full px-3 py-1 font-medium transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-400 bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 w-fit shadow-xs">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
                <span className="text-xs text-gray-500">AI is thinking...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions Strip */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-1.5 overflow-x-auto no-scrollbar text-xs">
            <button
              onClick={() => handleSendMessage("Show my bookings")}
              className="whitespace-nowrap px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
            >
              📋 My Bookings
            </button>
            <button
              onClick={() => handleSendMessage("Search rooms in Miami")}
              className="whitespace-nowrap px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
            >
              🏨 Search Rooms
            </button>
            <button
              onClick={() => handleSendMessage("What is your cancellation policy?")}
              className="whitespace-nowrap px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
            >
              ❌ Cancellation
            </button>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-gray-100 flex items-center gap-2"
          >
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about bookings, hotels, timing..."
              className="flex-1 bg-slate-100 text-gray-800 text-sm rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4 translate-x-0.5"
              >
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.917H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.917a.75.75 0 0 0 .926.941l18-7.5a.75.75 0 0 0 0-1.382l-18-7.5Z" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-3.5 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform active:scale-95 flex items-center gap-2 cursor-pointer border border-white/20"
      >
        {/* Pulsing Outer Glow */}
        <span className="absolute -inset-1 rounded-full bg-blue-500 opacity-40 group-hover:opacity-75 blur-sm transition duration-300 animate-pulse"></span>

        <span className="relative text-2xl flex items-center justify-center">
          {isOpen ? "✕" : "🤖"}
        </span>

        {!isOpen && (
          <span className="relative hidden sm:inline-block text-xs font-semibold pr-1">
            AI Assistant
          </span>
        )}

        {/* Unread badge indicator */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default AIChatbot;
