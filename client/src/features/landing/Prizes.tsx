import { useRef, useState, useEffect } from 'react';
import { Trophy, FileText, Sparkles, Award } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import axios from 'axios';

gsap.registerPlugin(ScrollTrigger);

const defaultPrizeItems = [
  {
    title: '01 GIẢI NHẤT',
    amount: '7.000.000 đồng',
    benefits: 'Giấy chứng nhận + hoa',
  },
  {
    title: '01 GIẢI NHÌ',
    amount: '5.000.000 đồng',
    benefits: 'Giấy chứng nhận + hoa',
  },
  {
    title: '01 GIẢI BA',
    amount: '3.000.000 đồng',
    benefits: 'Giấy chứng nhận + hoa',
  },
  {
    title: '01 GIẢI KHUYẾN KHÍCH',
    amount: '1.500.000 đồng',
    benefits: 'Giấy chứng nhận',
  },
];

const defaultSpecialPrizes = [
  {
    title: 'HẠNG MỤC ĐẶC BIỆT',
    description: 'Vinh danh dành cho thí sinh đồng hành trọn vẹn 3 mùa giải (Fall 2025, Spring 2026, Summer 2026).',
  },
  {
    title: 'GIẤY CHỨNG NHẬN',
    description: 'Tất cả các thí sinh tham gia cuộc thi đều nhận giấy chứng nhận.',
  },
];

export default function Prizes() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeEvent, setActiveEvent] = useState<any>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/events");
        const allEvents = res.data;
        let filtered = allEvents.filter((e: any) => e.status === "registration" || e.status === "ongoing");
        if (filtered.length === 0) {
          filtered = allEvents.filter((e: any) => e.status === "prepare" || e.status === "completed");
        }
        const sorted = filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActiveEvent(sorted[0] || null);
      } catch (err) {
        console.error("Lỗi lấy thông tin cuộc thi tại Prizes:", err);
      }
    };
    fetchEvents();
  }, []);

  const prizesList = activeEvent?.prizes && activeEvent.prizes.length > 0
    ? activeEvent.prizes
    : defaultPrizeItems;

  const specialPrizesList = activeEvent?.specialPrizes && activeEvent.specialPrizes.length > 0
    ? activeEvent.specialPrizes
    : defaultSpecialPrizes;

  useGSAP(() => {
    gsap.fromTo(
      ".prize-header",
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".prize-header",
          start: "top 85%",
          toggleActions: "play none none reverse",
        }
      }
    );

    gsap.fromTo(
      ".prize-card-item",
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".prize-cards-grid",
          start: "top 80%",
          toggleActions: "play none none reverse",
        }
      }
    );
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="py-20 bg-slate-50 border-t border-slate-200/60" id="prizes">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="prize-header flex flex-col md:flex-row justify-between items-start md:items-end mb-14 gap-4 opacity-0">
          <div>
            <span className="font-mono text-xs text-primary uppercase font-bold tracking-wider py-1 ">
              CƠ CẤU GIẢI THƯỞNG
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              Giải Thưởng Cuộc Thi {activeEvent ? activeEvent.name : 'SEAL Hackathon'}
            </h2>
          </div>
        </div>

        {/* Minimalist Prize Grid */}
        <div className="prize-cards-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {prizesList.map((item: any, index: number) => {
            const isFirst = index === 0;
            return (
              <div
                key={index}
                className={`prize-card-item opacity-0 group relative bg-white rounded-2xl p-6 border transition-all duration-300 flex flex-col justify-between hover:-translate-y-1.5 ${isFirst
                  ? "border-primary/40 shadow-lg shadow-[#F27024]/10 hover:shadow-xl hover:shadow-[#F27024]/20 hover:border-primary"
                  : "border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300"
                  }`}
              >
                {/* Accent Top Bar */}
                <div
                  className={`absolute top-0 left-6 right-6 h-1 rounded-b-full transition-colors ${isFirst ? "bg-primary" : "bg-slate-200 group-hover:bg-primary/50"
                    }`}
                ></div>

                <div>
                  {/* Badge & Icon */}
                  <div className="flex items-center justify-between mb-5 pt-2">
                    <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-primary transition-colors">
                      #{String(index + 1).padStart(2, '0')}
                    </span>
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isFirst
                        ? "bg-primary/10 text-primary"
                        : "bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary"
                        }`}
                    >
                      {isFirst ? (
                        <Trophy size={20} className="text-primary" />
                      ) : (
                        <Award size={20} />
                      )}
                    </div>
                  </div>

                  {/* Title & Amount */}
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono mb-2">
                    {item.title}
                  </h3>
                  <div className="text-2xl xl:text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-primary transition-colors">
                    {item.amount}
                  </div>
                </div>

                {/* Benefits */}
                {item.benefits && (
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-medium text-slate-600">
                    <Sparkles size={14} className="text-primary shrink-0" />
                    <span>{item.benefits}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Special Categories Section */}
        {specialPrizesList && specialPrizesList.length > 0 && (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
            {specialPrizesList.map((special: any, idx: number) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-start gap-4 hover:border-slate-300 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                  {idx === 0 ? <Sparkles size={18} className="text-primary" /> : <FileText size={18} className="text-slate-600" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                    {special.title}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {special.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
