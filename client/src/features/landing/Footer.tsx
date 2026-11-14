import logoFpt from "../../assets/Logo_Trường_Đại_học_FPT.svg";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 w-full z-20 relative py-8">
      <div className="flex flex-col md:flex-row justify-between items-center w-full px-6 gap-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-1 items-center md:items-start">
          <span className="font-mono text-sm font-bold text-primary">SEAL_HACKATHON</span>
          <p className="font-mono text-[10px] text-slate-500">
            &copy; 2026 SEAL_HACKATHON. ALL_RIGHTS_RESERVED.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-slate-500">Powered by</span>
          <img
            alt="FPT Logo"
            className="h-12"
            src={logoFpt}
          />
        </div>
      </div>
    </footer>
  );
}
