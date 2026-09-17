import React, { useState, useRef, useEffect } from 'react';
import { useIPAM } from '../context/IPAMContext';
import {
  processChatCommand,
  ChatMessage,
  ChatAction,
  ChatbotContext,
  WizardState,
} from '../utils/chatbotEngine';
import {
  Bot,
  Sparkles,
  Send,
  X,
  Trash2,
  Radio,
  Server,
  Network,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Search,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  Wand2,
  RotateCcw,
  HelpCircle,
  MessageSquarePlus,
} from 'lucide-react';
import { IPRecord } from '../types';

interface IPAMChatbotProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export const IPAMChatbot: React.FC<IPAMChatbotProps> = ({
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
}) => {
  const {
    subnets,
    ips,
    users,
    currentUser,
    hasPermission,
    allocateIP,
    updateIP,
    releaseIP,
    pingIP,
    createSubnet,
    updateSubnet,
    deleteSubnet,
    createUser,
    updateUser,
    deleteUser,
    changePassword,
    deviceClassifications,
    createDeviceClassification,
    updateDeviceClassification,
    deleteDeviceClassification,
    auditLogs,
    setSelectedSubnetId,
    setActiveTab,
  } = useIPAM();

  // Internal open state if not controlled externally
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const toggleOpen = () => {
    if (controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState | null>(null);

  // Draggable Bot Icon Position (Persisted in localStorage)
  const [botPosition, setBotPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('ipam_bot_icon_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragInfoRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  }>({ startX: 0, startY: 0, originX: 0, originY: 0, moved: false });

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary button

    const currentX = botPosition ? botPosition.x : window.innerWidth - 80;
    const currentY = botPosition ? botPosition.y : window.innerHeight - 80;

    dragInfoRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: currentX,
      originY: currentY,
      moved: false,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragInfoRef.current.startX;
      const dy = ev.clientY - dragInfoRef.current.startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragInfoRef.current.moved = true;
        setIsDragging(true);
      }

      const nextX = Math.max(12, Math.min(window.innerWidth - 68, dragInfoRef.current.originX + dx));
      const nextY = Math.max(12, Math.min(window.innerHeight - 68, dragInfoRef.current.originY + dy));

      setBotPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setTimeout(() => setIsDragging(false), 50);

      setBotPosition((latest) => {
        if (latest) {
          try {
            localStorage.setItem('ipam_bot_icon_pos', JSON.stringify(latest));
          } catch {}
        }
        return latest;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Touch Drag Handlers (Mobile & Touch displays)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const currentX = botPosition ? botPosition.x : window.innerWidth - 80;
    const currentY = botPosition ? botPosition.y : window.innerHeight - 80;

    dragInfoRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      originX: currentX,
      originY: currentY,
      moved: false,
    };

    const handleTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      const t = ev.touches[0];
      const dx = t.clientX - dragInfoRef.current.startX;
      const dy = t.clientY - dragInfoRef.current.startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragInfoRef.current.moved = true;
        setIsDragging(true);
      }

      const nextX = Math.max(12, Math.min(window.innerWidth - 68, dragInfoRef.current.originX + dx));
      const nextY = Math.max(12, Math.min(window.innerHeight - 68, dragInfoRef.current.originY + dy));

      setBotPosition({ x: nextX, y: nextY });
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      setTimeout(() => setIsDragging(false), 50);

      setBotPosition((latest) => {
        if (latest) {
          try {
            localStorage.setItem('ipam_bot_icon_pos', JSON.stringify(latest));
          } catch {}
        }
        return latest;
      });
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleFloatingButtonClick = (e: React.MouseEvent) => {
    if (dragInfoRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    toggleOpen();
  };



  // Granular Permissions for Assistant UI elements
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canSeeUsers = Boolean(isSuperAdmin || hasPermission('manageUsers'));
  const canSeeDeviceTypes = Boolean(
    isSuperAdmin ||
      (hasPermission('manageDeviceClassifications') && currentUser?.role !== 'auditor') ||
      (currentUser?.role === 'network_admin' && currentUser?.permissions?.manageDeviceClassifications !== false)
  );
  const canSeeAudit = Boolean(
    isSuperAdmin ||
      hasPermission('viewAuditLogs')
  );

  // Initial welcome message (Command Center Hub)
  const initialActions: ChatAction[] = [
    { label: '🔍 Find / Search IP', actionType: 'quick_prompt', payload: 'find ip', variant: 'primary' },
    { label: '🌐 Subnets', actionType: 'quick_prompt', payload: 'subnets', variant: 'outline' },
  ];
  if (canSeeUsers) {
    initialActions.push({ label: '👥 Users', actionType: 'quick_prompt', payload: 'users', variant: 'secondary' });
  }
  if (canSeeDeviceTypes) {
    initialActions.push({ label: '🏷️ Device Types', actionType: 'quick_prompt', payload: 'device types', variant: 'secondary' });
  }
  initialActions.push({ label: '📊 Fleet Overview', actionType: 'quick_prompt', payload: 'subnet utilization summary', variant: 'secondary' });

  const initialSuggestions = ['20.1', 'Subnets'];
  if (canSeeUsers) initialSuggestions.push('Users');
  if (canSeeDeviceTypes) initialSuggestions.push('Device types');
  initialSuggestions.push('Find next available IP', 'Help');

  const initialMessages: ChatMessage[] = [
    {
      id: 'welcome-1',
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `🎛️ **IPAM Command Center & Assistant**\n\nWelcome **${currentUser?.fullName || currentUser?.username || 'there'}**! I am your command-driven network assistant with **Self-Learning Intelligence**.\n\nSelect an interactive command module below or enter an IP/query directly:`,
      actions: initialActions,
      suggestions: initialSuggestions,
    },
  ];

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('ipam_chatbot_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return initialMessages;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save messages to session
  useEffect(() => {
    try {
      sessionStorage.setItem('ipam_chatbot_history', JSON.stringify(messages));
    } catch {
      // Ignore storage errors
    }
  }, [messages]);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Global keyboard shortcut: Ctrl+K or Cmd+K to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleOpen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIp(text);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const handleNewChat = () => {
    setMessages(initialMessages);
    setWizardState(null);
    setInputMessage('');
    try {
      sessionStorage.removeItem('ipam_chatbot_history');
    } catch {}
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleClearHistory = () => {
    const clearNotice: ChatMessage = {
      id: `clear-${Date.now()}`,
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `🧹 **Chat History Cleared.**\n\nSelect an interactive command module below or start a new query:`,
      actions: initialActions,
      suggestions: initialSuggestions,
    };
    setMessages([clearNotice]);
    setWizardState(null);
    setInputMessage('');
    try {
      sessionStorage.removeItem('ipam_chatbot_history');
    } catch {}
  };

  const handleSendMessage = async (rawText?: string) => {
    const query = (rawText !== undefined ? rawText : inputMessage).trim();
    if (!query || isProcessing) return;

    const lowerQuery = query.toLowerCase();
    if (['clear', 'cls', 'clear chat', 'clearchat', 'clear history', 'clean chat'].includes(lowerQuery)) {
      handleClearHistory();
      return;
    }
    if (['new chat', 'newchat', 'reset chat', 'resetchat', 'start over', 'startover', 'restart', 'restart chat', 'new conversation'].includes(lowerQuery)) {
      handleNewChat();
      return;
    }

    const userTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: userTimestamp,
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsProcessing(true);

    try {
      const ctx: ChatbotContext = {
        subnets,
        ips,
        users,
        currentUser,
        hasPermission,
        allocateIP,
        updateIP,
        releaseIP,
        pingIP,
        createSubnet,
        updateSubnet,
        deleteSubnet,
        createUser,
        updateUser,
        deleteUser,
        changePassword,
        deviceClassifications,
        createDeviceClassification,
        updateDeviceClassification,
        deleteDeviceClassification,
        auditLogs,
        setSelectedSubnetId,
        setActiveTab,
        wizardState,
        setWizardState,
      };

      const response = await processChatCommand(query, ctx);
      setMessages((prev) => [...prev, response]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `❌ An unexpected error occurred: ${err.message || 'Command processing failure'}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActionClick = async (action: ChatAction) => {
    if (action.actionType === 'quick_prompt' && action.payload) {
      await handleSendMessage(String(action.payload));
    } else if (action.actionType === 'view_subnet') {
      let targetSubnetId = action.payload?.subnetId;
      if (!targetSubnetId && action.payload?.ip) {
        const found = subnets.find(
          (s) => ips.some((i) => i.ip === action.payload.ip && i.subnetId === s.id)
        );
        if (found) targetSubnetId = found.id;
      }
      if (targetSubnetId) {
        setSelectedSubnetId(targetSubnetId);
        setActiveTab('subnets');
        // If on small screen, minimize drawer so user sees subnet immediately
        if (window.innerWidth < 768) {
          toggleOpen();
        }
      }
    } else if (action.actionType === 'navigate_tab' && action.payload?.tab) {
      setActiveTab(action.payload.tab);
      if (window.innerWidth < 768) {
        toggleOpen();
      }
    } else if (action.actionType === 'ping' && action.payload?.ip) {
      await handleSendMessage(`ping ${action.payload.ip}`);
    } else if (action.actionType === 'allocate' && action.payload?.ip) {
      await handleSendMessage(`allocate ${action.payload.ip}`);
    } else if (action.actionType === 'release' && action.payload?.ip) {
      await handleSendMessage(`release ${action.payload.ip}`);
    }
  };

  // Simple parser to render markdown text with bolding, code blocks, lists
  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, lineIdx) => {
      // Check for bullet list
      const isBullet = line.trim().startsWith('-');
      const cleanLine = isBullet ? line.trim().substring(1).trim() : line;

      // Parse inline formatting: **bold** and `code`
      const parts = cleanLine.split(/(\*\*.*?\*\*|`.*?`)/g);

      const parsedElements = parts.map((part, partIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={partIdx} className="font-semibold text-slate-100">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={partIdx}
              className="px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-700/80 font-mono text-xs text-cyan-300 font-semibold inline-block"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={lineIdx} className="flex items-start gap-2 my-1 text-xs text-slate-300">
            <span className="text-cyan-400 mt-1 shrink-0">•</span>
            <span className="flex-1 leading-relaxed">{parsedElements}</span>
          </div>
        );
      }

      if (line.trim() === '') {
        return <div key={lineIdx} className="h-2" />;
      }

      return (
        <p key={lineIdx} className="text-xs text-slate-300 leading-relaxed my-0.5">
          {parsedElements}
        </p>
      );
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'allocated':
        return 'bg-blue-950/80 text-blue-300 border-blue-800';
      case 'reserved':
        return 'bg-purple-950/80 text-purple-300 border-purple-800';
      case 'dhcp':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'quarantine':
        return 'bg-rose-950/80 text-rose-300 border-rose-800';
      default:
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
    }
  };

  const isRestrictedScope =
    currentUser &&
    currentUser.role !== 'super_admin' &&
    currentUser.permissions?.allowedSubnetIds &&
    currentUser.permissions.allowedSubnetIds.length > 0;

  const getWizardStepLabel = (wizard: WizardState): string => {
    switch (wizard.type) {
      case 'create_subnet':
        if (wizard.step === 'ask_name') return 'Step 1 of 2: Subnet Name';
        if (wizard.step === 'ask_cidr') return 'Step 2 of 2: CIDR Block';
        if (wizard.step === 'confirm') return 'Ready to Confirm';
        return 'Create Subnet';
      case 'delete_subnet':
        if (wizard.step === 'select_subnet') return 'Step 1 of 2: Select Subnet';
        if (wizard.step === 'confirm') return 'Step 2 of 2: Confirm Deletion';
        return 'Delete Subnet';
      case 'create_user':
        if (wizard.step === 'ask_username') return 'Step 1 of 4: Username';
        if (wizard.step === 'ask_fullname') return 'Step 2 of 4: Full Name';
        if (wizard.step === 'ask_role') return 'Step 3 of 4: Role';
        if (wizard.step === 'ask_password') return 'Step 4 of 4: Password';
        if (wizard.step === 'confirm') return 'Ready to Confirm';
        return 'Create User';
      case 'delete_user':
        if (wizard.step === 'select_user') return 'Step 1 of 2: Select User';
        if (wizard.step === 'confirm') return 'Step 2 of 2: Confirm Deletion';
        return 'Delete User';
      case 'create_classification':
        if (wizard.step === 'ask_name') return 'Step 1 of 2: Category Name';
        if (wizard.step === 'ask_ports') return 'Step 2 of 2: Default Ports';
        if (wizard.step === 'confirm') return 'Ready to Confirm';
        return 'Create Device Type';
      default:
        return 'Interactive Wizard';
    }
  };

  const getWizardPlaceholder = (wizard: WizardState): string => {
    switch (wizard.type) {
      case 'create_subnet':
        if (wizard.step === 'ask_name') return 'Enter subnet name (e.g. Office-LAN, DMZ-Web)...';
        if (wizard.step === 'ask_cidr') return 'Enter IPv4 CIDR (e.g. 192.168.20.0/24)...';
        if (wizard.step === 'confirm') return 'Type "confirm" to create subnet or "cancel"...';
        return 'Enter value or type "cancel"...';
      case 'delete_subnet':
        if (wizard.step === 'select_subnet') return 'Type subnet name / CIDR to delete, or click an option above...';
        if (wizard.step === 'confirm') return 'Type "confirm delete" or "cancel"...';
        return 'Select option or type "cancel"...';
      case 'create_user':
        if (wizard.step === 'ask_username') return 'Enter username for the new account (e.g. sarah_connor)...';
        if (wizard.step === 'ask_fullname') return 'Enter full display name (e.g. Sarah Connor)...';
        if (wizard.step === 'ask_role') return 'Enter role: super_admin, network_admin, operator, or auditor...';
        if (wizard.step === 'ask_password') return 'Enter password (min 8 chars) or choose preset above...';
        if (wizard.step === 'confirm') return 'Type "confirm" to create user or "cancel"...';
        return 'Enter value or type "cancel"...';
      case 'delete_user':
        if (wizard.step === 'select_user') return 'Type username to delete, or click an option above...';
        if (wizard.step === 'confirm') return 'Type "confirm delete" or "cancel"...';
        return 'Select option or type "cancel"...';
      case 'create_classification':
        if (wizard.step === 'ask_name') return 'Enter device type name (e.g. Load-Balancer, Firewall)...';
        if (wizard.step === 'ask_ports') return 'Enter default ports (e.g. 80,443 or 5432,3306)...';
        if (wizard.step === 'confirm') return 'Type "confirm" or "cancel"...';
        return 'Enter value or type "cancel"...';
      default:
        return 'Type your answer or "cancel"...';
    }
  };

  return (
    <>
      {/* Floating Draggable Bot Icon Button */}
      {!isOpen && (
        <div
          style={
            botPosition
              ? { left: `${botPosition.x}px`, top: `${botPosition.y}px` }
              : { right: '24px', bottom: '24px' }
          }
          className="fixed z-50 select-none touch-none"
        >
          <button
            id="btn-open-chatbot"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onClick={handleFloatingButtonClick}
            aria-label="Open IPAM Assistant"
            title="IPAM Assistant (Ctrl+J) — Drag to move anywhere"
            className={`relative w-13 h-13 sm:w-14 sm:h-14 rounded-2xl sm:rounded-full bg-[#171717] dark:bg-[#ededed] text-white dark:text-black shadow-xl border border-[#ebebeb] dark:border-[#262626] flex items-center justify-center transition-all duration-150 group cursor-grab active:cursor-grabbing ${
              isDragging ? 'scale-115 rotate-3 cursor-grabbing' : 'hover:scale-105 active:scale-95'
            }`}
          >
            {/* Ambient subtle glow */}
            <div className="absolute inset-0 rounded-2xl sm:rounded-full bg-[#0070f3]/15 blur-sm transition-colors pointer-events-none" />

            {/* Centered Bot Icon with Status Indicator */}
            <div className="relative flex items-center justify-center pointer-events-none">
              <Bot className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-xs group-hover:scale-105 transition-transform" />

              {/* Pulsing Live Status Dot */}
              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-black"></span>
              </span>
            </div>

            {/* Hover Tooltip */}
            <div className="pointer-events-none absolute right-full mr-3.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-[#ebebeb] dark:border-[#262626] shadow-xl text-xs font-medium text-[#171717] dark:text-[#ededed] whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5 text-[#0070f3]" />
              <span>Assistant</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#f4f4f5] dark:bg-[#1c1c1c] border border-[#ebebeb] dark:border-[#262626] text-[10px] font-mono text-[#666666] dark:text-[#a1a1a1]">
                Ctrl+J
              </kbd>
            </div>
          </button>
        </div>
      )}


      {/* Main Chatbot Flyout Window */}
      {isOpen && (
        <div
          id="ipam-chatbot-panel"
          className={`fixed z-50 flex flex-col bg-white dark:bg-[#0c0c0c] border border-[#ebebeb] dark:border-[#262626] shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 text-[#171717] dark:text-[#ededed] ${
            isExpanded
              ? 'bottom-4 right-4 left-4 sm:left-auto sm:w-[650px] h-[85vh] max-h-[900px]'
              : 'bottom-6 right-6 w-[92vw] sm:w-[460px] h-[600px] max-h-[82vh]'
          }`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-[#fafafa] dark:bg-[#111111] border-b border-[#ebebeb] dark:border-[#262626]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#171717] text-white dark:bg-[#ededed] dark:text-black flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-[#171717] dark:text-[#ededed] truncate">IPAM Assistant</h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>
                <p className="text-[10px] text-[#8f8f8f] dark:text-[#737373] truncate">
                  Role: <span className="font-semibold text-[#171717] dark:text-[#ededed]">{currentUser?.role?.replace('_', ' ') || 'User'}</span>
                  {isRestrictedScope ? ' (Scoped RBAC)' : ' (Full Scope)'}
                </p>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleNewChat}
                title="Start New Chat (Reset Conversation)"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-950/90 hover:bg-blue-900 text-cyan-300 hover:text-white border border-cyan-800/60 hover:border-cyan-600 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">New Chat</span>
              </button>
              <button
                onClick={() => handleSendMessage('help')}
                title="Command Guide & Help"
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearHistory}
                title="Clear Chat History"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restore Size' : 'Expand View'}
                className="hidden sm:block p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleOpen}
                title="Close Assistant"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conversation Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 shadow-sm">
                    {msg.isSecurityAlert ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Bot className="w-3.5 h-3.5" />
                    )}
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-xl p-3 shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black rounded-br-none'
                      : msg.isSecurityAlert
                      ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 rounded-bl-none'
                      : 'bg-[#f4f4f5] dark:bg-[#171717] border border-[#ebebeb] dark:border-[#262626] text-[#171717] dark:text-[#ededed] rounded-bl-none'
                  }`}
                >
                  {/* Message Body */}
                  <div className="space-y-1">
                    {renderFormattedText(msg.text)}
                  </div>

                  {/* Render Embedded IP Cards */}
                  {msg.ipCards && msg.ipCards.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.ipCards.map((ipRec) => {
                        const parentSub = subnets.find((s) => s.id === ipRec.subnetId);
                        return (
                          <div
                            key={ipRec.id}
                            className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-xs shadow-inner space-y-2 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono font-bold text-cyan-300 text-sm">{ipRec.ip}</span>
                                <button
                                  onClick={() => copyToClipboard(ipRec.ip)}
                                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  title="Copy IP"
                                >
                                  {copiedIp === ipRec.ip ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getStatusBadge(
                                  ipRec.status
                                )}`}
                              >
                                {ipRec.status.toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                              <div className="truncate">
                                <span className="text-slate-500">Host: </span>
                                <span className="text-slate-200 font-medium">{ipRec.hostname || 'Unassigned'}</span>
                              </div>
                              <div className="truncate">
                                <span className="text-slate-500">Subnet: </span>
                                <span className="text-slate-200 font-medium">{parentSub?.name || 'Unknown'}</span>
                              </div>
                              {ipRec.macAddress && (
                                <div className="truncate font-mono">
                                  <span className="text-slate-500">MAC: </span>
                                  <span className="text-slate-300">{ipRec.macAddress}</span>
                                </div>
                              )}
                              {ipRec.deviceType && (
                                <div className="truncate">
                                  <span className="text-slate-500">Type: </span>
                                  <span className="text-cyan-300 capitalize">{ipRec.deviceType}</span>
                                </div>
                              )}
                              {ipRec.owner && (
                                <div className="truncate col-span-2">
                                  <span className="text-slate-500">Owner: </span>
                                  <span className="text-slate-300">{ipRec.owner}</span>
                                </div>
                              )}
                            </div>

                            {/* Card Quick Actions */}
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-800/80">
                              <button
                                onClick={() => handleActionClick({ actionType: 'ping', payload: { ip: ipRec.ip } })}
                                className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                <Radio className="w-3 h-3 text-cyan-400" />
                                <span>Ping</span>
                              </button>
                              <button
                                onClick={() =>
                                  handleActionClick({
                                    actionType: 'view_subnet',
                                    payload: { subnetId: ipRec.subnetId },
                                  })
                                }
                                className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3 text-blue-400" />
                                <span>Open</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Render Embedded Subnet Cards */}
                  {msg.subnetCards && msg.subnetCards.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.subnetCards.map((sub) => (
                        <div
                          key={sub.id}
                          className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-xs shadow-inner space-y-2 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-100">{sub.name}</span>
                              <span className="ml-1.5 font-mono text-[11px] text-cyan-400 font-semibold">{sub.cidr}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-300 font-mono">
                              {sub.utilizationPercent}%
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full ${
                                sub.utilizationPercent > 85
                                  ? 'bg-rose-500'
                                  : sub.utilizationPercent > 60
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, sub.utilizationPercent)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                              Allocated: <strong className="text-slate-200 font-mono">{sub.allocatedCount}</strong>
                            </span>
                            <span>
                              Free: <strong className="text-emerald-400 font-mono">{sub.availableCount}</strong>
                            </span>
                            <button
                              onClick={() =>
                                handleActionClick({ actionType: 'view_subnet', payload: { subnetId: sub.id } })
                              }
                              className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-0.5 cursor-pointer ml-1"
                            >
                              <span>View</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions / Buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
                      {msg.actions.map((act, actIdx) => (
                        <button
                          key={actIdx}
                          onClick={() => handleActionClick(act)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                            act.variant === 'primary'
                              ? 'bg-blue-600 hover:bg-blue-500 text-white'
                              : act.variant === 'danger'
                              ? 'bg-rose-600 hover:bg-rose-500 text-white'
                              : act.variant === 'outline'
                              ? 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800/60'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }`}
                        >
                          <span>{act.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggestions Chips */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                        Suggested Prompts:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestions.map((sug, sugIdx) => (
                          <button
                            key={sugIdx}
                            onClick={() => handleSendMessage(sug)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-200 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                            <span>{sug}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamp Footer */}
                  <div className="mt-1.5 text-right">
                    <span className="text-[9px] text-slate-500 font-mono">{msg.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Thinking / Loading Spinner */}
            {isProcessing && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl rounded-bl-none p-3.5 text-xs text-slate-400 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>Processing IPAM query &amp; checking permissions...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Active Wizard Indicator */}
          {wizardState && (
            <div className="px-3.5 py-2 bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-cyan-950/90 border-t border-cyan-800/40 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                </span>
                <span className="text-cyan-300 font-semibold truncate text-[11px]">
                  {wizardState.type === 'create_subnet' && '🧙 Guided Subnet Creation'}
                  {wizardState.type === 'delete_subnet' && '⚠️ Subnet Deletion Confirmation'}
                  {wizardState.type === 'create_user' && '🧙 Guided User Account Creation'}
                  {wizardState.type === 'delete_user' && '⚠️ User Deletion Confirmation'}
                  {wizardState.type === 'create_classification' && '🧙 Guided Classification Creation'}
                </span>
                <span className="text-[10px] text-cyan-200 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-700/60 font-medium shrink-0">
                  {getWizardStepLabel(wizardState)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSendMessage('cancel')}
                className="px-2 py-0.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            </div>
          )}

          {/* Persistent Interactive Quick Command Navigation Bar */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/90 border-t border-slate-800/90 overflow-x-auto scrollbar-none text-[11px]">
            <button
              type="button"
              onClick={() => handleSendMessage('menu')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0 border border-slate-800 shadow-xs"
              title="Return to Main Menu"
            >
              <span>🏠 Menu</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('find ip')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0 border border-slate-800 shadow-xs"
              title="Search IP, Hostname, Notes"
            >
              <span>🔍 Find IP</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('subnets')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0 border border-slate-800 shadow-xs"
              title="List Subnets & Utilization"
            >
              <span>🌐 Subnets</span>
            </button>
            {canSeeUsers && (
              <button
                type="button"
                onClick={() => handleSendMessage('users')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0 border border-slate-800 shadow-xs"
                title="Manage User Accounts"
              >
                <span>👥 Users</span>
              </button>
            )}
            {canSeeDeviceTypes && (
              <button
                type="button"
                onClick={() => handleSendMessage('device types')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0 border border-slate-800 shadow-xs"
                title="View Device Classifications"
              >
                <span>🏷️ Types</span>
              </button>
            )}
            {canSeeAudit && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('audit');
                  if (window.innerWidth < 768) {
                    toggleOpen();
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0 border border-slate-800 shadow-xs"
                title="View Audit Logs"
              >
                <span>📜 Logs</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSendMessage('subnet utilization summary')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0 border border-slate-800 shadow-xs"
              title="Fleet Subnet Utilization Stats"
            >
              <span>📊 Stats</span>
            </button>
          </div>

          {/* Input Bar Footer */}
          <div className="p-3 bg-[#fafafa] dark:bg-[#111111] border-t border-[#ebebeb] dark:border-[#262626]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={
                    wizardState
                      ? getWizardPlaceholder(wizardState)
                      : "Ask e.g. 'find 192.168.10.1', 'create subnet', 'create user'..."
                  }
                  disabled={isProcessing}
                  className="w-full pl-3 pr-8 py-2 rounded-lg bg-white dark:bg-[#171717] border border-[#ebebeb] dark:border-[#262626] focus:border-[#0070f3] text-xs text-[#171717] dark:text-[#ededed] placeholder-[#8f8f8f] dark:placeholder-[#737373] outline-none transition-all"
                />
                {inputMessage && (
                  <button
                    type="button"
                    onClick={() => setInputMessage('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8f8f8f] hover:text-[#171717] dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!inputMessage.trim() || isProcessing}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#171717] text-white dark:bg-[#ededed] dark:text-black hover:opacity-90 disabled:opacity-40 shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
            <div className="flex items-center justify-between mt-2 text-[10px] text-[#8f8f8f] dark:text-[#737373]">
              <span>Press <strong>Enter</strong> to send • <strong>Ctrl+J</strong> to toggle</span>
              <span className="text-[#0070f3] font-medium">Local RBAC Guarded</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
