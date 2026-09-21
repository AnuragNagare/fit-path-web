import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Camera,
  Compass,
  Dumbbell,
  Eye,
  EyeOff,
  Funnel,
  Home,
  LockKeyhole,
  Mail,
  MapPin,
  Moon,
  Navigation,
  Pencil,
  Route as RouteIcon,
  Search,
  Star,
  Sun,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import gymImage from "@/assets/trace-gym.jpg";
import gymImage2 from "@/assets/trace-gym-2.jpg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

type Screen = "home" | "login" | "route" | "results";

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="font-display text-[28px] font-extrabold tracking-normal text-foreground" onClick={onClick} aria-label="Trace home">
      Tra<span className="text-primary">c</span>e
    </button>
  );
}

function ArrowButton({ children, className, onClick, size = "default" }: { children: React.ReactNode; className?: string; onClick?: () => void; size?: "default" | "sm" | "lg" }) {
  return (
    <Button onClick={onClick} size={size} className={cn("group", className)}>
      {children}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
    </Button>
  );
}

function TraceApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [themeLight, setThemeLight] = useState(false);
  return (
    <main className={cn("min-h-screen bg-background text-foreground", themeLight && "light-preview")}>
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full border border-border bg-card/90 p-1 shadow-2xl backdrop-blur-md" aria-label="Screen preview switcher">
        {(["home", "login", "route", "results"] as Screen[]).map((item, index) => (
          <Button key={item} variant={screen === item ? "neon" : "ghost"} size="sm" onClick={() => setScreen(item)}>
            {index + 1}<span className="hidden sm:inline">{item === "home" ? "Home" : item === "login" ? "Login" : item === "route" ? "Route" : "Results"}</span>
          </Button>
        ))}
      </div>
      {screen === "home" && <Landing onStart={() => setScreen("login")} onRoute={() => setScreen("route")} themeLight={themeLight} onTheme={() => setThemeLight((value) => !value)} />}
      {screen === "login" && <Login onBack={() => setScreen("home")} onSuccess={() => setScreen("route")} />}
      {screen === "route" && <RouteChoice onHome={() => setScreen("home")} onResults={() => setScreen("results")} />}
      {screen === "results" && <GymResults onBack={() => setScreen("route")} />}
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

function Login({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
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
          <form className="mx-auto w-full max-w-[480px]" onSubmit={(event) => { event.preventDefault(); onSuccess(); }}>
            <h2 className="font-display text-4xl font-bold">Welcome <span className="text-primary">Back</span></h2>
            <p className="mt-3 text-muted-foreground">Log in to your account and continue<br />your fitness journey.</p>
            <label className="mt-10 block text-sm">Email or Phone Number<div className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-input px-4 focus-within:border-primary"><Mail className="size-5"/><input required className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Enter your email or phone" /></div></label>
            <label className="mt-7 block text-sm">Password<div className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-input px-4 focus-within:border-primary"><LockKeyhole className="size-5"/><input required type={showPassword ? "text" : "password"} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="size-5"/> : <Eye className="size-5"/>}</button></div></label>
            <button type="button" className="mt-3 block w-full text-right text-xs text-primary">Forgot password?</button>
            <ArrowButton className="mt-10 w-full">Log In</ArrowButton>
            <div className="my-9 flex items-center gap-5 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>OR<span className="h-px flex-1 bg-border"/></div>
            <Button type="button" variant="outline" className="w-full"><span className="text-base font-bold text-primary">G</span> Continue with Google</Button>
            <p className="mt-16 text-center text-xs text-muted-foreground">Don't have an account? <button type="button" className="ml-3 text-primary">Create one <ArrowRight className="inline size-3"/></button></p>
          </form>
        </div>
      </div>
    </section>
  );
}

function RouteChoice({ onHome, onResults }: { onHome: () => void; onResults: () => void }) {
  const [choice, setChoice] = useState<"near" | "route">("near");
  return (
    <div className="relative min-h-screen overflow-hidden px-6 pb-20 lg:px-[6vw]">
      <header className="flex h-24 items-center justify-between"><Logo onClick={onHome}/><div className="flex items-center gap-2">{[1,2,3].map((step) => <div key={step} className="flex items-center gap-2"><span className={cn("grid size-7 place-items-center rounded-full border border-border text-xs text-muted-foreground", step === 1 && "border-primary bg-primary text-primary-foreground")}>{step}</span>{step < 3 && <span className="h-px w-10 bg-border"/>}</div>)}</div><Button variant="outline" size="icon" aria-label="Profile"><UserRound className="size-5"/></Button></header>
      <div className="mx-auto grid max-w-[1380px] gap-10 pt-10 lg:grid-cols-[0.72fr_1.28fr]">
        <div><p className="font-mono text-sm uppercase text-primary">Choose your route</p><h1 className="mt-5 max-w-[480px] font-display text-[clamp(2.8rem,5vw,4.6rem)] font-black uppercase leading-[0.95]">How do you<br /><span className="text-primary">want to find</span><br />your gym?</h1><p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">Choose an option below to get started. We'll show you the best gyms based on your preference.</p><img src={gymImage} alt="Premium gym interior" width={1536} height={1024} className="mt-10 h-[290px] w-full max-w-[480px] rounded-lg object-cover opacity-75" /></div>
        <div className="grid content-center gap-6 md:grid-cols-2">
          <ChoiceCard active={choice === "near"} onSelect={() => setChoice("near")} title="Near me" description="Find gyms around your current location." icon={<MapPin className="size-11 text-primary"/>} graphic={<Radar/>}/>
          <ChoiceCard active={choice === "route"} onSelect={() => setChoice("route")} title="From a to b" description="Plan a route and find gyms along the way." icon={<RouteIcon className="size-10 text-primary"/>} graphic={<MiniRoute/>}/>
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