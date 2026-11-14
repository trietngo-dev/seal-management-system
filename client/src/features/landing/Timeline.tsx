import { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import axios from 'axios';

gsap.registerPlugin(ScrollTrigger);

export default function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/events");
        const allEvents = res.data;

        // Prioritize registration or ongoing events
        let filtered = allEvents.filter((e: any) => e.status === "registration" || e.status === "ongoing");

        // Fallback to completed or prepare if none of the above exist
        if (filtered.length === 0) {
          filtered = allEvents.filter((e: any) => e.status === "completed" || e.status === "prepare");
        }

        // Sort by newest
        const sorted = filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const newest = sorted[0] || null;
        setActiveEvent(newest);
      } catch (err) {
        console.error("Lỗi lấy lịch trình cuộc thi:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);
  const getCurrentPhase = () => {
    if (!activeEvent) return 1;

    const now = new Date();
    const regOpen = activeEvent.registrationOpen ? new Date(activeEvent.registrationOpen) : null;
    const contestStart = activeEvent.contestStart ? new Date(activeEvent.contestStart) : null;
    const contestEnd = activeEvent.contestEnd ? new Date(activeEvent.contestEnd) : null;

    // 1. If not yet reached registrationOpen (or no regOpen set), default to Phase 1
    if (regOpen && now < regOpen) {
      return 1;
    }

    // 2. If after contestEnd, Phase 3 is active
    if (contestEnd && now >= contestEnd) {
      return 3;
    }

    // 3. If after contestStart but before contestEnd, Phase 2 is active
    if (contestStart && now >= contestStart) {
      return 2;
    }

    // 4. Otherwise (between regOpen and contestStart), Phase 1 is active
    return 1;
  };

  const currentPhase = getCurrentPhase();

  const getPhaseClasses = (phaseNum: number) => {
    const isActive = currentPhase === phaseNum;
    return {
      title: isActive
        ? "text-lg font-bold text-primary text-orange-glow font-sans transition-all duration-300"
        : "text-lg font-bold text-slate-400 font-sans transition-all duration-300",
      date: isActive
        ? "font-mono text-sm text-primary/85 font-bold mt-1.5 transition-all duration-300"
        : "font-mono text-sm text-slate-500 font-bold mt-1.5 transition-all duration-300",
      desc: isActive
        ? "text-slate-700 text-sm font-sans leading-relaxed transition-all duration-300"
        : "text-slate-400 text-sm font-sans leading-relaxed transition-all duration-300",
      node: isActive
        ? "timeline-node z-10 w-6 h-6 rounded-full bg-primary glow-orange ring-4 ring-white border-4 border-slate-50 shadow-[0_0_15px_#F27024] shrink-0 hidden md:block opacity-0"
        : "timeline-node z-10 w-6 h-6 rounded-full bg-slate-300 ring-4 ring-white border-4 border-slate-50 shrink-0 hidden md:block opacity-0"
    };
  };

  const getCustomTimelineClasses = () => {
    return {
      title: "text-lg font-bold text-slate-900 font-sans transition-all duration-300",
      date: "font-mono text-sm text-primary/85 font-bold mt-1.5 transition-all duration-300",
      desc: "text-slate-700 text-sm font-sans leading-relaxed transition-all duration-300",
      node: "timeline-node z-10 w-6 h-6 rounded-full bg-primary glow-orange ring-4 ring-white border-4 border-slate-50 shadow-[0_0_15px_#F27024] shrink-0 hidden md:block opacity-0"
    };
  };

  const formatDateString = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Chưa có thông báo";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Chưa có thông báo";

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  };

  const formatEventDateRange = (startDateStr: string | null | undefined, endDateStr: string | null | undefined) => {
    if (!startDateStr) return "Chưa có thông báo";
    const startStr = formatDateString(startDateStr);
    if (startStr === "Chưa có thông báo") return "Chưa có thông báo";

    if (!endDateStr) {
      return `Bắt đầu từ ${startStr}`;
    }

    const endStr = formatDateString(endDateStr);
    if (endStr === "Chưa có thông báo") {
      return `Bắt đầu từ ${startStr}`;
    }

    return `Từ ${startStr} đến ${endStr}`;
  };

  const formatSingleDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Chưa có thông báo";
    const dateStrFormatted = formatDateString(dateStr);
    if (dateStrFormatted === "Chưa có thông báo") return "Chưa có thông báo";
    return `Bắt đầu từ ${dateStrFormatted}`;
  };

  const phase1Date = formatEventDateRange(activeEvent?.registrationOpen, activeEvent?.registrationClose || activeEvent?.contestStart);
  const phase2Date = formatEventDateRange(activeEvent?.contestStart, activeEvent?.contestEnd);
  const phase3Date = formatSingleDate(activeEvent?.contestEnd);

  const hasCustomTimeline = activeEvent?.customTimeline && activeEvent.customTimeline.length > 0;

  useGSAP(() => {
    if (loading) return;

    // 1. Title and Subtitle animation
    gsap.fromTo(
      [".timeline-title", ".timeline-subtitle"],
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".timeline-header",
          start: "top 85%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // 2. Vertical Line scrub animation
    gsap.fromTo(
      ".timeline-line",
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".timeline-body",
          start: "top 75%",
          end: "bottom 75%",
          scrub: true,
        }
      }
    );

    // 3. Staggered reveal of each timeline phase row
    const rows = gsap.utils.toArray(".timeline-row") as HTMLElement[];
    rows.forEach((row) => {
      const left = row.querySelector(".timeline-left");
      const right = row.querySelector(".timeline-right");
      const node = row.querySelector(".timeline-node");

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: row,
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      });

      if (node) {
        tl.fromTo(
          node,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" }
        );
      }
      if (left) {
        tl.fromTo(
          left,
          { x: -30, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
          "-=0.3"
        );
      }
      if (right) {
        tl.fromTo(
          right,
          { x: 30, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
          "-=0.3"
        );
      }
    });

    ScrollTrigger.refresh();
  }, { dependencies: [loading, activeEvent], scope: containerRef });

  return (
    <section ref={containerRef} className="py-20" id="schedule">
      <div className="max-w-7xl mx-auto px-6">

        <div className="timeline-header text-center mb-16">
          <h2 className="timeline-title text-2xl sm:text-3xl font-extrabold text-slate-900 uppercase tracking-widest font-sans opacity-0">
            Lịch trình Cuộc thi {activeEvent ? `- ${activeEvent.name}` : ''}
          </h2>
          <p className="timeline-subtitle font-mono text-xs  text-primary font-semibold mt-2 opacity-0">
            CÁC GIAI ĐOẠN DIỄN RA CUỘC THI
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto py-6 timeline-body">
          {/* Vertical Line */}
          <div className="timeline-line absolute left-1/2 top-0 bottom-0 w-px bg-primary/30 -translate-x-1/2 hidden md:block origin-top"></div>

          <div className="space-y-16 relative">
            {hasCustomTimeline ? (
              activeEvent.customTimeline.map((item: any, idx: number) => {
                const classes = getCustomTimelineClasses();
                const isEven = idx % 2 === 0;

                return (
                  <div key={idx} className="flex flex-col md:flex-row items-center gap-6 relative timeline-row py-6">
                    {isEven ? (
                      <>
                        <div className="md:w-1/2 md:text-right w-full timeline-left opacity-0">
                          <h3 className={classes.title}>{item.title}</h3>
                          <p className={classes.date}>{item.time}</p>
                        </div>
                        <div className={classes.node}></div>
                        <div className="md:w-1/2 w-full timeline-right opacity-0">
                          {item.description ? (
                            <p className={classes.desc}>{item.description}</p>
                          ) : (
                            <div className="h-2"></div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="md:w-1/2 md:text-right w-full order-1 md:order-0 timeline-left opacity-0">
                          {item.description ? (
                            <p className={classes.desc}>{item.description}</p>
                          ) : (
                            <div className="h-2"></div>
                          )}
                        </div>
                        <div className={classes.node}></div>
                        <div className="md:w-1/2 w-full order-0 timeline-right opacity-0">
                          <h3 className={classes.title}>{item.title}</h3>
                          <p className={classes.date}>{item.time}</p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              <>
                {/* Phase 1 */}
                <div className="flex flex-col md:flex-row items-center gap-6 relative timeline-row py-6">
                  <div className="md:w-1/2 md:text-right w-full timeline-left opacity-0">
                    <h3 className={getPhaseClasses(1).title}>Mở đăng ký</h3>
                    {phase1Date !== "Chưa có thông báo" && (
                      <p className={getPhaseClasses(1).date}>
                        {phase1Date}
                      </p>
                    )}
                  </div>
                  <div className={getPhaseClasses(1).node}></div>
                  <div className="md:w-1/2 w-full timeline-right opacity-0">
                    <p className={getPhaseClasses(1).desc}>
                      {activeEvent?.phase1Description || "Các đội thi thực hiện đăng ký tài khoản, liên kết thành viên nhóm và liên kết repository Github chính thức để chuẩn bị nhận nhiệm vụ."}
                    </p>
                  </div>
                </div>

                {/* Phase 2 */}
                <div className="flex flex-col md:flex-row items-center gap-6 relative timeline-row py-6">
                  <div className="md:w-1/2 md:text-right w-full order-1 md:order-0 timeline-left opacity-0">
                    <p className={getPhaseClasses(2).desc}>
                      {activeEvent?.phase2Description || "Giai đoạn lập trình cường độ cao. Các đội thực hiện giải quyết yêu cầu dự án, liên tục push commit để AI tự động phân tích và đánh giá chất lượng mã nguồn."}
                    </p>
                  </div>
                  <div className={getPhaseClasses(2).node}></div>
                  <div className="md:w-1/2 w-full order-0 timeline-right opacity-0">
                    <h3 className={getPhaseClasses(2).title}>Bắt đầu thi đấu</h3>
                    {phase2Date !== "Chưa có thông báo" && (
                      <p className={getPhaseClasses(2).date}>
                        {phase2Date}
                      </p>
                    )}
                  </div>
                </div>

                {/* Phase 3 */}
                <div className="flex flex-col md:flex-row items-center gap-6 relative timeline-row py-6">
                  <div className="md:w-1/2 md:text-right w-full timeline-left opacity-0">
                    <h3 className={getPhaseClasses(3).title}>Kết thúc và tổng kết</h3>
                    {phase3Date !== "Chưa có thông báo" && (
                      <p className={getPhaseClasses(3).date}>
                        {phase3Date}
                      </p>
                    )}
                  </div>
                  <div className={getPhaseClasses(3).node}></div>
                  <div className="md:w-1/2 w-full timeline-right opacity-0">
                    <p className={getPhaseClasses(3).desc}>
                      {activeEvent?.phase3Description || "Dừng cổng nộp bài, đóng repository. Các đội thi chuẩn bị báo cáo dự án trước hội đồng giám khảo và nhận kết quả xếp hạng chung cuộc từ hệ thống."}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
