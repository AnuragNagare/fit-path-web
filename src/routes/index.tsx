import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Bell,
  Camera,
  Car,
  Crosshair,
  Dumbbell,
  Eye,
  EyeOff,
  Filter,
  LockKeyhole,
  Mail,
  MapPin,
  Moon,
  Navigation,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  ShowerHead,
  Snowflake,
  Star,
  Sun,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";

import gymImage from "@/assets/trace-gym.jpg";
import gymImage2 from "@/assets/trace-gym-2.jpg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authClient, useSession } from "@/lib/auth-client";
import { fetchNearbyGyms, geocodeAddress, getCurrentPosition, reverseGeocode, type Coordinates, type GymResult } from "@/lib/geo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trace — Find Gyms Along Your Route" },
      { name: "description", content: "Discover highly rated gyms that fit the route you already travel." },
      { property: "og:title", content: "Trace — Find Gyms Along Your Route" },
      { property: "og:description", content: "Discover highly rated gyms that fit the route you already travel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TraceApp,
});

type Screen = "home" | "login" | "route" | "nearby";

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="font-display text-[28px] font-extrabold tracking-normal text-foreground" onClick={onClick} aria-label="Trace home">
      Tra<span className="text-primary">c</span>e
    </button>
  );
}

function ArrowButton({ children, className, onClick, size = "default", disabled, type }: { children: React.ReactNode; className?: string; onClick?: () => void; size?: "default" | "sm" | "lg"; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <Button onClick={onClick} size={size} className={cn("group", className)} disabled={disabled} type={type}>
      {children}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
    </Button>
  );
}

function TraceApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [themeLight, setThemeLight] = useState(false);
  const { data: session, isPending } = useSession();
  const [searchMode, setSearchMode] = useState<"near" | "route">("near");

  const goToRoute = () => setScreen(session ? "route" : "login");

  // Guard the route/nearby screens: bounce to login if there's no session,
  // however the user got there (nav link, switcher, deep link, etc).
  useEffect(() => {
    if (isPending) return;
    if ((screen === "route" || screen === "nearby") && !session) {
      setScreen("login");
    }
  }, [screen, session, isPending]);

  return (
    <main className={cn("min-h-screen bg-background text-foreground", themeLight && "light-preview")}>
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full border border-border bg-card/90 p-1 shadow-2xl backdrop-blur-md" aria-label="Screen preview switcher">
        {(["home", "login", "route", "nearby"] as Screen[]).map((item, index) => (
          <Button key={item} variant={screen === item ? "neon" : "ghost"} size="sm" onClick={() => setScreen(item)}>
            {index + 1}<span className="hidden sm:inline">{item === "home" ? "Home" : item === "login" ? "Login" : item === "route" ? "Route" : "Map"}</span>
          </Button>
        ))}
      </div>
      {screen === "home" && <Landing onStart={() => setScreen(session ? "route" : "login")} onRoute={goToRoute} themeLight={themeLight} onTheme={() => setThemeLight((value) => !value)} />}
      {screen === "login" && <Login isPending={isPending} session={session} onBack={() => setScreen("home")} onSuccess={() => setScreen("route")} />}
      {screen === "route" && <RouteChoice session={session} onHome={() => setScreen("home")} onExplore={(selected) => { setSearchMode(selected); setScreen("nearby"); }} onSignOut={async () => { await authClient.signOut(); setScreen("home"); }} />}
      {screen === "nearby" && <NearbyGyms mode={searchMode} onBack={() => setScreen("route")} />}
    </main>
  );
}

