import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { SiTiktok, SiInstagram, SiWhatsapp } from "react-icons/si";
import {
  Mail,
  Phone,
  Share2,
  CheckSquare,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Trophy,
  Loader2,
  X,
  UserPlus,
  ChevronRight,
  Users,
  LayoutList,
  Home,
  Tag,
  Ticket,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

declare global {
  interface Window {
    PaystackPop: {
      setup(options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }): { openIframe(): void };
    };
  }
}

interface School {
  id: number;
  name: string;
  number: number;
  electionTitle: string | null;
  votingEndsAt: string | null;
}

interface CandidateResult {
  id: number;
  name: string;
  slogan: string | null;
  imageUrl: string | null;
  displayOrder: number;
  percentage: string;
  progress: number;
}

interface ElectionResults {
  school: School;
  candidates: CandidateResult[];
  totalVotes: number;
}

function useCountdown(endsAt: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    if (!endsAt) return;
    const compute = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      };
    };
    setTimeLeft(compute());
    const timer = setInterval(() => setTimeLeft(compute()), 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  return timeLeft;
}

export default function VotePage() {
  const { toast } = useToast();
  const [paystackKey, setPaystackKey] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number>(1);
  const [allCategoriesActive, setAllCategoriesActive] = useState(false);
  const [results, setResults] = useState<ElectionResults | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [voteTarget, setVoteTarget] = useState<{ id: number; name: string } | null>(null);
  const [email, setEmail] = useState("");
  const [isVoting, setIsVoting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeLeft = useCountdown(results?.school.votingEndsAt ?? null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d: { paystackPublicKey: string }) => setPaystackKey(d.paystackPublicKey))
      .catch(() => {});
    fetch("/api/schools")
      .then((r) => r.json())
      .then((d: School[]) => setSchools(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => { void fetchResults(selectedSchoolId); }, [selectedSchoolId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchResults = async (schoolId: number) => {
    setLoading(true);
    setFetchError(false);
    try {
      const r = await fetch(`/api/elections/${schoolId}/results`);
      if (!r.ok) throw new Error("Failed");
      setResults((await r.json()) as ElectionResults);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVoteClick = (id: number, name: string) => { setVoteTarget({ id, name }); setEmail(""); };

  const handlePayment = () => {
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Invalid email", description: "Please enter a valid email.", variant: "destructive" });
      return;
    }
    if (!paystackKey) {
      toast({ title: "Not ready", description: "Payment system loading, try again.", variant: "destructive" });
      return;
    }
    setIsVoting(true);
    const ref = `VOTE-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const popup = window.PaystackPop.setup({
      key: paystackKey, email: email.trim(), amount: 2000, currency: "KES", ref,
      callback: (response) => { void handleVoteSuccess(response.reference); },
      onClose: () => { setIsVoting(false); toast({ title: "Payment cancelled", description: "No charge was made." }); },
    });
    popup.openIframe();
  };

  const handleVoteSuccess = async (reference: string) => {
    if (!voteTarget) return;
    try {
      const r = await fetch("/api/votes/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: voteTarget.id, paystackReference: reference, email: email.trim() }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Vote recorded!", description: `Your vote for ${voteTarget.name} has been counted!`, className: "bg-[#22c55e] text-white border-none" });
      setVoteTarget(null);
      void fetchResults(selectedSchoolId);
    } catch (err) {
      toast({ title: "Error recording vote", description: err instanceof Error ? err.message : "Please contact support.", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    toast({ title: "Link copied", description: "Share link copied to clipboard." });
  };

  const filteredCandidates = results?.candidates.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);

  return (
    <div className="min-h-[100dvh] w-full bg-[#0d2b14] text-white font-sans">

      {/* ── Vote Modal ── */}
      <AnimatePresence>
        {voteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            onClick={(e) => { if (e.target === e.currentTarget && !isVoting) setVoteTarget(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#112e18] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[#1e4a28]"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Vote for {voteTarget.name}</h3>
                {!isVoting && (
                  <button onClick={() => setVoteTarget(null)} className="text-[#9ca3af] hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-[#9ca3af] text-sm mb-4 leading-relaxed">
                Enter your email to proceed. You'll be charged{" "}
                <span className="text-[#22c55e] font-bold">KES 20</span> per vote via Paystack.
              </p>
              <input
                type="email" placeholder="your@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={isVoting}
                onKeyDown={(e) => e.key === "Enter" && handlePayment()}
                className="w-full bg-[#163820] border border-[#254d30] text-white rounded-lg py-3 px-4 text-sm placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#22c55e] mb-4 disabled:opacity-50"
              />
              <button
                onClick={handlePayment} disabled={isVoting}
                className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {isVoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                {isVoting ? "Processing…" : "Proceed to Pay — KES 20"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-40 bg-[#0a2010] border-b border-[#1a3820]/60 shadow-lg">
        <div className="w-full px-4 h-[58px] flex items-center justify-between gap-4">

          {/* Logo */}
          <img
            src="/images/glowpolls-logo-nobg.png" alt="GlowPolls"
            className="h-11 w-auto object-contain shrink-0 select-none pointer-events-none"
            draggable={false}
          />

          {/* Right side: nav links + Register all in one group */}
          <div className="flex items-center gap-1">
            {/* Desktop nav links */}
            {[
              { label: "Home", emoji: "🏠" },
              { label: "Kitties", emoji: "🐱" },
              { label: "Voting", emoji: "🗳️" },
              { label: "Ticketing", emoji: "🎫" },
              { label: "Pricing", emoji: "🏷️" },
            ].map(({ label, emoji }) => (
              <a
                key={label} href="#"
                className="hidden md:flex items-center gap-1.5 text-[#d1d5db] hover:text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#163820] transition-colors whitespace-nowrap"
              >
                <span className="text-[15px] leading-none">{emoji}</span>
                {label}
              </a>
            ))}

            {/* Register button */}
            <a
              href="#"
              className="hidden md:flex items-center gap-2 bg-[#e8b400] hover:bg-[#d4a200] text-[#0a2010] font-bold text-sm px-5 py-2.5 rounded-full transition-colors whitespace-nowrap ml-2"
            >
              <UserPlus className="w-4 h-4" />
              Register →
            </a>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden bg-[#163820] p-2 rounded-lg text-white hover:bg-[#1e4a28] transition-colors"
            >
              {mobileMenuOpen
                ? <X className="w-5 h-5" />
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              }
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-[#1e4a28] bg-[#0a2010] overflow-hidden"
            >
              <div className="px-4 py-3 flex flex-col gap-1">
                {[
                  { label: "Home", emoji: "🏠" },
                  { label: "Kitties", emoji: "🐱" },
                  { label: "Voting", emoji: "🗳️" },
                  { label: "Ticketing", emoji: "🎫" },
                  { label: "Pricing", emoji: "🏷️" },
                ].map(({ label, emoji }) => (
                  <a
                    key={label} href="#" onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-[#d1d5db] text-sm font-medium px-3 py-3 rounded-lg hover:bg-[#163820] transition-colors"
                  >
                    <span className="text-base">{emoji}</span>
                    {label}
                  </a>
                ))}
                <a href="#" className="flex items-center justify-center gap-2 bg-[#e8b400] text-[#0a2010] font-bold text-sm px-4 py-2.5 rounded-full mt-2 transition-colors">
                  <UserPlus className="w-4 h-4" /> Register →
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ══════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════ */}
      <div className="w-full px-4 py-6 flex flex-col gap-6">

        {/* ── Hero / School Card ── */}
        <div className="bg-[#1a3c20] rounded-2xl p-5 md:p-6 shadow-xl border border-[#254d2a]">

          {/* Title — centered on mobile, left on desktop */}
          <h1 className="font-bold text-[20px] md:text-[22px] text-white leading-tight text-center md:text-left mb-4">
            {results?.school.name ?? "Tenri Schools Embu"}
          </h1>

          {/* Row: logo (+ desktop badges) on left, countdown on right */}
          <div className="flex items-center justify-between gap-3">

            {/* Logo + badges (badges hidden on mobile) */}
            <div className="flex items-center gap-4">
              <div className="w-[64px] h-[64px] md:w-[68px] md:h-[68px] bg-white rounded-xl flex-shrink-0 overflow-hidden p-1.5 shadow-md">
                <img
                  src="/images/tenri-logo-white.png" alt="Tenri Schools"
                  className="w-full h-full object-contain select-none pointer-events-none"
                  draggable={false}
                />
              </div>
              {/* Badges — desktop only */}
              <div className="hidden md:flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 bg-[#1e4228] border border-[#2d5a35] text-[#c8d5c0] text-xs font-semibold px-3 py-1.5 rounded-md">
                  <Users className="w-3.5 h-3.5 text-[#e8b400]" />
                  {results?.candidates.length ?? 4} Nominees
                </span>
                <span className="flex items-center gap-1.5 bg-[#1e4228] border border-[#2d5a35] text-[#c8d5c0] text-xs font-semibold px-3 py-1.5 rounded-md">
                  <LayoutList className="w-3.5 h-3.5 text-[#e8b400]" />
                  1 Categories
                </span>
              </div>
            </div>

            {/* Countdown */}
            <div className="bg-[#0d1f10] rounded-xl px-3 md:px-4 py-3 flex flex-col items-center gap-2 border border-[#1a3820] shrink-0">
              <div className="text-[9px] uppercase text-[#9ca3af] tracking-[0.15em] font-bold">
                Voting ends in
              </div>
              <div className="flex gap-1 md:gap-1.5">
                {[
                  { label: "DAYS", value: timeLeft.days.toString().padStart(2, "0") },
                  { label: "HRS",  value: timeLeft.hours.toString().padStart(2, "0") },
                  { label: "MIN",  value: timeLeft.minutes.toString().padStart(2, "0") },
                  { label: "SEC",  value: timeLeft.seconds.toString().padStart(2, "0") },
                ].map((item, i) => (
                  <div key={i} className="bg-[#111111] rounded-lg w-[40px] md:w-[44px] h-[50px] md:h-[52px] flex flex-col items-center justify-center shadow-inner">
                    <span className="text-[#f59e0b] font-bold text-[19px] md:text-[21px] leading-none tabular-nums">{item.value}</span>
                    <span className="text-[#6b7280] text-[7px] md:text-[8px] font-bold mt-1 tracking-wider">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Search + Filter ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-[#6b7280]" />
            </div>
            <input
              type="text"
              placeholder="Search by name, code, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0f2918] border border-[#1e4a28] text-white rounded-full py-3 pl-11 pr-4 text-sm placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/40 transition-all"
            />
          </div>

          <div className="relative sm:w-60" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown((v) => !v)}
              className="w-full bg-[#0f2918] border border-[#1e4a28] rounded-xl px-4 py-3 flex items-center justify-between hover:bg-[#163820] transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <SlidersHorizontal className="w-4 h-4 text-[#6b7280]" />
                {allCategoriesActive ? "All Categories" : (selectedSchool ? selectedSchool.name : "All Categories")}
              </div>
              <ChevronDown className={`w-4 h-4 text-[#6b7280] transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-[#0f2918] border border-[#1e4a28] rounded-2xl z-30 shadow-2xl overflow-hidden"
                >
                  <button
                    onClick={() => { setAllCategoriesActive(true); setShowDropdown(false); }}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#163820] transition-colors border-b border-[#1e4a28]"
                  >
                    <span className="text-white font-semibold text-sm">All Categories</span>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${allCategoriesActive ? "border-[#e53e3e] bg-[#e53e3e]" : "border-[#2d5a35]"}`}>
                      {allCategoriesActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                  {schools.map((school) => (
                    <button
                      key={school.id}
                      onClick={() => { setSelectedSchoolId(school.id); setAllCategoriesActive(false); setShowDropdown(false); }}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#163820] transition-colors border-b border-[#1e4a28] last:border-b-0"
                    >
                      <span className={`text-sm font-semibold text-left pr-4 ${selectedSchoolId === school.id ? "text-white" : "text-[#9ca3af]"}`}>
                        {school.name}
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${!allCategoriesActive && selectedSchoolId === school.id ? "border-[#e53e3e] bg-[#e53e3e]" : "border-[#2d5a35]"}`}>
                        {!allCategoriesActive && selectedSchoolId === school.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Election Section ── */}
        <div>
          {/* Header row */}
          <div className="flex items-start justify-between mb-2 gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <Trophy className="w-5 h-5 text-[#e8b400] fill-[#e8b400] shrink-0 mt-0.5" />
              <span className="font-bold text-sm tracking-wide text-white uppercase leading-snug">
                {results?.school.electionTitle ?? "TENRI SCHOOLS EMBU PRESIDENTIAL ELECTION 2026"}
              </span>
            </div>
            <span className="text-[#6b7280] text-xs font-medium whitespace-nowrap shrink-0 mt-0.5">
              {results?.candidates.length ?? 4} nominees
            </span>
          </div>
          {/* Yellow accent line */}
          <div className="h-px bg-[#e8b400]/70 mb-5" />

          {/* Candidates Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
              <p className="text-[#6b7280] text-sm">Loading candidates…</p>
            </div>
          ) : fetchError ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-14 px-6 gap-4 bg-[#1a3c20] border border-[#254d2a] rounded-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-[#0d1f10] border border-[#1e4228] flex items-center justify-center">
                <span className="text-3xl">🗳️</span>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg mb-1">Oops! Couldn't Load Results</p>
                <p className="text-[#6b7280] text-sm leading-relaxed max-w-xs">
                  We had trouble fetching the election results. Please check your connection and try again.
                </p>
              </div>
              <button
                onClick={() => void fetchResults(selectedSchoolId)}
                className="flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold px-5 py-2.5 rounded-full text-sm transition-colors"
              >
                <Loader2 className="w-3.5 h-3.5" />
                Retry
              </button>
            </motion.div>
          ) : filteredCandidates.length === 0 ? (
            <div className="text-center py-12 text-[#6b7280] text-sm">No candidates found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCandidates.map((candidate, index) => (
                <motion.div
                  key={candidate.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.07 }}
                  className="bg-[#1a3c20] rounded-2xl p-5 border border-[#254d2a] flex flex-col gap-3"
                >
                  {/* Photo + name/slogan */}
                  <div className="flex items-start gap-3 md:gap-4">
                    <img
                      src={candidate.imageUrl ?? "/images/allan.png"}
                      alt={candidate.name}
                      className="w-[76px] h-[76px] md:w-[90px] md:h-[90px] rounded-full object-cover border-[3px] border-[#22c55e] bg-[#163820] shrink-0"
                    />
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="font-bold text-[16px] md:text-[17px] text-white leading-tight">{candidate.name}</h3>
                      <p className="text-[#94a3b8] italic text-[13px] leading-snug mt-1">{candidate.slogan}</p>
                    </div>
                  </div>

                  {/* Percentage + bar */}
                  <div>
                    <span className="text-[#e8b400] font-bold text-[13px]">{candidate.percentage}%</span>
                    <div className="w-full bg-[#1a3820] rounded-full h-[5px] mt-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${candidate.progress}%` }}
                        transition={{ duration: 0.9, delay: 0.15 + index * 0.08 }}
                        className="h-full rounded-full bg-[#e8b400]"
                      />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 mt-1">
                    <button
                      onClick={() => handleVoteClick(candidate.id, candidate.name)}
                      className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                    >
                      <CheckSquare className="w-4 h-4" />
                      Vote
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex-1 bg-[#163820] hover:bg-[#1e4a28] text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm border border-[#254d30]"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          FOOTER  — light green gradient, dark text
      ══════════════════════════════════════════ */}
      <footer className="mt-6" style={{ background: "linear-gradient(160deg, #4a9e48 0%, #6ab856 40%, #88c870 100%)" }}>
        <div className="w-full px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

            {/* Brand column */}
            <div>
              <img
                src="/images/glowpolls-logo-nobg.png" alt="GlowPolls"
                className="h-16 w-auto object-contain select-none pointer-events-none mb-4"
                draggable={false}
              />
              <p className="text-[13px] text-[#0d2b0d] leading-relaxed max-w-xs">
                GrowPolls is your premier digital platform for polls, e-voting, and ticketing solutions.
                We empower event organizers and businesses with cutting-edge technology to engage audiences
                and streamline event management.
              </p>

              <div className="mt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0d2b0d] mb-3">Connect with us</h4>
                <div className="flex gap-2.5">
                  {[
                    { icon: SiTiktok, label: "TikTok" },
                    { icon: SiInstagram, label: "Instagram" },
                    { icon: SiWhatsapp, label: "WhatsApp" },
                    { icon: Mail, label: "Email" },
                    { icon: Phone, label: "Phone" },
                  ].map((s, i) => (
                    <button
                      key={i}
                      className="w-10 h-10 rounded-full bg-white text-[#0d2b14] flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
                      aria-label={s.label}
                    >
                      <s.icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-[#0d2b0d] mb-4">Quick Links</h4>
              <ul className="flex flex-col gap-2.5">
                {["Home", "Experiences", "Pricing", "Become Event Host"].map((link, i) => (
                  <li key={i}>
                    <a href="#" className="text-sm text-[#0d2b0d]/80 hover:text-[#0d2b0d] transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal & Policies */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-[#0d2b0d] mb-4">Legal &amp; Policies</h4>
              <ul className="flex flex-col gap-2.5">
                {["Terms of Use", "Privacy Policy"].map((link, i) => (
                  <li key={i}>
                    <a href="#" className="text-sm text-[#0d2b0d]/80 hover:text-[#0d2b0d] transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="h-px bg-[#0d2b0d]/20 my-7" />
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-[#0d2b0d]/70">
            <p>© 2026 GrowPolls. All rights reserved.</p>
            <p>Made with <span className="text-red-600">❤</span> by <strong>Scott</strong></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
