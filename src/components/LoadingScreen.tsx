export default function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: '#6d5ef1' }}
    >
      <img src="/icons/icon.svg" alt="Pastly" className="w-40 h-40" />
      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );
}
