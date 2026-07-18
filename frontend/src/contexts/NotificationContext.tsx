import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  text: string;
}

interface NotificationContextType {
  toasts: ToastMessage[];
  showToast: (type: ToastMessage['type'], title: string, text: string) => void;
  removeToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastMessage['type'], title: string, text: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, text }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, [removeToast]);

  return (
    <NotificationContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast container floating on top */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '350px',
        width: '100%'
      }}>
        {toasts.map(toast => {
          const colors = {
            success: { bg: '#e6f4ea', border: '#10b981', color: '#065f46' },
            error: { bg: '#fce8e6', border: '#ef4444', color: '#c5221f' },
            warning: { bg: '#fef7e0', border: '#f59e0b', color: '#b06000' },
            info: { bg: '#e8f0fe', border: '#3b82f6', color: '#174ea6' }
          }[toast.type];

          return (
            <div
              key={toast.id}
              style={{
                backgroundColor: colors.bg,
                borderLeft: `5px solid ${colors.border}`,
                color: colors.color,
                borderRadius: '8px',
                padding: '12px 16px',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '8px',
                animation: 'slideIn 0.3s ease-out'
              }}
            >
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{toast.title}</div>
                <div style={{ fontSize: '0.8125rem', marginTop: '2px', opacity: 0.9 }}>{toast.text}</div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  opacity: 0.6
                }}
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within a NotificationProvider");
  return context;
};
