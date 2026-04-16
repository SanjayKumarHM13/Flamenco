import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { MessageSquare, Send, X, Bot, User, Minimize2, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { askGemini } from "../lib/gemini";
import { ChatMessage } from "../types";
import { cn } from "../lib/utils";

export const TradingChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "1", role: "assistant", content: "Hello! I'm your **Flamenco assistant**. How can I help you with your high-frequency trading terminal today?", timestamp: new Date().toISOString() }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "user",
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const history = messages.map(m => ({
      role: m.role === "user" ? "user" as const : "model" as const,
      parts: [{ text: m.content }]
    }));

    try {
      const response = await askGemini(input, history);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: "assistant",
        content: "I encountered an error processing your request. Please try again.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.4)] flex items-center justify-center group transition-all"
            >
              <MessageSquare className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            onWheel={(e) => e.stopPropagation()}
            className={cn(
              "bg-zinc-950 border border-zinc-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden transition-all duration-300 overscroll-contain",
              isMinimized ? "h-16 w-64" : "h-[600px] max-h-[calc(100vh-120px)] w-[400px]"
            )}
          >
            {/* Header */}
            <div className="p-4 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600/20 rounded-xl flex items-center justify-center">
                  <Bot className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-white uppercase tracking-widest">Flamenco AI</span>
                  <span className="text-[8px] text-emerald-400 font-mono uppercase tracking-tighter">System Online</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg" onClick={() => setIsMinimized(!isMinimized)}>
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
                  <div className="p-4 space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5",
                          msg.role === "user" ? "bg-zinc-800" : "bg-blue-600"
                        )}>
                          {msg.role === "user" ? <User className="w-3.5 h-3.5 text-zinc-400" /> : <Bot className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className={cn(
                          "max-w-[85%] px-4 py-2.5 rounded-2xl text-[13px] leading-snug",
                          msg.role === "user" 
                            ? "bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-600/10" 
                            : "bg-zinc-900 text-zinc-300 rounded-tl-none border border-zinc-800 shadow-sm"
                        )}>
                          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-snug prose-p:my-0">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          <div className={cn(
                            "text-[8px] mt-1.5 font-mono opacity-50",
                            msg.role === "user" ? "text-right" : "text-left"
                          )}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="bg-zinc-900 px-4 py-2.5 rounded-2xl rounded-tl-none border border-zinc-800 shadow-sm">
                          <div className="flex gap-1.5">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Input - Permanently Pinned */}
                <div className="p-3 border-t border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2"
                  >
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Analyze market regime..."
                      className="h-10 bg-zinc-950 border-zinc-800 text-[13px] text-white focus-visible:ring-blue-600/50 rounded-xl placeholder:text-zinc-600"
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      className="h-10 w-10 bg-blue-600 hover:bg-blue-500 flex-shrink-0 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                      disabled={isLoading || !input.trim()}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
