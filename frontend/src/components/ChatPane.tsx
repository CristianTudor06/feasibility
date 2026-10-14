import React, { useState, useRef, useEffect } from 'react';
import { FeasibilityRow, AllocationResult, ChatMessage, StrategyType, VendorTier } from '../types';
import { 
  Bot, 
  Send, 
  Sparkles, 
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Clock,
  X,
  Move
} from 'lucide-react';

interface ChatPaneProps {
  pitches: FeasibilityRow[];
  insertedDatabase?: FeasibilityRow[] | null;
  allocations: AllocationResult[];
  activeStrategy: string;
  vendors?: VendorTier[];
  onUpdatePitches?: (updated: FeasibilityRow[], preserveHasChecked?: boolean) => void;
  // Lifted state props for continuous history support
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onUpdateStrategy?: (strategy: StrategyType) => void;
  // Floating support parameters
  isFloating?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ChatPane({
  pitches,
  insertedDatabase,
  allocations,
  activeStrategy,
  vendors = [],
  onUpdatePitches,
  messages,
  setMessages,
  onUpdateStrategy,
  isFloating = false,
  isOpen = true,
  onClose
}: ChatPaneProps) {
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Floating positioning state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 380, height: 490 });

  useEffect(() => {
    if (isFloating) {
      // Center-right align initially
      const initX = Math.max(20, window.innerWidth - 410);
      const initY = Math.max(20, window.innerHeight - 520);
      setPosition({ x: initX, y: initY });
    }
  }, [isFloating]);

  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const chatPosRef = useRef({ x: 0, y: 0 });

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (!isFloating) return;
    if (e.button !== 0) return; // Only left click
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    chatPosRef.current = { x: position.x, y: position.y };
    e.preventDefault();
  };

  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0 });
  const chatSizeRef = useRef({ width: 0, height: 0 });

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isFloating) return;
    if (e.button !== 0) return;
    resizingRef.current = true;
    resizeStartRef.current = { x: e.clientX, y: e.clientY };
    chatSizeRef.current = { width: size.width, height: size.height };
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current && isFloating) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        // Boundaries checks
        const newX = Math.max(5, Math.min(window.innerWidth - 150, chatPosRef.current.x + deltaX));
        const newY = Math.max(5, Math.min(window.innerHeight - 100, chatPosRef.current.y + deltaY));
        setPosition({ x: newX, y: newY });
      }

      if (resizingRef.current && isFloating) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        
        const newWidth = Math.max(340, Math.min(1000, chatSizeRef.current.width + deltaX));
        const newHeight = Math.max(400, Math.min(900, chatSizeRef.current.height + deltaY));
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = false;
      resizingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isFloating]);

  // Auto-scroll to latest chat bubble
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputVal;
    if (!textToSend.trim() || loading) return;

    if (!customText) {
      setInputVal('');
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, text: m.text })),
          dataState: {
            pitches,
            allocations,
            insertedDatabase: insertedDatabase || [],
            vendors: vendors && vendors.length > 0 ? vendors : [
              { name: 'Vendor 1', tier: 'tier 0' },
              { name: 'Vendor 2', tier: 'tier 1' },
              { name: 'Vendor 3', tier: 'tier 2' },
              { name: 'Vendor 4', tier: 'tier 3' }
            ]
          },
          activeStrategy
        })
      });

      if (!res.ok) {
        throw new Error('Failed to get live response from the feasibility chat route.');
      }

      const responseData = await res.json();
      
      // If AI modified the data state, trigger parent update!
      if (responseData.updatedPitches && Array.isArray(responseData.updatedPitches)) {
        if (onUpdatePitches) {
          onUpdatePitches(responseData.updatedPitches);
        }
      }

      // If AI updated activeStrategy, trigger parent update!
      if (responseData.updateStrategy && onUpdateStrategy) {
        onUpdateStrategy(responseData.updateStrategy);
      }
      
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-model`,
        role: 'model',
        text: responseData.text || "I was unable to draft a valid answer. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-err`,
          role: 'model',
          text: `⚠️ **Connection Error**: ${err.message || "Failed to reach the server."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Premade fast questions
  const quickQuestions = [
    { label: "Cheapest version", text: "Create the cheapest version across our active scenarios. Set calculate strategy to 'cost' and maximize internal capabilities to decrease costs." },
    { label: "Add line", text: "Add a new line for USA with a target size of 2000, 15 minutes test, 50% incidence, internal capabilities of 3000, and standard vendor prices." },
    { label: "Check deficits", text: "Are there any deficit countries in our active options? If so, which targets are unsatisfied?" },
    { label: "Cheapest source", text: "Which represents our absolute cheapest source per interview across all vendor layers?" }
  ];

  if (isFloating && !isOpen) {
    return null;
  }

  return (
    <div 
      className={`bg-white rounded-xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all ${
        isFloating ? 'fixed select-none' : 'h-[600px] w-full'
      }`} 
      id="chat-pane-box"
      style={isFloating ? {
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 9999
      } : undefined}
    >
      {/* Header */}
      <div 
        onMouseDown={handleHeaderMouseDown}
        className={`p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 ${
          isFloating ? 'cursor-move select-none' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#ebf8ff] rounded-lg text-[#2b6cb0]">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {isFloating && <Move className="h-3 w-3 text-slate-400 shrink-0" />}
              Procurement & Feasibility Assistant
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                RULE-BASED (NO AI)
              </span>
            </h3>
            <p className="text-[10px] text-slate-505 font-medium">
              Deterministic local assistance. Click and drag header to reposition.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Refresh thread */}
          <button
            onClick={() => {
              setMessages([]);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-150 rounded transition"
            title="Clear thread history"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* Close button for Floating */}
          {isFloating && onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-150 rounded transition cursor-pointer"
              title="Close Assistant"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/20" id="chat-messages-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 max-w-full ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`p-1.5 rounded-full h-6 w-6 shrink-0 flex items-center justify-center text-[9px] font-bold leading-none ${msg.role === 'user' ? 'bg-[#2b6cb0] text-white' : 'bg-slate-200 text-slate-800'}`}>
              {msg.role === 'user' ? 'ME' : 'AST'}
            </div>

            {/* Bubble */}
            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[82%]`}>
              <div 
                className={`p-3 rounded-xl text-[11px] font-normal leading-relaxed overflow-x-auto shadow-sm whitespace-pre-line ${
                  msg.role === 'user' 
                    ? 'bg-[#2b6cb0] text-white rounded-tr-none' 
                    : 'bg-white border border-slate-150 text-slate-800 rounded-tl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <span>{msg.text}</span>
                ) : (
                  <div className="space-y-1">
                    {renderMessageText(msg.text)}
                  </div>
                )}
              </div>

              <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono px-1">
                <Clock className="h-2 w-2" />
                <span>{msg.timestamp}</span>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 max-w-full">
            <div className="p-1.5 rounded-full h-6 w-6 bg-slate-200 text-slate-800 shrink-0 flex items-center justify-center text-[9px] font-bold animate-pulse">
              AST
            </div>
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl rounded-tl-none p-2.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Quick Actions Pills */}
      <div className="p-1.5 border-t border-slate-100 bg-slate-50/50 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q.text)}
            disabled={loading}
            className="text-[9px] font-semibold bg-white text-slate-700 border border-slate-200 hover:border-[#2b6cb0] hover:text-[#2b6cb0] hover:bg-[#ebf8ff] px-2 py-0.5 rounded-full cursor-pointer transition shrink-0"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-1.5 border-t border-slate-100 flex items-center gap-1.5 bg-white shrink-0"
      >
        <input
          id="chat-input"
          type="text"
          placeholder="Type here..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          disabled={loading}
          className="flex-1 px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2b6cb0] text-slate-800"
        />
        <button
          id="send-chat-btn"
          type="submit"
          disabled={loading || !inputVal.trim()}
          className="p-1 bg-[#2b6cb0] hover:bg-[#205080] text-white rounded-lg transition cursor-pointer shrink-0 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>

      {/* Resize corner handle */}
      {isFloating && (
        <div 
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize flex items-end justify-end pb-0.5 pr-0.5 text-slate-300 hover:text-slate-500 bg-transparent transition active:text-[#2b6cb0]"
          title="Drag bottom-right corner to resize window"
          style={{ zIndex: 60 }}
        >
          <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
            <path d="M6,0 L6,6 L0,6 Z" className="text-slate-400 opacity-60" />
          </svg>
        </div>
      )}
    </div>
  );
}