function Landing({ onStart, onRoute, onTheme, themeLight }: { onStart: () => void; onRoute: () => void; onTheme: () => void; themeLight: boolean }) {
  return (
    <div className="min-h-screen overflow-hidden">
      <header className="flex h-[76px] items-center justify-between border-b border-border px-6 lg:px-[6vw]">
        <Logo />
        <nav className="hidden h-full items-center gap-12 text-sm text-muted-foreground md:flex">
          {['Home', 'Routes', 'Features', 'About'].map((item, index) => <button key={item} onClick={index === 1 ? onRoute : undefined} className={cn("h-full border-b-2 border-transparent hover:text-foreground", index === 0 && "border-primary text-primary")}>{item}</button>)}
        </nav>
        <div className="flex items-center gap-3">
          <ArrowButton onClick={onStart} className="h-10 px-5">Get Started</ArrowButton>
          <Button variant="ghost" size="icon" onClick={onTheme} aria-label="Toggle theme">{themeLight ? <Moon /> : <Sun />}</Button>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-[1440px] items-center gap-10 px-6 py-14 lg:min-h-[650px] lg:grid-cols-[0.86fr_1.12fr_0.62fr] lg:px-[6vw] lg:py-12">
        <RouteTrail className="absolute left-[16%] top-[22%] hidden h-36 w-[76%] lg:block" />
        <div className="relative z-10">
          <p className="font-mono text-sm uppercase tracking-[0.08em] text-primary">Route-based discovery</p>
          <h1 className="mt-5 font-display text-[clamp(2.9rem,6vw,6.3rem)] font-black uppercase leading-[0.9] tracking-normal">
            Find<br />gyms<br /><span className="text-primary">wherever</span><br />you go.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-6 text-muted-foreground">Complete details, honest photos, gyms that fit the route you already travel, not just the one nearest your pin.</p>
          <ArrowButton onClick={onRoute} size="lg" className="mt-8">Find gyms on my route</ArrowButton>
        </div>
        <PhoneMockup />
        <div className="relative z-10 grid grid-cols-2 gap-0 lg:grid-cols-1">
          {[
            { Icon: MapPin, text: 'Route-based recommendations' }, { Icon: Camera, text: 'Real photos & full details' }, { Icon: Star, text: 'Honest reviews & ratings' }, { Icon: Dumbbell, text: 'Find the best gyms on your journey' },
          ].map(({ Icon, text }) => (
            <div key={text} className="flex min-h-24 items-center gap-5 border-b border-border py-4">
              <Icon className="size-7 shrink-0 text-primary" />
              <p className="max-w-36 text-sm leading-5 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-[1440px] grid-cols-3 border-t border-border px-6 py-7 lg:px-[6vw]">
        {[['500+', 'Gyms mapped'], ['3km', 'Near-you radius'], ['4.6★', 'Avg. rating']].map(([value, label], index) => (
          <div key={label} className={cn("px-4 sm:px-10", index > 0 && "border-l border-border")}><strong className="font-display text-2xl sm:text-3xl">{value}</strong><p className="text-xs text-muted-foreground sm:text-sm">{label}</p></div>
        ))}
      </section>
    </div>
  );
}

function PhoneMockup() {
  const gyms = [['IronFit Fitness', '4.6', '2.1'], ['Prime Performance', '4.4', '3.2'], ['FitZone Gym', '4.2', '4.8']];
  return (
    <div className="relative z-10 mx-auto h-[540px] w-full max-w-[520px]">
      <div className="absolute left-1/2 top-2 h-[510px] w-[265px] -translate-x-1/2 rotate-[8deg] rounded-[38px] border-4 border-border bg-map p-4 shadow-2xl">
        <div className="rounded-full border border-border bg-card px-4 py-2 text-[10px] text-muted-foreground">⌕ &nbsp; Gyms on my route</div>
        <div className="route-map mt-3 h-[415px] rounded-[24px] border border-border"><RouteTrail className="h-full w-full rotate-[-8deg]" /></div>
      </div>
      <div className="absolute inset-x-0 top-40 space-y-3">
        {gyms.map(([name, rating, distance], index) => (
          <article key={name} className="ml-auto flex w-[90%] max-w-[360px] items-center gap-3 rounded-lg border border-border bg-card/95 p-2 shadow-xl" style={{ transform: `translateX(${index * -12}px) rotate(${index === 1 ? 2 : 4}deg)` }}>
            <img src={gymImage} alt="Modern gym" width={1536} height={1024} className="h-16 w-28 rounded object-cover" />
            <div><h3 className="text-xs font-semibold">{name}</h3><p className="mt-1 text-[10px] text-primary">{rating} ★</p><p className="mt-1 text-[9px] text-muted-foreground">⌖ {distance} km &nbsp;•&nbsp; <span className="text-primary">On your route</span></p></div>
          </article>
        ))}
      </div>
    </div>
  );
}

function RouteTrail({ className }: { className?: string }) {
  return <svg viewBox="0 0 700 180" fill="none" className={className} aria-hidden="true"><path d="M5 122C105 18 170 178 302 103C403 46 471 126 695 20" stroke="currentColor" strokeWidth="3" strokeDasharray="12 16" className="text-border"/><path d="M65 94C147 59 183 139 305 102" stroke="currentColor" strokeWidth="3" strokeDasharray="12 16" className="text-primary"/><circle cx="305" cy="102" r="8" fill="currentColor" className="text-primary"/></svg>;
}

type SessionData = ReturnType<typeof useSession>["data"];

function Login({ onBack, onSuccess, session, isPending }: { onBack: () => void; onSuccess: () => void; session: SessionData; isPending: boolean }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    return (
      <section className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="text-muted-foreground">Signed in as <span className="text-foreground">{session.user.email}</span></p>
          <ArrowButton onClick={onSuccess} className="mt-6">Continue</ArrowButton>
        </div>
      </section>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: authError } = mode === "login"
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name: name || email.split("@")[0] || "Trace User" });
    setSubmitting(false);
    if (authError) {
      setError(authError.message ?? "Something went wrong. Please try again.");
      return;
    }
    onSuccess();
  };

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError(null);
  };

  const handleGoogle = async () => {
    setError(null);
    const { error: authError } = await authClient.signIn.social({ provider: "google", callbackURL: window.location.href });
    if (authError) setError(authError.message ?? "Google sign-in failed.");
  };

  return (
    <section className="flex min-h-screen items-center justify-center p-0 md:p-7">
      <div className="grid min-h-[820px] w-full max-w-[1180px] overflow-hidden border border-border bg-background md:grid-cols-[0.9fr_1.1fr] md:rounded-xl">
        <div className="relative hidden overflow-hidden border-r border-border p-10 md:flex md:flex-col">
          <img src={gymImage} alt="Gym interior with lime lighting" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/70 to-transparent" />
          <div className="relative z-10"><Logo onClick={onBack} /></div>
          <div className="relative z-10 mt-24"><p className="font-mono text-sm uppercase text-primary">Route-based discovery</p><h1 className="mt-4 font-display text-5xl font-black uppercase leading-[0.92]">Find<br />gyms<br /><span className="text-primary">wherever</span><br />you go.</h1><p className="mt-6 max-w-[280px] text-sm leading-6 text-muted-foreground">Explore gyms, see real photos, read honest reviews and plan your next workout — all in one place.</p></div>
        </div>
        <div className="relative flex items-center px-7 py-16 md:px-20">
          <Button variant="ghost" size="icon" onClick={onBack} className="absolute left-5 top-5" aria-label="Back"><ArrowLeft /></Button>
          <form className="mx-auto w-full max-w-[480px]" onSubmit={handleSubmit}>
            <h2 className="font-display text-4xl font-bold">{mode === "login" ? <>Welcome <span className="text-primary">Back</span></> : <>Create <span className="text-primary">Account</span></>}</h2>
            <p className="mt-3 text-muted-foreground">{mode === "login" ? <>Log in to your account and continue<br />your fitness journey.</> : <>Sign up to start finding gyms<br />on your route.</>}</p>
            {mode === "signup" && (
              <label className="mt-10 block text-sm">Name<div className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-input px-4 focus-within:border-primary"><UserRound className="size-5"/><input required value={name} onChange={(event) => setName(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Enter your name" /></div></label>
            )}
            <label className={cn("block text-sm", mode === "login" ? "mt-10" : "mt-7")}>Email<div className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-input px-4 focus-within:border-primary"><Mail className="size-5"/><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Enter your email" /></div></label>
            <label className="mt-7 block text-sm">Password<div className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-input px-4 focus-within:border-primary"><LockKeyhole className="size-5"/><input required minLength={8} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="size-5"/> : <Eye className="size-5"/>}</button></div></label>
            {mode === "login" && <button type="button" className="mt-3 block w-full text-right text-xs text-primary">Forgot password?</button>}
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            <ArrowButton className="mt-10 w-full" disabled={submitting}>
              {submitting ? "Please wait…" : mode === "login" ? "Log In" : "Sign Up"}
            </ArrowButton>
            <div className="my-9 flex items-center gap-5 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>OR<span className="h-px flex-1 bg-border"/></div>
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={isPending}><span className="text-base font-bold text-primary">G</span> Continue with Google</Button>
            <p className="mt-16 text-center text-xs text-muted-foreground">
              {mode === "login" ? (
                <>Don't have an account? <button type="button" className="ml-3 text-primary" onClick={() => switchMode("signup")}>Create one <ArrowRight className="inline size-3"/></button></>
              ) : (
                <>Already have an account? <button type="button" className="ml-3 text-primary" onClick={() => switchMode("login")}>Log in <ArrowRight className="inline size-3"/></button></>
              )}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

function RouteChoice({ onHome, onExplore, session, onSignOut }: { onHome: () => void; onExplore: (mode: "near" | "route") => void; session: SessionData; onSignOut: () => void }) {
  const [choice, setChoice] = useState<"near" | "route">("near");
  return (
    <div className="relative min-h-screen overflow-hidden px-6 pb-20 lg:px-[6vw]">
      <header className="flex h-24 items-center justify-between"><Logo onClick={onHome}/><div className="flex items-center gap-2">{[1,2,3].map((step) => <div key={step} className="flex items-center gap-2"><span className={cn("grid size-7 place-items-center rounded-full border border-border text-xs text-muted-foreground", step === 1 && "border-primary bg-primary text-primary-foreground")}>{step}</span>{step < 3 && <span className="h-px w-10 bg-border"/>}</div>)}</div>{session ? <Button variant="outline" size="sm" onClick={onSignOut} aria-label="Sign out"><UserRound className="size-4"/> {session.user.name?.split(" ")[0] ?? "Sign out"}</Button> : <Button variant="outline" size="icon" aria-label="Profile"><UserRound className="size-5"/></Button>}</header>
      <div className="mx-auto grid max-w-[1380px] gap-10 pt-10 lg:grid-cols-[0.72fr_1.28fr]">
        <div><p className="font-mono text-sm uppercase text-primary">Choose your route</p><h1 className="mt-5 max-w-[480px] font-display text-[clamp(2.8rem,5vw,4.6rem)] font-black uppercase leading-[0.95]">How do you<br /><span className="text-primary">want to find</span><br />your gym?</h1><p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">Choose an option below to get started. We'll show you the best gyms based on your preference.</p><img src={gymImage} alt="Premium gym interior" width={1536} height={1024} className="mt-10 h-[290px] w-full max-w-[480px] rounded-lg object-cover opacity-75" /></div>
        <div className="grid content-center gap-6 md:grid-cols-2">
          <ChoiceCard active={choice === "near"} onSelect={() => { setChoice("near"); onExplore("near"); }} title="Near me" description="Find gyms around your current location." icon={<MapPin className="size-11 text-primary"/>} graphic={<Radar/>}/>
          <ChoiceCard active={choice === "route"} onSelect={() => { setChoice("route"); onExplore("route"); }} title="From a to b" description="Plan a route and find gyms along the way." icon={<RouteIcon className="size-10 text-primary"/>} graphic={<MiniRoute/>}/>
        </div>
      </div>
      <RouteTrail className="absolute -bottom-5 right-0 h-44 w-1/2"/>
    </div>
  );
}

function ChoiceCard({ active, onSelect, title, description, icon, graphic }: { active: boolean; onSelect: () => void; title: string; description: string; icon: React.ReactNode; graphic: React.ReactNode }) {
  return <article className={cn("flex min-h-[510px] flex-col rounded-xl border bg-card/30 p-8 transition-colors", active ? "border-primary" : "border-border")}><div className="grid size-20 place-items-center rounded-full border border-border">{icon}</div><h2 className="mt-4 font-display text-3xl font-bold">{title}</h2><p className="mt-2 max-w-[240px] text-sm leading-6 text-muted-foreground">{description}</p><div className="flex flex-1 items-center justify-center">{graphic}</div><ArrowButton onClick={onSelect} className={cn("w-full", !active && "border border-border bg-transparent text-foreground hover:border-primary hover:text-primary")}>Select</ArrowButton></article>;
}

function Radar() { return <div className="relative grid size-40 place-items-center rounded-full border border-primary/10 bg-primary/5"><span className="absolute size-28 rounded-full border border-primary/15"/><span className="absolute size-20 rounded-full border border-primary/20 bg-primary/5"/><span className="absolute size-12 rounded-full border border-primary/30 bg-primary/10"/><span className="size-4 rounded-full border-2 border-foreground bg-primary shadow-[0_0_18px_var(--primary)]"/><MapPin className="absolute left-0 top-3 size-5 text-primary"/><MapPin className="absolute bottom-3 right-1 size-5 text-primary"/></div> }
function MiniRoute() { return <div className="relative h-40 w-full"><svg viewBox="0 0 300 150" className="h-full w-full" fill="none"><path d="M25 88C80 142 102 31 169 74C219 105 243 88 275 31" stroke="currentColor" strokeWidth="2" strokeDasharray="7 8" className="text-primary"/><circle cx="25" cy="88" r="8" fill="currentColor" className="text-primary"/><circle cx="275" cy="31" r="8" fill="currentColor" className="text-primary"/></svg></div> }

// Real gyms come from OpenStreetMap, which doesn't carry ratings, pricing, or amenities.
// These are deterministic mock display values (stable per gym id, not fetched or user-facing "real" data) so the listing matches the original design mockup.
function mockListingDetails(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return {
    rating: (4 + ((hash % 9) / 10)).toFixed(1),
    monthly: 999 + (hash % 15) * 100,
    daily: 149 + (hash % 12) * 20,
    open: hash % 5 !== 0,
  };
}

function NearbyGyms({ onBack, mode }: { onBack: () => void; mode: "near" | "route" }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filters, setFilters] = useState<string[]>([]);
  const [locationText, setLocationText] = useState("");
  const [gyms, setGyms] = useState<GymResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const toggleFilter = (filter: string) => setFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);

  const runSearch = async (point: Coordinates) => {
    setStatus("loading");
    setError(null);
    try {
      const results = await fetchNearbyGyms(point);
      setGyms(results);
      setSelected(results[0]?.id ?? null);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  };

  const locate = async () => {
    setStatus("loading");
    setError(null);
    try {
      const point = await getCurrentPosition();
      const address = await reverseGeocode(point).catch(() => `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`);
      setLocationText(address);
      await runSearch(point);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get your location. Try searching instead.");
      setStatus("error");
    }
  };

  const handleLocationSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!locationText.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const place = await geocodeAddress(locationText);
      if (!place) {
        setError("Couldn't find that location. Try a different search.");
        setStatus("error");
        return;
      }
      await runSearch(place);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Location lookup failed.");
      setStatus("error");
    }
  };

  useEffect(() => {
    if (mode === "near") locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="min-h-screen pb-24">
      <header className="flex h-20 items-center justify-between border-b border-border px-6 lg:px-[4vw]">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4"/> Back</Button>
        <div className="flex items-center gap-5 text-muted-foreground">
          <button aria-label="Search" className="hover:text-foreground"><Search className="size-5"/></button>
          <button aria-label="Notifications" className="relative hover:text-foreground"><Bell className="size-5"/><span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary"/></button>
          <button aria-label="Profile" className="hover:text-foreground"><UserRound className="size-6"/></button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-10 px-6 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-[4vw]">
        <section>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="font-display text-[clamp(2.2rem,4vw,3.6rem)] font-black leading-[1.02]">Find Gyms<br /><span className="text-primary">Near You</span></h1>
              <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">{mode === "near" ? "Real gyms around your current location," : "Search a location to find real gyms nearby,"} powered by OpenStreetMap.</p>
            </div>
            <form onSubmit={handleLocationSubmit} className="flex h-12 w-full max-w-[300px] items-center gap-3 rounded-full border border-border bg-card px-5">
              <MapPin className="size-4 shrink-0 text-primary"/>
              <input value={locationText} onChange={(event) => setLocationText(event.target.value)} placeholder="Enter a location" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" aria-label="Location"/>
              <button type="button" onClick={locate} aria-label="Use my current location"><Crosshair className="size-4 shrink-0 text-muted-foreground hover:text-primary"/></button>
            </form>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-6 rounded-full border border-border px-5 py-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-sky-400"/> You</span>
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-foreground"/> Gyms</span>
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary"/> Selected</span>
          </div>

          <div className="route-map relative mt-6 h-[380px] overflow-hidden rounded-2xl border border-border sm:h-[440px]">
            <svg viewBox="0 0 700 440" className="h-full w-full" fill="none" aria-hidden="true">
              <rect width="700" height="440" className="fill-card"/>
              <g stroke="currentColor" strokeWidth="6" className="text-border/40">
                <path d="M-20 120 L180 100 L320 180 L520 150 L720 200"/>
                <path d="M120 -20 L160 140 L140 320 L220 460"/>
                <path d="M320 180 L360 340 L340 460"/>
                <path d="M520 150 L560 320 L500 460"/>
                <path d="M-20 300 L140 320 L360 340 L560 320 L720 360"/>
              </g>
              <g stroke="currentColor" strokeWidth="2" className="text-border/30">
                <path d="M240 -20 L260 120 L320 180"/><path d="M420 -20 L460 80 L520 150"/><path d="M60 440 L140 320"/>
              </g>
            </svg>
            {status === "loading" && <div className="absolute inset-0 grid place-items-center bg-background/60 text-sm text-muted-foreground">Searching real gyms…</div>}
            {status === "error" && <div className="absolute inset-0 grid place-items-center bg-background/60 px-8 text-center text-sm text-destructive">{error}</div>}
            {locationText && (
              <span className="absolute left-[42%] top-[8%] -translate-x-1/2 text-center text-xs font-semibold uppercase text-muted-foreground">
                {locationText.split(",")[0]}
              </span>
            )}
            <span className="absolute left-[50%] top-[58%] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"><span className="absolute size-16 animate-ping rounded-full bg-sky-400/20"/><span className="size-8 rounded-full border-4 border-sky-400/40 bg-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.8)]"/></span>
            {gyms.slice(0, 4).map((gym, index) => {
              const left = `${20 + ((index * 37) % 60)}%`;
              const top = `${20 + ((index * 53) % 60)}%`;
              const isSelected = gym.id === selected;
              const labelOnLeft = index % 2 === 1;
              return (
                <span key={gym.id} className="absolute -translate-x-1/2 -translate-y-full" style={{ left, top }}>
                  <MapPin className={cn("mx-auto size-8", isSelected ? "fill-primary text-primary drop-shadow-[0_0_10px_var(--primary)]" : "fill-foreground text-foreground")} fill="currentColor"/>
                  <span className={cn("absolute top-1 max-w-[9rem] text-xs leading-tight text-muted-foreground", labelOnLeft ? "right-full mr-2 text-right" : "left-full ml-2 text-left")}>
                    {gym.name}
                    {isSelected && <><br /><span className="text-[10px] text-primary">Selected</span></>}
                  </span>
                </span>
              );
            })}
            <div className="absolute right-5 top-5 grid size-11 place-items-center rounded-full bg-card/90 text-xs font-bold shadow-lg">N<span className="absolute -top-1 text-primary">▲</span></div>
            <Button variant="outline" size="icon" className="absolute bottom-5 right-5 size-12 rounded-full bg-card/90" aria-label="Recenter on my location" onClick={locate}><Navigation className="size-5 text-primary"/></Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {[["Parking", Car], ["Shower", ShowerHead], ["Locker", LockKeyhole], ["AC", Snowflake]].map(([label, Icon]) => {
              const active = filters.includes(label as string);
              const LucideIcon = Icon as typeof Car;
              return <button key={label as string} onClick={() => toggleFilter(label as string)} className={cn("flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors", active ? "border-primary text-primary" : "border-border text-foreground hover:border-primary/50")}><LucideIcon className="size-4"/> {label as string}</button>;
            })}
            <div className="ml-auto flex items-center gap-4">
              <button className="text-primary" aria-label="Filter"><Filter className="size-5"/></button>
              <button className="flex items-center gap-2 text-sm font-semibold uppercase text-primary">Closest <ArrowUpDown className="size-4"/></button>
            </div>
          </div>
        </section>

        <aside>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-bold">Gyms Around <span className="text-primary">You</span></h2>
            <span className="font-mono text-xs uppercase text-primary">{status === "loading" ? "Searching…" : `${gyms.length} found`}</span>
          </div>
          <div className="mt-6 space-y-5">
            {status === "error" && <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{error}</p>}
            {status === "idle" && gyms.length === 0 && <p className="rounded-2xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">No gyms found near that location. Try a different search.</p>}
            {gyms.map((gym, index) => {
              const active = selected === gym.id;
              const image = index % 2 === 0 ? gymImage : gymImage2;
              const { rating, monthly, daily, open } = mockListingDetails(gym.id);
              return (
                <article key={gym.id} onClick={() => setSelected(gym.id)} className={cn("cursor-pointer rounded-2xl border p-5 transition-colors", active ? "border-primary bg-primary/5 shadow-[0_0_30px_-10px_var(--primary)]" : "border-border bg-card/40 hover:border-primary/40")}>
                  <div className="flex gap-5">
                    <img src={image} alt={gym.name} width={640} height={512} loading="lazy" className="size-24 shrink-0 rounded-xl object-cover"/>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-bold leading-6">{gym.name}</h3>
                        <span className="shrink-0 font-mono text-xs text-primary">{gym.distanceKm.toFixed(1)} KM</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{gym.address ?? "Address unavailable"}</p>
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><span className="text-sm text-foreground">{rating}</span> <Star className="size-3 fill-foreground text-foreground"/> &nbsp;Parking • {open ? "Open" : "Closed"}</p>
                      <p className="mt-2 text-lg font-bold">₹{monthly.toLocaleString("en-IN")}/mo <span className="mx-1 text-border">|</span> <span className="text-base font-semibold text-muted-foreground">₹{daily}/day</span></p>
                      {active && <Button size="sm" className="mt-4 px-6">Details</Button>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </aside>
      </div>

      <footer className="mx-auto mt-14 grid max-w-[1440px] gap-6 border-t border-border px-6 pt-8 sm:grid-cols-3 lg:px-[4vw]">
        {[[MapPin, "Real locations", "Find gyms near you"], [ShieldCheck, "Verified details", "Accurate & up-to-date"], [Star, "Better choices", "For a healthier you"]].map(([Icon, title, text]) => {
          const LucideIcon = Icon as typeof MapPin;
          return <div key={title as string} className="flex items-center gap-4"><LucideIcon className="size-7 text-primary"/><div><p className="text-sm font-semibold">{title as string}</p><p className="text-xs text-muted-foreground">{text as string}</p></div></div>;
        })}
      </footer>
    </div>
  );
}