import { useRef, useState, useEffect } from 'react';
import { Cpu, Layers, Terminal } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import axios from 'axios';

gsap.registerPlugin(ScrollTrigger);

export default function About() {
  const containerRef = useRef<HTMLDivElement>(null);
  // @ts-ignore
  const [activeEvent, setActiveEvent] = useState<any>(null);
  // const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/events");
        const allEvents = res.data;
        // Prioritize registration or ongoing events
        let filtered = allEvents.filter((e: any) => e.status === "registration" || e.status === "ongoing");
        // Fallback to prepare or others if none of the above exist
        if (filtered.length === 0) {
          filtered = allEvents.filter((e: any) => e.status === "prepare" || e.status === "completed");
        }
        // Sort by newest
        const sorted = filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActiveEvent(sorted[0] || null);
      } catch (err) {
        console.error("Lỗi lấy thông tin cuộc thi tại About:", err);
      }
    };
    fetchEvents();

    /* const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer); */
  }, []);

  useGSAP(() => {
    // Header animation
    gsap.fromTo(
      ".about-header > *",
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        }
      }
    );

    // Cards animation
    gsap.fromTo(
      ".hackathon-card",
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.2,
        scrollTrigger: {
          trigger: ".hackathon-grid",
          start: "top 80%",
          toggleActions: "play none none reverse",
        }
      }
    );
  }, { scope: containerRef });

  /* const getCountdownText = () => {
    if (!activeEvent) return null;

    const now = currentTime.getTime();
    const status = activeEvent.status;
    const regOpen = activeEvent.registrationOpen ? new Date(activeEvent.registrationOpen).getTime() : null;
    const regClose = activeEvent.registrationClose ? new Date(activeEvent.registrationClose).getTime() : null;
    const contestStart = activeEvent.contestStart ? new Date(activeEvent.contestStart).getTime() : null;
    const contestEnd = activeEvent.contestEnd ? new Date(activeEvent.contestEnd).getTime() : null;

    // 1. Status: completed
    if (status === 'completed') {
      return {
        label: "Cuộc thi đã kết thúc thành công",
        timeText: null,
        colorClass: "text-emerald-600 bg-emerald-50 border-emerald-200 font-mono"
      };
    }

    // 2. Status: ongoing
    if (status === 'ongoing') {
      if (contestEnd && now < contestEnd) {
        return {
          label: "Cuộc thi đang diễn ra! Kết thúc sau:",
          timeText: formatRemainingTime(contestEnd - now),
          colorClass: "text-primary bg-primary/10 border-primary/20 font-mono"
        };
      } else {
        return {
          label: "Cuộc thi đang diễn ra",
          timeText: null,
          colorClass: "text-primary bg-primary/10 border-primary/20 font-mono"
        };
      }
    }

    // 3. Status: prepare
    if (status === 'prepare') {
      if (contestStart && now < contestStart) {
        return {
          label: "Cuộc thi sẽ bắt đầu sau:",
          timeText: formatRemainingTime(contestStart - now),
          colorClass: "text-primary bg-primary/10 border-primary/20 font-mono"
        };
      } else {
        return {
          label: "Đang chuẩn bị cuộc thi",
          timeText: null,
          colorClass: "text-primary bg-primary/10 border-primary/20 font-mono"
        };
      }
    }

    // 4. Status: registration
    if (status === 'registration') {
      if (regOpen && now < regOpen) {
        return {
          label: "Đăng ký đội thi sẽ mở sau:",
          timeText: formatRemainingTime(regOpen - now),
          colorClass: "text-amber-600 bg-amber-50 border-amber-200 font-mono"
        };
      }
      if (regClose && now < regClose) {
        return {
          label: "Đăng ký đội thi sẽ đóng sau:",
          timeText: formatRemainingTime(regClose - now),
          colorClass: "text-primary bg-primary/10 border-primary/20 font-mono"
        };
      }
    }

    // Default Fallback
    return {
      label: "Cổng đăng ký đội thi đã đóng",
      timeText: null,
      colorClass: "text-slate-500 bg-slate-100 border-slate-200 font-mono"
    };
  };

  const formatRemainingTime = (diff: number) => {
    if (diff <= 0) return "00:00:00";
    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const pad = (num: number) => num.toString().padStart(2, "0");

    if (days > 0) {
      return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }; */

  return (
    <section ref={containerRef} className="py-24 bg-white relative border-y border-slate-200" id="about">
      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_10%,rgba(242,112,36,0.03)_0%,transparent_50%)]"></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">

        {/* Header */}
        <div className="about-header max-w-3xl mb-16 space-y-4">
          <span className="font-mono text-xs text-primary uppercase tracking-widest block font-semibold">
            Tổng quan Hệ Thống
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 uppercase tracking-tight font-sans">
            Hệ thống Hackathon
          </h2>
        </div>

        {/* Hackathon Grid */}
        <div className="hackathon-grid grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

          {/* Card 1: SDLC & Professional Working */}
          <div className="hackathon-card border border-slate-200 p-8 flex flex-col bg-slate-50 rounded-none hover:border-primary/40 hover:shadow-md transition-all duration-350 opacity-0">
            <div className="w-12 h-12 rounded-none border border-primary/20 flex items-center justify-center mb-6 bg-primary/10 text-primary">
              <Terminal size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-3 font-sans">SDLC & Professional Working</h3>
            <p className="text-slate-600 text-sm leading-relaxed font-sans">
              Tập trung vào các chủ đề liên quan đến vòng đời phát triển phần mềm (SDLC) và kỹ năng làm việc chuyên nghiệp.
            </p>
          </div>

          {/* Card 2: Emerging Technologies */}
          <div className="hackathon-card border border-slate-200 p-8 flex flex-col bg-slate-50 rounded-none hover:border-primary/40 hover:shadow-md transition-all duration-350 opacity-0">
            <div className="w-12 h-12 rounded-none border border-primary/20 flex items-center justify-center mb-6 bg-primary/10 text-primary">
              <Cpu size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-3 font-sans">Emerging Technologies</h3>
            <p className="text-slate-600 text-sm leading-relaxed font-sans">
              Tập trung vào công nghệ mới và xu hướng AI, IoT, Blockchain cùng các hướng nghiên cứu hiện đại.
            </p>
          </div>

          {/* Card 3: Product & User Experience */}
          <div className="hackathon-card border border-slate-200 p-8 flex flex-col bg-slate-50 rounded-none hover:border-primary/40 hover:shadow-md transition-all duration-350 opacity-0">
            <div className="w-12 h-12 rounded-none border border-primary/20 flex items-center justify-center mb-6 bg-primary/10 text-primary">
              <Layers size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-3 font-sans">Product & User Experience</h3>
            <p className="text-slate-600 text-sm leading-relaxed font-sans">
              Tập trung vào phát triển sản phẩm hướng người dùng, trải nghiệm thực tế và thương mại hóa ý tưởng.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
