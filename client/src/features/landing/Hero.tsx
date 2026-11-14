import { Link } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  CalendarDays,
  UserPlus,
  Images,
  LogIn,
  ArrowRight,
} from "lucide-react";

interface HeroProps {
  user: any;
}

export default function Hero({ user }: HeroProps) {
  const isSystemAdmin = user?.isSystemAdmin;
  const isCoordinator = !!isSystemAdmin;
  const dashboardLink = user
    ? isSystemAdmin || isCoordinator
      ? "/admin"
      : "/team-area"
    : "/login";

  const containerRef = useRef<HTMLDivElement>(null);

  // Parallax mouse interaction values using Framer Motion springs
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 100 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Parallax transforms (Hero text: max 4px)
  const textX = useTransform(smoothX, [-1, 1], [-4, 4]);
  const textY = useTransform(smoothY, [-1, 1], [-4, 4]);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        "ontouchstart" in window || navigator.maxTouchPoints > 0,
      );
    };
    checkTouch();

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);

    const handleMouseMove = (e: MouseEvent) => {
      if (isTouchDevice || prefersReducedMotion) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set((clientX / innerWidth) * 2 - 1);
      mouseY.set((clientY / innerHeight) * 2 - 1);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      mediaQuery.removeEventListener("change", listener);
    };
  }, [isTouchDevice, prefersReducedMotion]);

  // Framer Motion entrance animation sequence
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.12,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.85,
        ease: [0.215, 0.61, 0.355, 1.0] as any, // Apple easing
      },
    },
  };

  const handleScrollToSchedule = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById("schedule");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      window.history.pushState(null, "", "#schedule");
    }
  };

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen bg-canvas text-ink flex flex-col font-sans overflow-hidden"
    >
      {/* 1. Subtle Technical Grid Background (Warm Mode) */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(233,231,228,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(233,231,228,0.4) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />

      {/* Decorative background radial glows for depth */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-linear-to-br from-primary/5 to-transparent blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[600px] h-[600px] rounded-full bg-linear-to-tr from-indigo-500/3 to-transparent blur-[140px] pointer-events-none z-0" />

      {/* 2. Transparent Navbar over Warm Background */}
      <header className="relative z-30 w-full px-6 md:px-10 py-5 bg-transparent">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo brand - Strict FPT identity */}
          <Link
            to="/"
            className="flex items-center group select-none rounded-xl bg-white/90 px-3 py-1.5 shadow-xs"
          >
            <img
              src="/seal_hackathon_logo.png"
              alt="SEAL Hackathon - Software Engineering Agile League"
              className="h-8 sm:h-9 w-auto object-contain"
              draggable={false}
            />
          </Link>

          {/* Center Links with hover underlines */}
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="#schedule"
              onClick={handleScrollToSchedule}
              className="group relative flex items-center gap-2 font-sans text-sm font-medium text-ink-muted hover:text-ink transition-colors duration-250"
            >
              <CalendarDays
                size={15}
                className="group-hover:text-primary transition-colors duration-250"
              />
              <span>Xem lịch trình</span>
              <span className="absolute bottom-[-4px] left-0 w-0 h-[1.5px] bg-primary transition-all duration-300 group-hover:w-full" />
            </a>

            <Link
              to={user ? "/team-area" : "/login?redirect=/team-area"}
              className="group relative flex items-center gap-2 font-sans text-sm font-medium text-ink-muted hover:text-ink transition-colors duration-250"
            >
              <UserPlus
                size={15}
                className="group-hover:text-primary transition-colors duration-250"
              />
              <span>Đăng ký thi</span>
              <span className="absolute bottom-[-4px] left-0 w-0 h-[1.5px] bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>

            <Link
              to="/album"
              className="group relative flex items-center gap-2 font-sans text-sm font-medium text-ink-muted hover:text-ink transition-colors duration-250"
            >
              <Images
                size={15}
                className="group-hover:text-primary transition-colors duration-250"
              />
              <span>Album ảnh</span>
              <span className="absolute bottom-[-4px] left-0 w-0 h-[1.5px] bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          </nav>

          {/* Right Action Button - FPT Orange style */}
          <Link
            to={user ? dashboardLink : "/login"}
            className="rounded-full px-5 py-2 flex items-center gap-2 font-sans font-bold uppercase tracking-wider text-[14px] text-primary border border-primary/40 bg-transparent hover:bg-primary-soft hover:border-primary hover:shadow-[0_4px_20px_rgba(242,112,36,0.08)] transition-all duration-300 active:scale-[0.97]"
          >
            <LogIn size={13} />
            <span>{user ? "Dashboard" : "Đăng nhập"}</span>
          </Link>
        </div>
      </header>

      {/* 3. Hero content and Shield showcase in 2-column layout */}
      <main className="relative z-20 flex-1 max-w-7xl mx-auto w-full px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-10">
        {/* Left Column: Event Content (~47% width) */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            x: isTouchDevice || prefersReducedMotion ? 0 : textX,
            y: isTouchDevice || prefersReducedMotion ? 0 : textY,
          }}
          className="w-full md:w-[47%] text-left space-y-6 select-text"
        >
          {/* Top Event Badge - Glassmorphic design */}
          <motion.div variants={itemVariants}>
            <div className="rounded-full px-4 py-2 inline-flex items-center gap-2 border border-line bg-white/70 backdrop-blur-xs shadow-[0_4px_20px_rgba(30,30,36,0.02)]">
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_rgba(242,112,36,0.5)]"
              />
              <span className="font-mono text-[0.7rem] tracking-[0.22em] font-semibold uppercase text-ink-muted">
                SEAL HACKATHON 2026
              </span>
            </div>
          </motion.div>

          {/* Headline - Strict Archivo Black Editorial Style */}
          <motion.h1
            variants={itemVariants}
            className="font-display font-black text-ink tracking-[-0.035em] leading-[0.92]"
            style={{
              fontSize: "clamp(2.9rem, 8vw, 5.4rem)",
            }}
          >
            <span className="block text-ink">Lập Trình</span>
            <span className="block italic text-primary pb-2">
              Tương Lai.
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="font-sans text-[16px] leading-[1.65] text-ink-muted font-medium"
            style={{ maxWidth: "32rem" }}
          >
            Sân chơi học thuật và trải nghiệm công nghệ dành cho sinh viên ngành
            Công nghệ thông tin tại Trường Đại học FPT cơ sở TP.HCM và các
            trường đại học khác trên địa bàn Thành phố Hồ Chí Minh.
          </motion.p>

          {/* Actions */}
          <motion.div
            variants={itemVariants}
            className="pt-6 flex flex-col sm:flex-row gap-4"
          >
            <Link
              to={dashboardLink}
              className="group px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-sans font-bold uppercase tracking-wider text-[14px] text-center shadow-lg shadow-orange-500/25 hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-2"
            >
              <span>THAM GIA NGAY</span>
              <ArrowRight
                size={14}
                className="transform transition-transform duration-250 group-hover:translate-x-1"
              />
            </Link>

            <a
              href="#schedule"
              onClick={handleScrollToSchedule}
              className="px-6 py-3 bg-white/60 backdrop-blur-xs hover:bg-secondary-soft text-secondary hover:text-secondary-hover rounded-xl font-sans font-bold uppercase tracking-wider text-[14px] text-center border border-secondary/30 hover:border-secondary transition-all duration-300 flex items-center justify-center gap-2 shadow-xs"
            >
              <CalendarDays size={14} />
              <span>XEM LỊCH TRÌNH</span>
            </a>
          </motion.div>
        </motion.div>

        {/* Right Column: Premium SEAL Shield Showcase (~53% width on desktop) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, x: 30 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{
            duration: 1.2,
            delay: 0.5,
            ease: [0.215, 0.61, 0.355, 1.0],
          }}
          className="w-full md:w-[53%] flex items-center justify-center relative min-h-[340px] md:min-h-[480px] lg:min-h-[580px] z-10"
        >
          {/* Floating Transparent Wrapper for Video */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-80 h-80 sm:w-[420px] sm:h-[420px] md:w-[500px] md:h-[500px] lg:w-[540px] lg:h-[540px] flex items-center justify-center overflow-hidden select-none pointer-events-none"
          >
            {/* Soft radial glow behind shield inside the card */}
            <div className="absolute inset-0 z-0 pointer-events-none rounded-full blur-[80px] opacity-25 bg-[radial-gradient(circle_at_50%_50%,rgba(242,106,33,0.2)_0%,transparent_60%)]" />

            {/* SEAL Shield Badge (transparent PNG with CSS drop shadow) */}
            <img
              src="/seal_shield_badge.png"
              alt="SEAL Shield"
              draggable={false}
              style={{
                filter: "drop-shadow(0px 16px 36px rgba(0, 0, 0, 0.09))",
              }}
              className="relative w-full h-full object-contain z-10"
            />
          </motion.div>
        </motion.div>
      </main>

      {/* 4. Bottom Center Scroll Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
        <span className="font-mono text-[0.7rem] tracking-[0.22em] font-semibold uppercase text-ink-muted">
          CUỘN ĐỂ XEM CHI TIẾT
        </span>
        <div className="w-px h-8 bg-line relative overflow-hidden">
          <motion.div
            animate={{
              y: ["-100%", "100%"],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-0 left-0 w-full h-1/2 bg-primary"
          />
        </div>
      </div>
    </section>
  );
}
