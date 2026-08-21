import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api-client';
import {
  Sparkles, RefreshCw, ArrowRight, Bot, AlertCircle,
  Send, X, MessageSquare, Clock, TrendingUp,
  Mic, Volume2, Square, TrendingDown, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  requestId?: string;
  sender: 'user' | 'kenby';
  text: { ml: string; en: string };
  isVoiceInput?: boolean;
  audioUrl?: string | null;
  source?: string;
  evidence?: any;
  context?: any;
  timestamp: string;
}

type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'ERROR';

export default function KenbyAIPage() {
  const navigate = useNavigate();

  // 1. DYNAMIC SYSTEM DATE INITIALIZATION
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [lang, setLang] = useState<'ml' | 'en'>('ml');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');

  // Conversational chat history & lightweight conversation context
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [lastMetric, setLastMetric] = useState<string | undefined>(undefined);
  const [conversationContext, setConversationContext] = useState<any>(null);

  // Conversational Voice State Machine
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const submittedRequestIdRef = useRef<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const SILENCE_THRESHOLD_MS = 1400; // 1.4s natural silence auto-submit threshold

  // Pre-load and cache SpeechSynthesis voices as fallback
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Auto-scroll chat to bottom on new message or live transcript
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, liveTranscript, voiceState]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 2. MONTH SELECTOR PILLS DATA (Recent 3 months ending at current)
  const monthPills = useMemo(() => {
    const pills = [];
    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNamesMl = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];

    for (let offset = 2; offset >= 0; offset--) {
      let d = new Date(currentYear, currentMonth - 1 - offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      pills.push({
        year: y,
        month: m,
        labelEn: `${monthNamesEn[m - 1]} ${y}`,
        labelMl: `${monthNamesMl[m - 1]} ${y}`,
        isCurrentMonth: y === currentYear && m === currentMonth,
      });
    }
    return pills;
  }, [currentYear, currentMonth]);

  // 3. FETCH MONTHLY BI REPORT & SNAPSHOT FROM BACKEND
  const { data: report, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-ai-monthly-report', selectedYear, selectedMonth, selectedDate],
    queryFn: async () => {
      const params: any = { year: selectedYear, month: selectedMonth };
      if (selectedDate) params.date = selectedDate;
      const res = await api.get('/ai/owner-assistant', { params });
      return res.data;
    },
    staleTime: 60000,
  });

  const snapshot = report?.snapshot;
  const comparison = snapshot?.comparison;

  // Helper to sanitize markdown noise defensively
  const sanitizeText = (str?: string): string => {
    if (!str) return '';
    return str
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/###/g, '')
      .trim();
  };

  // Phonetic text cleaner for smooth TTS speech output
  const cleanTextForSpeech = (text: string): string => {
    if (!text) return '';

    let cleaned = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/###/g, '')
      .replace(/\[/g, '')
      .replace(/\]/g, '')
      .replace(/\(/g, '')
      .replace(/\)/g, '')
      .replace(/#/g, '')
      .replace(/_/g, ' ')
      .trim();

    // Strip commas from numbers so TTS reads "1000" naturally
    cleaned = cleaned.replace(/(\d+),(\d+)/g, '$1$2');

    return cleaned;
  };

  // Female Voice Selector Fallback
  const selectBestFemaleVoice = (targetLang: 'ml' | 'en'): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const femaleKeywords = ['female', 'zira', 'swara', 'google', 'kalpana', 'heera', 'samantha', 'victoria', 'karen', 'geeta', 'veena'];

    if (targetLang === 'ml') {
      const mlFemale = voices.find((v) => {
        const l = v.lang.toLowerCase();
        const n = v.name.toLowerCase();
        return (l.includes('ml') || n.includes('malayalam')) && femaleKeywords.some((k) => n.includes(k));
      });
      if (mlFemale) return mlFemale;

      const mlAny = voices.find((v) => {
        const l = v.lang.toLowerCase();
        const n = v.name.toLowerCase();
        return l.includes('ml') || n.includes('malayalam');
      });
      if (mlAny) return mlAny;
    }

    if (targetLang === 'en') {
      const enFemale = voices.find((v) => {
        const l = v.lang.toLowerCase();
        const n = v.name.toLowerCase();
        return l.startsWith('en') && femaleKeywords.some((k) => n.includes(k));
      });
      if (enFemale) return enFemale;

      const enAny = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
      if (enAny) return enAny;
    }

    return voices[0] || null;
  };

  // 4. ASK KENBY MUTATION (WITH CONVERSATIONAL CONTEXT RECYCLING & KEPT OPEN)
  const askMutation = useMutation({
    mutationFn: async ({ qText, reqId }: { qText: string; isVoice: boolean; reqId: string }) => {
      const payloadContext = {
        year: selectedYear,
        month: selectedMonth,
        date: selectedDate,
        lastMetric,
        ...conversationContext,
      };

      const res = await api.post('/ai/owner-assistant/ask', {
        question: qText,
        context: payloadContext,
      });
      return { data: res.data, reqId };
    },
    onSuccess: ({ data, reqId }) => {
      const answerMl = sanitizeText(data?.answer?.ml);
      const answerEn = sanitizeText(data?.answer?.en);
      const resLang = data?.language || lang;
      const audioUrl = data?.audioUrl;

      // Update metric context & conversation context
      setLastMetric(data.metric);
      if (data?.context) {
        setConversationContext(data.context);
      }

      const kenbyMsgId = String(Date.now());
      const kenbyMsg: ChatMessage = {
        id: kenbyMsgId,
        requestId: reqId,
        sender: 'kenby',
        text: { ml: answerMl, en: answerEn },
        audioUrl: audioUrl || null,
        source: data?.source,
        evidence: data?.evidence,
        context: data.context,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatHistory((prev) => {
        if (reqId && prev.some((m) => m.requestId === reqId && m.sender === 'kenby')) {
          return prev;
        }
        return [...prev, kenbyMsg];
      });
      setVoiceState('IDLE');

      // CONTEXT-AWARE REPORT UPDATE WITHOUT CLOSING CHAT MODAL
      if (data?.context) {
        if (data.context.type === 'date' && data.context.date) {
          setSelectedDate(data.context.date);
          if (data.context.year) setSelectedYear(data.context.year);
          if (data.context.month) setSelectedMonth(data.context.month);
        } else if (data.context.type === 'month') {
          if (data.context.year) setSelectedYear(data.context.year);
          if (data.context.month) setSelectedMonth(data.context.month);
          setSelectedDate(null);
        }
      }

      // AUTOMATIC SPOKEN AUDIO RESPONSE (TTS PLAYBACK)
      const spokenText = resLang === 'ml' ? answerMl : answerEn;
      if (audioUrl) {
        handlePlayAudioBuffer(kenbyMsgId, audioUrl);
      } else if (spokenText) {
        handleSpeakMessageFallback(kenbyMsgId, spokenText, resLang);
      }
    },
    onError: () => {
      const errorMsg: ChatMessage = {
        id: String(Date.now()),
        sender: 'kenby',
        text: {
          ml: 'Kenby-മായി ബന്ധപ്പെടാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കൂ.',
          en: "Sorry, Kenby couldn't process that right now. Please try again.",
        },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, errorMsg]);
      setVoiceState('ERROR');
    },
  });

  // Guarded Question Submission Engine (Prevents Duplicate Submissions & Keeps Modal Open)
  const handleSendQuestion = (textToSend?: string, isVoice: boolean = false) => {
    const queryStr = textToSend || customQuestion || liveTranscript;
    if (!queryStr.trim()) return;

    // Ensure chat stays open
    setIsChatOpen(true);

    // Generate unique request ID to guard against duplicate submits
    const reqId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (submittedRequestIdRef.current === reqId) return;
    submittedRequestIdRef.current = reqId;

    // Stop active listening or speech if running
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { }
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      requestId: reqId,
      sender: 'user',
      text: { ml: queryStr, en: queryStr },
      isVoiceInput: isVoice,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setVoiceState('PROCESSING');
    askMutation.mutate({ qText: queryStr, isVoice, reqId });

    setCustomQuestion('');
    setLiveTranscript('');
  };

  // 5. HANDS-FREE REAL-TIME CONVERSATIONAL VOICE ASSISTANT ENGINE
  const handleStartVoiceMode = () => {
    setVoiceNotice(null);
    submittedRequestIdRef.current = null;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingMessageId(null);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceNotice(
        lang === 'ml'
          ? 'Voice input ഈ browser-ൽ ലഭ്യമല്ല. Text ഉപയോഗിച്ച് ചോദിക്കാം.'
          : 'Voice input is not supported in this browser. Please type your question.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang === 'ml' ? 'ml-IN' : 'en-IN';

      let lastCapturedText = '';

      recognition.onstart = () => {
        setVoiceState('LISTENING');
        setLiveTranscript('');
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }

        const trimmed = currentTranscript.trim();
        if (trimmed) {
          lastCapturedText = trimmed;
          setLiveTranscript(trimmed);

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

          silenceTimerRef.current = setTimeout(() => {
            if (lastCapturedText.trim() && !submittedRequestIdRef.current) {
              try { recognition.stop(); } catch (e) { }
              handleSendQuestion(lastCapturedText, true);
            }
          }, SILENCE_THRESHOLD_MS);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setVoiceNotice(
            lang === 'ml'
              ? 'Microphone permission ലഭ്യമല്ല. Permission അനുവദിക്കുക.'
              : 'Microphone permission is required for voice questions.'
          );
        } else if (event.error === 'no-speech') {
          setVoiceNotice(
            lang === 'ml' ? 'ശബ്ദം കണ്ടെത്താനായില്ല. വീണ്ടും ശ്രമിക്കൂ.' : 'No speech detected. Please try again.'
          );
        }
        setVoiceState('IDLE');
      };

      recognition.onend = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setVoiceNotice(
        lang === 'ml' ? 'Voice input ആരംഭിക്കാൻ കഴിഞ്ഞില്ല.' : 'Could not start voice recognition.'
      );
      setVoiceState('IDLE');
    }
  };

  const handleStopVoiceMode = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { }
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (liveTranscript.trim() && !submittedRequestIdRef.current) {
      handleSendQuestion(liveTranscript, true);
    } else if (!liveTranscript.trim()) {
      setVoiceState('IDLE');
    }
  };

  const handleCancelVoiceMode = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) { }
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setVoiceState('IDLE');
    setLiveTranscript('');
  };

  // 6. AUDIO PLAYBACK & REPLAY HANDLER
  const handlePlayAudioBuffer = (msgId: string, audioUrl: string) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (playingMessageId === msgId) {
      setPlayingMessageId(null);
      setVoiceState('IDLE');
      return;
    }

    try {
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.onplay = () => {
        setPlayingMessageId(msgId);
        setVoiceState('SPEAKING');
      };

      audio.onended = () => {
        setPlayingMessageId(null);
        setVoiceState('IDLE');
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingMessageId(null);
        setVoiceState('IDLE');
        currentAudioRef.current = null;
      };

      audio.play().catch((err) => {
        console.warn('Audio play failed:', err);
        setVoiceState('IDLE');
      });
    } catch (err) {
      setVoiceState('IDLE');
    }
  };

  const handleSpeakMessageFallback = (msgId: string, text: string, msgLang: 'ml' | 'en') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceState('IDLE');
      return;
    }

    window.speechSynthesis.cancel();

    const speechText = cleanTextForSpeech(text);
    if (!speechText) {
      setVoiceState('IDLE');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = msgLang === 'ml' ? 'ml-IN' : 'en-IN';
    utterance.rate = 0.92;
    utterance.pitch = 1.05;

    const femaleVoice = selectBestFemaleVoice(msgLang);
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onstart = () => {
      setPlayingMessageId(msgId);
      setVoiceState('SPEAKING');
    };

    utterance.onend = () => {
      setPlayingMessageId(null);
      setVoiceState('IDLE');
    };

    utterance.onerror = () => {
      setPlayingMessageId(null);
      setVoiceState('IDLE');
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleReplayClick = (msg: ChatMessage) => {
    if (msg.audioUrl) {
      handlePlayAudioBuffer(msg.id, msg.audioUrl);
    } else {
      const textToSpeak = msg.text[lang] || msg.text.ml;
      handleSpeakMessageFallback(msg.id, textToSpeak, lang);
    }
  };

  // 7. RESET TO CURRENT MONTH
  const handleResetToCurrentMonth = () => {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    setSelectedDate(null);
  };

  const isViewingCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth && !selectedDate;

  // Loading skeleton on initial load
  if (isLoading && !report) {
    return (
      <div className="space-y-8 pb-20 font-sans animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-slate-200 rounded-xl" />
            <div className="h-4 w-64 bg-slate-100 rounded-lg" />
          </div>
          <div className="h-10 w-36 bg-[#1A9A91]/20 rounded-2xl" />
        </div>
        <div className="h-48 bg-white border border-slate-100 rounded-3xl p-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-36 bg-white border border-slate-100 rounded-2xl p-5" />
          ))}
        </div>
      </div>
    );
  }

  if (isError && !report) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-6 font-sans">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            {lang === 'ml' ? 'Kenby AI ലഭ്യമല്ല.' : 'Kenby AI is currently unavailable.'}
          </h2>
          <p className="text-sm text-slate-500">
            {lang === 'ml' ? 'Kenby-യുമായി ബന്ധപ്പെടാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കൂ.' : 'Could not connect to Kenby. Please try again.'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#1A9A91]/20 transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          {lang === 'ml' ? 'വീണ്ടും ശ്രമിക്കുക' : 'Try Again'}
        </button>
      </div>
    );
  }

  const returnsCount = report?.cards?.returns?.cases || 0;
  const salesCount = report?.cards?.sales?.cases || 0;
  const hasHighReturns = returnsCount > salesCount && salesCount > 0;

  return (
    <div className="space-y-8 pb-20 font-sans">
      {/* ── 1. HEADER SECTION ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kenby AI</h1>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/60 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              ● Kenby AI ready
            </div>
          </div>
          <p className="text-slate-500 font-semibold text-sm mt-1">
            {lang === 'ml' ? 'നിങ്ങളുടെ ബിസിനസ് മനസ്സിലാക്കാൻ Kenby സഹായിക്കും' : 'Kenby helps you understand your business'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Ask Kenby Action Button */}
          <button
            onClick={() => setIsChatOpen(true)}
            className="px-5 py-3 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#1A9A91]/20 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>{lang === 'ml' ? '✨ AI-യോട് ചോദിക്കൂ' : '✨ Ask Kenby'}</span>
          </button>

          {/* Language Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setLang('ml')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === 'ml' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              മലയാളം
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. MONTHLY HISTORY SELECTOR TOOLBAR ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
            {lang === 'ml' ? 'റിപ്പോർട്ട് മാസം' : 'REPORT MONTH'}
          </span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {monthPills.map((pill) => {
              const isSelected = selectedYear === pill.year && selectedMonth === pill.month && !selectedDate;
              return (
                <button
                  key={`${pill.year}-${pill.month}`}
                  onClick={() => {
                    setSelectedYear(pill.year);
                    setSelectedMonth(pill.month);
                    setSelectedDate(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${isSelected
                    ? 'bg-[#1A9A91] text-white border-[#1A9A91] shadow-md shadow-[#1A9A91]/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                >
                  {lang === 'ml' ? pill.labelMl : pill.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* View Status Pill + Reset Control */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{report?.viewingLabel?.[lang]}</span>
          </div>

          {!isViewingCurrentMonth && (
            <button
              onClick={handleResetToCurrentMonth}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all border border-emerald-200/60 flex items-center gap-1.5 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>↻ {lang === 'ml' ? 'ഈ മാസം' : 'Current month'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 3. 5 MAIN BUSINESS SUMMARY NUMBERS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. SALES */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Sales</span>
              <span className="text-lg">📈</span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {report?.cards?.sales?.cases?.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1.5">cases</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {report?.cards?.sales?.transactionsCount} transaction
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/sales')}
            className="mt-5 text-xs font-bold text-[#1A9A91] hover:text-[#157C75] inline-flex items-center gap-1 transition-colors"
          >
            <span>{lang === 'ml' ? 'വിശദാംശങ്ങൾ' : 'View details'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. PRODUCTION */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Production</span>
              <span className="text-lg">🏭</span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {report?.cards?.production?.cases?.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1.5">cases</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {report?.cards?.production?.batchesCount} batch
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/overview')}
            className="mt-5 text-xs font-bold text-[#1A9A91] hover:text-[#157C75] inline-flex items-center gap-1 transition-colors"
          >
            <span>{lang === 'ml' ? 'വിശദാംശങ്ങൾ' : 'View details'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3. STOCK (CURRENT STOCK) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600">Stock</span>
              <span className="text-lg">📦</span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {report?.cards?.stock?.totalAvailableStock?.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1.5">cases</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">Current stock</p>
          </div>
          <button
            onClick={() => navigate('/admin/products')}
            className="mt-5 text-xs font-bold text-[#1A9A91] hover:text-[#157C75] inline-flex items-center gap-1 transition-colors"
          >
            <span>{lang === 'ml' ? 'വിശദാംശങ്ങൾ' : 'View details'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4. RETURNS (WITH SUBTLE WARNING STATE WHEN HIGH) */}
        <div className={`bg-white rounded-3xl p-5 border shadow-sm flex flex-col justify-between transition-all ${hasHighReturns ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100'
          }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-700">Returns</span>
              <span className="text-lg">↩</span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {report?.cards?.returns?.cases?.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1.5">cases</span>
            </div>
            {hasHighReturns ? (
              <div className="mt-2 p-2 bg-amber-100/70 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-900 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  {lang === 'ml'
                    ? 'Returns sales dispatch-നേക്കാൾ കൂടുതലായി രേഖപ്പെടുത്തിയിട്ടുണ്ട്. Return records പരിശോധിക്കുന്നത് നല്ലതാണ്.'
                    : 'Returns exceed period sales dispatches. Review return records.'}
                </span>
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-500 mt-1">Sales return</p>
            )}
          </div>
          <button
            onClick={() => navigate('/admin/sales')}
            className="mt-5 text-xs font-bold text-[#1A9A91] hover:text-[#157C75] inline-flex items-center gap-1 transition-colors"
          >
            <span>{lang === 'ml' ? 'വിശദാംശങ്ങൾ' : 'View details'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5. DAMAGE */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-rose-500">Damage</span>
              <span className="text-lg">⚠</span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {report?.cards?.damage?.cases?.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1.5">cases</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {report?.cards?.damage?.cases > 0 ? 'Damaged goods' : 'No damage'}
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/sales')}
            className="mt-5 text-xs font-bold text-[#1A9A91] hover:text-[#157C75] inline-flex items-center gap-1 transition-colors"
          >
            <span>{lang === 'ml' ? 'വിശദാംശങ്ങൾ' : 'View details'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 4. KENBY PROACTIVE INSIGHT SECTION (🧠 Kenby ശ്രദ്ധിച്ച കാര്യങ്ങൾ) ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5 text-[#1A9A91]">
            <span className="text-2xl">🧠</span>
            <h2 className="font-black tracking-tight text-xl text-slate-900">
              {lang === 'ml' ? 'Kenby ശ്രദ്ധിച്ച കാര്യങ്ങൾ' : 'Kenby Observations'}
            </h2>
          </div>

          <span className="text-xs font-black uppercase tracking-wider text-[#1A9A91] bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200/60">
            {report?.dateStr ? report.dateStr : `${report?.monthName} ${report?.year}`}
          </span>
        </div>

        {/* Compact Proactive Insight Cards List */}
        <div className="space-y-3">
          {snapshot?.insights && snapshot.insights.length > 0 ? (
            snapshot.insights.slice(0, 4).map((item: any, idx: number) => {
              const severity = item.severity || 'info';
              const isWarning = severity === 'warning' || severity === 'important' || severity === 'WARNING';
              const isImportant = severity === 'important';

              const icon = isImportant ? '⚠️' : isWarning ? '⚡' : '📌';

              const cardBg = isImportant
                ? 'bg-amber-50/70 border-amber-200/80'
                : isWarning
                  ? 'bg-slate-50 border-slate-200/70'
                  : 'bg-slate-50/70 border-slate-100';

              const badgeBg = isImportant
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : isWarning
                  ? 'bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-slate-200/80 text-slate-700 border-slate-300/60';

              const displayTitle = item.title?.[lang] || item.title?.ml || (isImportant ? 'ശ്രദ്ധിക്കുക' : 'വിവരം');
              const displayMessage = item.message?.[lang] || item.text?.[lang] || item.text?.ml;

              return (
                <div
                  key={item.id || idx}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cardBg}`}
                >
                  <div className="flex items-start gap-3.5">
                    <span className="text-xl mt-0.5 shrink-0">{icon}</span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{displayTitle}</span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${badgeBg}`}>
                          {severity}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                        {displayMessage}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      let qPrompt = displayMessage;
                      if (item.type === 'high_returns') {
                        qPrompt = lang === 'ml' ? 'ഈ returns-നെക്കുറിച്ച് കൂടുതൽ വിശദീകരിക്കൂ' : 'Explain more about these sales returns';
                      } else if (item.type === 'sales_increase' || item.type === 'sales_decrease') {
                        qPrompt = lang === 'ml' ? 'ഈ sales മാറ്റത്തെക്കുറിച്ച് വിശദീകരിക്കൂ' : 'Explain more about this sales change';
                      } else if (item.type === 'damage') {
                        qPrompt = lang === 'ml' ? 'ഈ damage-നെക്കുറിച്ച് വിശദീകരിക്കൂ' : 'Explain more about this damage';
                      }
                      handleSendQuestion(qPrompt, false);
                    }}
                    className="shrink-0 text-xs font-bold text-[#1A9A91] hover:text-[#157C75] bg-white border border-[#1A9A91]/30 hover:border-[#1A9A91] px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#1A9A91]" />
                    <span>{lang === 'ml' ? 'ചോദിക്കുക' : 'Ask about this'}</span>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-semibold text-slate-700">
              {lang === 'ml'
                ? 'ഈ മാസം പ്രത്യേകമായി ശ്രദ്ധിക്കേണ്ട മാറ്റങ്ങളൊന്നും കണ്ടെത്തിയിട്ടില്ല.'
                : 'No special changes requiring attention detected for this period.'}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── 5. MONTH COMPARISON SECTION ── */}
      {comparison && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#1A9A91]" />
              {lang === 'ml' ? 'മാസ അധിഷ്ഠിത കമ്പാരിസൺ' : 'Month Comparison'}
            </h2>
            <span className="text-xs font-bold text-slate-400">
              {comparison.currentPeriod.label} vs {comparison.previousPeriod.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sales Comparison */}
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Sales Change</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">
                    {comparison.salesChangeQuantity >= 0 ? `+${comparison.salesChangeQuantity}` : comparison.salesChangeQuantity} cases
                  </span>
                  {comparison.salesChangePercent !== null && (
                    <span className={`text-xs font-bold ${comparison.salesChangeQuantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ({comparison.salesChangeQuantity >= 0 ? '+' : ''}{comparison.salesChangePercent}%)
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  {lang === 'ml'
                    ? `${comparison.currentPeriod.label} sales ${comparison.previousPeriod.label}-നേക്കാൾ ${Math.abs(comparison.salesChangeQuantity)} cases ${comparison.salesChangeQuantity >= 0 ? 'കൂടുതലാണ്' : 'കുറവാണ്'}.`
                    : `Sales changed by ${comparison.salesChangeQuantity} cases compared to ${comparison.previousPeriod.label}.`}
                </p>
              </div>

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${comparison.salesChangeQuantity >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                {comparison.salesChangeQuantity >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
            </div>

            {/* Production Comparison */}
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Production Change</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">
                    {comparison.productionChangeQuantity >= 0 ? `+${comparison.productionChangeQuantity}` : comparison.productionChangeQuantity} cases
                  </span>
                  {comparison.productionChangePercent !== null && (
                    <span className={`text-xs font-bold ${comparison.productionChangeQuantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ({comparison.productionChangeQuantity >= 0 ? '+' : ''}{comparison.productionChangePercent}%)
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  {lang === 'ml'
                    ? `Production output compared to ${comparison.previousPeriod.label}`
                    : `Production output compared to ${comparison.previousPeriod.label}`}
                </p>
              </div>

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${comparison.productionChangeQuantity >= 0 ? 'bg-purple-100 text-purple-700' : 'bg-rose-100 text-rose-700'
                }`}>
                {comparison.productionChangeQuantity >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. ASK AI PROMPT BANNER ── */}
      <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#1A9A91]/20 text-[#1A9A91] rounded-2xl flex items-center justify-center shrink-0">
            <Bot className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black tracking-tight">
              {lang === 'ml' ? '🤖 Kenby-യോട് എന്തും ചോദിക്കാം' : '🤖 Ask Kenby Anything'}
            </h3>
            <p className="text-xs text-slate-300 font-semibold leading-relaxed">
              {lang === 'ml'
                ? 'സംസാരിക്കൂ, Kenby ഉടൻ മറുപടി നൽകും. Sales, Production, Stock, Returns എന്നിവയെക്കുറിച്ച് ചോദിക്കാം.'
                : 'Speak naturally to Kenby. Get instant answers about sales, production, stock, and returns.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsChatOpen(true)}
          className="px-6 py-3.5 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shrink-0 shadow-lg shadow-[#1A9A91]/20 transition-all active:scale-95"
        >
          <span>{lang === 'ml' ? '✨ AI-യോട് ചോദിക്കൂ' : '✨ Ask Kenby'}</span>
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>

      {/* ── 7. ASK KENBY CHAT MODAL (KEPT OPEN DURING REQUESTS) ── */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-2 sm:p-6 font-sans"
            onClick={() => {
              if (currentAudioRef.current) currentAudioRef.current.pause();
              if (playingMessageId) window.speechSynthesis?.cancel();
              setIsChatOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 15, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="relative w-full max-w-xl sm:max-w-2xl h-[88vh] max-h-[720px] rounded-[2rem] bg-slate-900 border border-slate-800 text-white shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/90 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1A9A91]/20 text-[#1A9A91] rounded-2xl flex items-center justify-center shadow-inner border border-[#1A9A91]/30">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg tracking-tight flex items-center gap-2">
                      🤖 Ask Kenby
                    </h3>
                    <p className="text-[11px] text-slate-400 font-semibold">
                      Real Business Intelligence Assistant
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-700/60">
                    <button
                      onClick={() => setLang('ml')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${lang === 'ml' ? 'bg-[#1A9A91] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      മലയാളം
                    </button>
                    <button
                      onClick={() => setLang('en')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${lang === 'en' ? 'bg-[#1A9A91] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      English
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (currentAudioRef.current) currentAudioRef.current.pause();
                      if (playingMessageId) window.speechSynthesis?.cancel();
                      setIsChatOpen(false);
                    }}
                    aria-label="Close Ask Kenby"
                    className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Chat Scroll Area */}
              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 custom-scrollbar"
              >
                {/* Welcome Card */}
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-[#1A9A91]">
                    <Sparkles className="w-5 h-5" />
                    <h4 className="font-black text-sm">
                      {lang === 'ml' ? '✨ നമസ്കാരം!' : '✨ Hello!'}
                    </h4>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 font-semibold leading-relaxed">
                    {lang === 'ml'
                      ? 'നിങ്ങളുടെ ബിസിനസിനെക്കുറിച്ച് എന്തും ചോദിക്കാം. Sales, Production, Stock, Returns എന്നിവയെക്കുറിച്ച് Kenby-യോട് ചോദിക്കൂ.'
                      : 'Ask Kenby anything about your business. You can ask about Sales, Production, Stock, and Returns.'}
                  </p>
                </div>

                {/* Suggested Question Chips */}
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {lang === 'ml' ? 'ചോദിക്കാവുന്ന കാര്യങ്ങൾ:' : 'Suggested questions:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'July 12 എത്ര sales നടന്നു?',
                      'July 12 sales എത്ര?',
                      'August-ൽ എത്ര production നടന്നു?',
                      'ഈ മാസം എത്ര return വന്നു?',
                      'ഇപ്പോഴത്തെ stock എത്രയാണ്?',
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendQuestion(preset, false)}
                        disabled={askMutation.isPending || voiceState === 'LISTENING'}
                        className="px-3.5 py-2 bg-slate-800/90 hover:bg-[#1A9A91]/20 hover:border-[#1A9A91]/50 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-200 transition-all text-left"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice Notice Fallback */}
                {voiceNotice && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-300 font-bold">
                    <span>{voiceNotice}</span>
                    <button
                      onClick={() => setVoiceNotice(null)}
                      className="text-amber-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Chat History Messages */}
                {chatHistory.map((msg) => {
                  const isUser = msg.sender === 'user';
                  const isPlayingThis = playingMessageId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 space-y-2.5 ${isUser
                          ? 'bg-[#1A9A91] text-white rounded-br-none font-semibold text-sm shadow-md'
                          : 'bg-gradient-to-r from-slate-950 to-slate-900 border border-[#1A9A91]/30 text-slate-100 rounded-bl-none text-sm shadow-md'
                          }`}
                      >
                        <p className="leading-relaxed flex items-center gap-2">
                          {isUser && msg.isVoiceInput && (
                            <Mic className="w-3.5 h-3.5 text-emerald-200 shrink-0 inline" />
                          )}
                          <span>{sanitizeText(msg.text[lang] || msg.text.ml)}</span>
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] opacity-80 gap-2">
                          {!isUser ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleReplayClick(msg)}
                                aria-label="Listen to Kenby response"
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${isPlayingThis
                                  ? 'bg-emerald-500 text-slate-950 animate-pulse'
                                  : 'bg-white/10 hover:bg-white/20 text-slate-200'
                                  }`}
                              >
                                {isPlayingThis ? (
                                  <>
                                    <Square className="w-3 h-3 fill-current" />
                                    <span> {lang === 'ml' ? 'നിർത്തുക' : 'Stop'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3.5 h-3.5" />
                                    <span> {lang === 'ml' ? 'കേൾക്കുക' : 'Replay'}</span>
                                  </>
                                )}
                              </button>

                              {msg.source === 'LIVE_ERP' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[9px] font-semibold">
                                  <span>⚡</span>
                                  <span>{lang === 'ml' ? 'തത്സമയ ERP ഡേറ്റ' : 'Live ERP Data'}</span>
                                </span>
                              )}
                              {msg.source === 'RAG' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[9px] font-semibold">
                                  <span>📚</span>
                                  <span>{lang === 'ml' ? 'ERP രേഖകൾ' : 'Documentation'}</span>
                                </span>
                              )}
                              {msg.source === 'HYBRID' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[9px] font-semibold">
                                  <span>⚡+📚</span>
                                  <span>{lang === 'ml' ? 'തത്സമയ ഡേറ്റ + രേഖകൾ' : 'Live Data + Docs'}</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span />
                          )}

                          <span className="font-mono">{msg.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* LIVE SPEECH TRANSCRIPTION IN CHAT (WHILE USER SPEAKS) */}
                {voiceState === 'LISTENING' && liveTranscript && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl p-4 bg-[#1A9A91]/70 text-white rounded-br-none font-semibold text-sm shadow-md border border-white/20 animate-pulse flex items-center gap-2">
                      <Mic className="w-4 h-4 animate-ping text-emerald-200 shrink-0" />
                      <p className="leading-relaxed">{liveTranscript}</p>
                    </div>
                  </div>
                )}

                {/* INLINE AI PROCESSING STATE INSIDE CHAT (KEEPS CHAT OPEN) */}
                {(voiceState === 'PROCESSING' || askMutation.isPending) && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/90 rounded-2xl p-4 flex items-center gap-3 border border-[#1A9A91]/30 shadow-md">
                      <Sparkles className="w-4 h-4 text-[#1A9A91] animate-spin" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {lang === 'ml' ? 'Kenby പരിശോധിക്കുന്നു...' : 'Kenby is checking...'}
                        </span>
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1A9A91] animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1A9A91] animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1A9A91] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* SPEAKING STATE INDICATOR */}
                {voiceState === 'SPEAKING' && (
                  <div className="flex justify-start">
                    <div className="bg-emerald-950/60 rounded-2xl px-4 py-2 flex items-center gap-2 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                      <Volume2 className="w-4 h-4 animate-bounce text-emerald-400" />
                      <span>{lang === 'ml' ? ' Kenby സംസാരിക്കുന്നു...' : ' Kenby is speaking...'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Composer Bar */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/95 shrink-0">
                {voiceState === 'LISTENING' ? (
                  <div className="flex items-center justify-between bg-slate-900 border border-[#1A9A91] rounded-2xl px-5 py-3.5 shadow-lg shadow-[#1A9A91]/10">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                        {lang === 'ml' ? '🔴 കേൾക്കുന്നു...' : '🔴 Listening...'}
                      </span>
                      <span className="flex gap-1 items-end h-4 ml-2">
                        <span className="w-1 bg-[#1A9A91] h-2 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 bg-[#1A9A91] h-4 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 bg-[#1A9A91] h-3 animate-bounce" style={{ animationDelay: '300ms' }} />
                        <span className="w-1 bg-[#1A9A91] h-4 animate-bounce" style={{ animationDelay: '100ms' }} />
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelVoiceMode}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                      >
                        {lang === 'ml' ? 'ഒഴിവാക്കുക' : 'Cancel'}
                      </button>
                      <button
                        onClick={handleStopVoiceMode}
                        className="px-4 py-1.5 rounded-xl bg-[#1A9A91] hover:bg-[#157C75] text-white text-xs font-bold transition shadow-sm"
                      >
                        {lang === 'ml' ? 'ചോദിക്കുക' : 'Submit Now'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendQuestion(undefined, false);
                    }}
                    className="flex items-center gap-3"
                  >
                    <button
                      type="button"
                      onClick={handleStartVoiceMode}
                      aria-label="Ask Kenby by voice"
                      disabled={askMutation.isPending}
                      className="p-3.5 bg-slate-800 hover:bg-[#1A9A91]/20 hover:text-[#1A9A91] border border-slate-700 rounded-2xl text-slate-300 transition-all shrink-0 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      title={lang === 'ml' ? 'സംസാരിക്കാൻ അമർത്തുക' : 'Click to speak'}
                    >
                      <Mic className="w-5 h-5 text-[#1A9A91]" />
                      <span className="text-xs font-bold hidden sm:inline text-slate-300">
                        {lang === 'ml' ? 'സംസാരിക്കാം' : 'Speak'}
                      </span>
                    </button>

                    <input
                      type="text"
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      placeholder={
                        lang === 'ml'
                          ? 'ചോദിക്കൂ... (ഉദാ: July 12 sales)'
                          : 'Type or speak your question (e.g. July 12 sales)...'
                      }
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#1A9A91] transition-all"
                    />

                    <button
                      type="submit"
                      disabled={!customQuestion.trim() || askMutation.isPending}
                      className="px-5 py-3.5 bg-[#1A9A91] hover:bg-[#157C75] disabled:bg-slate-800 disabled:text-slate-600 text-white font-black rounded-2xl transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-[#1A9A91]/20 active:scale-95"
                    >
                      <span>Send</span>
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
