import React, { createContext, useContext, useState, useEffect } from 'react';

interface OfflineContextType {
  isOnline: boolean;
  offlineQueue: any[];
  addToQueue: (action: any) => void;
  syncQueue: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log("System detected internet connection. Synchronizing local cache...");
      syncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      console.log("System offline. Switching to local sandbox.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load initial queue
    const savedQueue = localStorage.getItem('mediclinic_offline_queue');
    if (savedQueue) {
      setOfflineQueue(JSON.parse(savedQueue));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addToQueue = (action: any) => {
    const newQueue = [...offlineQueue, { ...action, id: Date.now() }];
    setOfflineQueue(newQueue);
    localStorage.setItem('mediclinic_offline_queue', JSON.stringify(newQueue));
  };

  const syncQueue = async () => {
    if (offlineQueue.length === 0) return;
    console.log(`Syncing ${offlineQueue.length} offline events...`);
    
    // Simulate posting items to API one-by-one
    for (const item of offlineQueue) {
      try {
        // Mock API sync delay
        await new Promise(r => setTimeout(r, 800));
        console.log("Synced offline operation:", item);
      } catch (err) {
        console.error("Failed to sync offline item:", item, err);
      }
    }

    setOfflineQueue([]);
    localStorage.removeItem('mediclinic_offline_queue');
  };

  return (
    <OfflineContext.Provider value={{ isOnline, offlineQueue, addToQueue, syncQueue }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) throw new Error("useOffline must be used within an OfflineProvider");
  return context;
};