function renderMessageText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    
    // Check if it's a heading
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={idx} className="text-[11px] font-bold text-slate-800 mt-[12px] mb-[4px] first:mt-0 font-sans tracking-tight border-b border-indigo-100 pb-0.5 flex items-center gap-1">
          {parseInlineMarkdown(trimmed.substring(4))}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={idx} className="text-[12px] font-extrabold text-[#205080] mt-[14px] mb-[6px] first:mt-0 font-sans tracking-tight">
          {parseInlineMarkdown(trimmed.substring(3))}
        </h3>
      );
    }
    
    // Check if list item
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || (trimmed.match(/^\d+\.\s/) && !trimmed.includes('1.000'))) {
      const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
      const content = isBullet ? trimmed.substring(2) : trimmed.replace(/^\d+\.\s/, '');
      const prefixNode = isBullet ? (
        <span className="text-[#2b6cb0] mr-1 font-bold select-none">•</span>
      ) : (
        <span className="text-[#2b6cb0] font-bold mr-1 select-none">{trimmed.match(/^\d+\./)?.[0]}</span>
      );
      
      return (
        <div key={idx} className="flex items-start my-1 ml-0.5 pl-0.5 leading-relaxed text-[10.5px] text-slate-700">
          {prefixNode}
          <div className="flex-1">{parseInlineMarkdown(content)}</div>
        </div>
      );
    }

    // Default line
    return (
      <p key={idx} className="min-h-[1.1rem] leading-relaxed my-1 text-slate-705 font-normal">
        {parseInlineMarkdown(line)}
      </p>
    );
  });
}

function parseInlineMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  
  const regex = /(\*\*|==|\*)(.*?)\1/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const type = match[1];
    const innerText = match[2];
    
    if (matchIndex > currentIndex) {
      parts.push(text.substring(currentIndex, matchIndex));
    }
    
    if (type === '**') {
      parts.push(<strong key={matchIndex} className="font-bold text-slate-900 mx-0.5">{innerText}</strong>);
    } else if (type === '==') {
      parts.push(<mark key={matchIndex} className="bg-yellow-105 text-yellow-900 px-1 py-0.5 rounded font-medium">{innerText}</mark>);
    } else if (type === '*') {
      parts.push(<em key={matchIndex} className="italic text-slate-800 font-medium">{innerText}</em>);
    }
    
    currentIndex = regex.lastIndex;
  }
  
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }
  
  return parts.length > 0 ? parts : text;
}
