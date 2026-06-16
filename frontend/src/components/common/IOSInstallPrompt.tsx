import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';

interface IOSInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IOSInstallPrompt({ isOpen, onClose }: IOSInstallPromptProps) {
  const [browser, setBrowser] = useState<'safari' | 'chrome' | 'edge' | 'other'>('safari');

  useEffect(() => {
    const userAgent = window.navigator.userAgent || '';
    if (userAgent.includes('CriOS')) {
      setBrowser('chrome');
    } else if (userAgent.includes('EdgiOS')) {
      setBrowser('edge');
    } else if (/Safari/.test(userAgent) && !/CriOS|EdgiOS|FxiOS/.test(userAgent)) {
      setBrowser('safari');
    } else {
      setBrowser('other');
    }
  }, []);

  // Custom SVG for iOS Share button (Safari)
  const ShareIcon = () => (
    <span className="inline-flex items-center justify-center p-1.5 bg-slate-100 rounded-lg text-[#1A9A91] align-middle mx-1.5 shadow-sm border border-slate-200">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    </span>
  );

  // Custom SVG for iOS Add to Home Screen button [+]
  const AddIcon = () => (
    <span className="inline-flex items-center justify-center p-1.5 bg-slate-100 rounded-lg text-[#1A9A91] align-middle mx-1.5 shadow-sm border border-slate-200">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    </span>
  );

  // Custom SVG for Ellipsis Menu button (Chrome/Edge/other)
  const MenuIcon = () => (
    <span className="inline-flex items-center justify-center p-1.5 bg-slate-100 rounded-lg text-[#1A9A91] align-middle mx-1.5 shadow-sm border border-slate-200">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
      </svg>
    </span>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40 backdrop-blur-xs sm:items-center">
          {/* Backdrop Click Dismiss */}
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10"
            style={{ borderRadius: '24px' }} // inline override just in case rounded-3xl is flattened
          >
            {/* Elegant Header Background Gradient */}
            <div className="h-2 bg-gradient-to-r from-[#1A9A91] via-[#2BA59B] to-[#157C75]" />

            <div className="p-6">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title & Subtitle */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#E8F7F4] flex items-center justify-center border border-[#D4F1EC] shrink-0" style={{ borderRadius: '14px' }}>
                  <img src="/fav-nobg.png" alt="App Icon" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 tracking-tight text-[16px]">Install Eranad MES</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">System Setup</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                Add this application to your home screen to enable a high-fidelity full-screen dashboard with offline capabilities.
              </p>

              {/* Dynamic Browser Instructions */}
              <div className="space-y-4 mb-6">
                {browser === 'safari' && (
                  <>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-[#E8F7F4] text-[#1A9A91] font-bold text-xs flex items-center justify-center shrink-0">1</div>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                        Tap the **Share** button <ShareIcon /> in Safari (located at the **bottom** on iPhone, or **top** on iPad).
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-[#E8F7F4] text-[#1A9A91] font-bold text-xs flex items-center justify-center shrink-0">2</div>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                        Scroll down the share menu and select **Add to Home Screen** <AddIcon />.
                      </p>
                    </div>
                  </>
                )}

                {browser === 'chrome' && (
                  <>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-[#E8F7F4] text-[#1A9A91] font-bold text-xs flex items-center justify-center shrink-0">1</div>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                        Tap the **Share** icon <ShareIcon /> in the address bar, or tap the **Menu** button <MenuIcon /> and select **Share...**.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-[#E8F7F4] text-[#1A9A91] font-bold text-xs flex items-center justify-center shrink-0">2</div>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                        Select **Add to Home Screen** <AddIcon /> from the options menu.
                      </p>
                    </div>
                  </>
                )}

                {browser === 'edge' && (
                  <>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-[#E8F7F4] text-[#1A9A91] font-bold text-xs flex items-center justify-center shrink-0">1</div>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                        Tap the **Menu** button <MenuIcon /> at the bottom of the screen.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-[#E8F7F4] text-[#1A9A91] font-bold text-xs flex items-center justify-center shrink-0">2</div>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                        Tap the **Share** button, then scroll and select **Add to Home Screen** <AddIcon />.
                      </p>
                    </div>
                  </>
                )}

                {browser === 'other' && (
                  <>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-[#E8F7F4] text-[#1A9A91] font-bold text-xs flex items-center justify-center shrink-0">1</div>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                        Open your browser's **Share** or **Options** menu <ShareIcon />.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-[#E8F7F4] text-[#1A9A91] font-bold text-xs flex items-center justify-center shrink-0">2</div>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                        Find and tap **Add to Home Screen** <AddIcon />.
                      </p>
                    </div>
                  </>
                )}

                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-[#E8F7F4] text-[#1A9A91] font-bold text-xs flex items-center justify-center shrink-0">3</div>
                  <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                    Confirm by tapping **Add** in the top-right corner to complete the installation.
                  </p>
                </div>
              </div>

              {/* Dismiss Action Button */}
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1A9A91] hover:bg-[#157C75] text-white font-bold rounded-xl shadow-lg shadow-[#1a9a91]/20 transition-all active:scale-95 text-sm cursor-pointer"
                style={{ borderRadius: '12px' }}
              >
                <Check className="w-4 h-4" />
                Got It
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
