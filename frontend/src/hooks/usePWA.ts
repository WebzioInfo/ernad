import { useState, useEffect } from 'react';

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Detect iOS (iPhone, iPad, iPod, and desktop-class iPadOS)
    const checkIsIOS = () => {
      const userAgent = window.navigator.userAgent || '';
      const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) || 
        (userAgent.includes('Mac') && 'ontouchend' in document);
      setIsIOS(isIOSDevice);
    };

    // Check if the app is already installed/running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMode = 
        (window.navigator as any).standalone === true || 
        window.matchMedia('(display-mode: standalone)').matches;
      
      setIsInstalled(isStandaloneMode);
    };

    // Check localStorage for dismissal state
    const checkDismissal = () => {
      const dismissed = localStorage.getItem('eranad-pwa-ios-dismissed') === 'true';
      setIsDismissed(dismissed);
    };

    checkIsIOS();
    checkStandalone();
    checkDismissal();

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;

    // Show the install prompt
    installPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, throw it away
    setInstallPrompt(null);
  };

  const dismissIOSPrompt = () => {
    localStorage.setItem('eranad-pwa-ios-dismissed', 'true');
    setIsDismissed(true);
    setIsPromptOpen(false);
  };

  const triggerIOSPrompt = () => {
    setIsPromptOpen(true);
  };

  const closeIOSPrompt = () => {
    setIsPromptOpen(false);
  };

  // The automatic banner should show if the user is on iOS, the app is not installed, 
  // and the user has not dismissed it. Or if they manually triggered it (isPromptOpen).
  const showIOSPrompt = (isIOS && !isInstalled && !isDismissed) || isPromptOpen;

  return { 
    installPrompt, 
    isInstalled, 
    installApp,
    isIOS,
    showIOSPrompt,
    dismissIOSPrompt,
    triggerIOSPrompt,
    closeIOSPrompt
  };
}
