import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { X, Eye, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";

interface Category {
  id: string;
  name: string;
  count: number;
}

interface Photo {
  id: string;
  name: string;
  size: string;
  category: string;
  url: string;
}

interface GalleryProps {
  user?: any;
  roles?: any[];
}

function useColumnsCount() {
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setColumns(1);
      } else if (width < 768) {
        setColumns(2);
      } else if (width < 1024) {
        setColumns(3);
      } else {
        setColumns(4);
      }
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  return columns;
}

export default function Gallery({ user, roles }: GalleryProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(16);

  const isSystemAdmin = user?.isSystemAdmin;
  const isCoordinator = !!isSystemAdmin || roles?.some((r) => r.role === "admin_view");

  const loadGalleryData = (showToast = false) => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    if (showToast) {
      setSyncing(true);
      toast.loading("Đang đồng bộ: Đang chuẩn bị...", { id: "gallery-sync" });

      const eventSource = new EventSource(`${apiBase}/api/gallery/sync-progress`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.status === 'fetching') {
            toast.loading("Đang đồng bộ: Đang quét danh sách ảnh trên Drive...", { id: "gallery-sync" });
          } else if (data.status === 'syncing') {
            toast.loading(`Đang đồng bộ: Tải ảnh (${data.percent}%) [${data.current}/${data.total}]`, { id: "gallery-sync" });
          } else if (data.success) {
            toast.success(data.message || "Đồng bộ thành công!", { id: "gallery-sync" });
            eventSource.close();
            setSyncing(false);
            loadGalleryData(false); // Reload items from database
          } else {
            toast.error(data.message || "Đồng bộ thất bại.", { id: "gallery-sync" });
            eventSource.close();
            setSyncing(false);
          }
        } catch (err) {
          console.error("Failed to parse sync progress event:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        toast.error("Lỗi kết nối thời gian thực khi đồng bộ.", { id: "gallery-sync" });
        eventSource.close();
        setSyncing(false);
      };
    } else {
      setLoading(true);
      axios
        .get(`${apiBase}/api/gallery`)
        .then((res) => {
          setCategories(res.data.categories || []);
          setPhotos(res.data.photos || []);
        })
        .catch((err) => {
          console.error("Failed to load photo album:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    loadGalleryData(false);
  }, []);

  useEffect(() => {
    setVisibleCount(16);
  }, [selectedCatId]);

  const totalPhotosCount = photos.length;

  const filteredPhotos = photos.filter((p) => {
    const matchesCat = selectedCatId === "all" || p.category === selectedCatId;
    return matchesCat;
  });

  const visiblePhotos = filteredPhotos.slice(0, visibleCount);

  const columnsCount = useColumnsCount();
  
  const columnsData: Photo[][] = Array.from({ length: columnsCount }, () => []);
  visiblePhotos.forEach((photo, idx) => {
    columnsData[idx % columnsCount].push(photo);
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredPhotos.length) {
          // Preload next 16 images in background
          setVisibleCount((prev) => prev + 16);
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [loading, visibleCount, filteredPhotos.length]);

  const handlePrevPhoto = () => {
    if (!lightboxPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === lightboxPhoto.id);
    if (currentIndex > 0) {
      setLightboxPhoto(filteredPhotos[currentIndex - 1]);
    } else {
      setLightboxPhoto(filteredPhotos[filteredPhotos.length - 1]);
    }
  };

  const handleNextPhoto = () => {
    if (!lightboxPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === lightboxPhoto.id);
    if (currentIndex < filteredPhotos.length - 1) {
      setLightboxPhoto(filteredPhotos[currentIndex + 1]);
    } else {
      setLightboxPhoto(filteredPhotos[0]);
    }
  };

  useEffect(() => {
    if (!lightboxPhoto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrevPhoto();
      } else if (e.key === "ArrowRight") {
        handleNextPhoto();
      } else if (e.key === "Escape") {
        setLightboxPhoto(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxPhoto, filteredPhotos]);

  const handleSync = () => {
    loadGalleryData(true);
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-slate-900 coordinator-light-theme">
      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12 py-10 space-y-8">
      {/* Title Header Section */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">
          <span className="text-primary font-mono-tech">ALBUM ẢNH CUỘC THI</span>
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Nơi lưu giữ các khoảnh khắc đáng nhớ của các đội thi trong khuôn khổ SEAL Hackathon.
        </p>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white p-4 rounded-[6px] border border-primary/15 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setSelectedCatId("all")}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all duration-300 cursor-pointer ${
              selectedCatId === "all"
                ? "bg-primary text-white shadow-lg shadow-[#F27024]/20"
                : "text-slate-600 hover:text-primary bg-white hover:bg-primary/5 border border-slate-200 hover:border-primary/30"
            }`}
          >
            TẤT CẢ ({totalPhotosCount})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all duration-300 cursor-pointer ${
                selectedCatId === cat.id
                  ? "bg-primary text-white shadow-lg shadow-[#F27024]/20"
                  : "text-slate-600 hover:text-primary bg-white hover:bg-primary/5 border border-slate-200 hover:border-primary/30"
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* Sync Actions (Admin/Coordinator Only) */}
        {isCoordinator && (
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={handleSync}
              disabled={syncing || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-primary/5 disabled:opacity-50 text-slate-700 hover:text-primary rounded-[6px] text-xs font-mono font-bold transition-all border border-primary/20 cursor-pointer shadow-xs active:scale-95"
              title="Đồng bộ lại hình ảnh từ Google Drive"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin text-primary" : "text-primary"} />
              <span>ĐỒNG BỘ</span>
            </button>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-[6px] p-3 space-y-4 animate-pulse shadow-xs">
              <div className="aspect-video bg-slate-200 rounded-[6px]"></div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 rounded-sm w-2/3"></div>
                <div className="h-2 bg-slate-100 rounded-sm w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredPhotos.length > 0 ? (
        /* Image Grid - Pinterest Masonry style */
        <>
          <div className="grid gap-6 animate-fadeIn" style={{ gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))` }}>
            {columnsData.map((columnPhotos, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-6">
                {columnPhotos.map((photo) => {
                  const globalIndex = visiblePhotos.findIndex(p => p.id === photo.id);
                  const isSentinel = globalIndex === visiblePhotos.length - 5 || (visiblePhotos.length < 5 && globalIndex === visiblePhotos.length - 1);
                  return (
                    <div
                      key={photo.id}
                      ref={isSentinel ? sentinelRef : null}
                      className="group bg-white hover:bg-primary/3 border border-slate-200 hover:border-primary/30 rounded-[6px] p-3 flex flex-col justify-between transition-all duration-300 shadow-xs hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                    >
                      {/* Photo Box */}
                      <div className="relative rounded-[6px] overflow-hidden bg-slate-100 border border-slate-200 group-hover:border-primary/25 transition-colors">
                        <img
                          src={photo.url}
                          alt={photo.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-auto block rounded-[6px] transition-transform duration-500 group-hover:scale-102"
                        />
                        {/* Overlay actions */}
                        <div className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <button
                            onClick={() => setLightboxPhoto(photo)}
                            className="p-3 rounded-full bg-primary hover:bg-[#d95f1f] text-white transition-all transform scale-90 group-hover:scale-100 hover:scale-105 shadow-lg shadow-[#F27024]/25 cursor-pointer"
                            title="Xem chi tiết"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Infinite Scroll Sentinel */}
          {visibleCount < filteredPhotos.length && (
            <div ref={sentinelRef} className="flex justify-center items-center py-10 space-x-2">
              <RefreshCw size={16} className="animate-spin text-primary" />
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Đang tải thêm ảnh...</span>
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <div className="text-center py-24 bg-white border border-slate-200 rounded-[6px] shadow-xs">
          <AlertCircle size={40} className="mx-auto text-primary mb-3" />
          <p className="text-sm font-semibold text-slate-600">Không tìm thấy ảnh nào phù hợp.</p>
        </div>
      )}

      </div>

      {/* Lightbox / Details Modal */}
      {lightboxPhoto && createPortal(
        <div className="fixed inset-0 bg-[linear-gradient(135deg,#fff7f2_0%,#f8fafc_48%,#eef4ff_100%)] flex flex-col justify-between p-4 sm:p-6 z-9999 animate-fadeIn text-slate-900">
          {/* Top Bar */}
          <div className="flex justify-between items-center w-full max-w-7xl mx-auto py-2 z-10">
            <div className="font-mono text-left min-w-0">
              <p className="text-sm sm:text-base font-extrabold text-slate-900 truncate max-w-[70vw]">{lightboxPhoto.name}</p>
              <p className="text-[10px] text-slate-500">{lightboxPhoto.size}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLightboxPhoto(null)}
                className="bg-white hover:bg-primary/5 text-slate-500 hover:text-primary p-2.5 rounded-[6px] border border-primary/20 hover:border-primary/45 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Container with Prev/Next buttons */}
          <div className="flex-1 flex items-center justify-between max-w-7xl mx-auto w-full relative overflow-hidden p-2 sm:p-4 gap-3 sm:gap-5">
            {/* Prev Button */}
            <button
              onClick={handlePrevPhoto}
              className="p-3.5 rounded-full bg-white/95 hover:bg-primary text-primary hover:text-white border border-primary/20 hover:border-primary transition-all cursor-pointer shadow-[0_18px_45px_rgba(15,23,42,0.10)] active:scale-95 shrink-0"
              title="Ảnh trước"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Image Box */}
            <div className="flex-1 h-full flex items-center justify-center max-h-[80vh]">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.name}
                className="max-w-full max-h-full object-contain rounded-[6px] border border-primary/20 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] animate-scaleUp"
              />
            </div>

            {/* Next Button */}
            <button
              onClick={handleNextPhoto}
              className="p-3.5 rounded-full bg-white/95 hover:bg-primary text-primary hover:text-white border border-primary/20 hover:border-primary transition-all cursor-pointer shadow-[0_18px_45px_rgba(15,23,42,0.10)] active:scale-95 shrink-0"
              title="Ảnh sau"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Bottom Bar Footer (Placeholder for spacing) */}
          <div className="py-2 opacity-0 select-none">Spacer</div>
        </div>,
        document.body
      )}
    </div>
  );
}
