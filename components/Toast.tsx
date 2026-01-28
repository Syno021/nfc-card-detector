import React, { createContext, useCallback, useContext, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [fadeAnims] = useState<Map<number, Animated.Value>>(new Map());

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    const fadeAnim = new Animated.Value(0);
    fadeAnims.set(id, fadeAnim);

    setToasts(prev => [...prev, { id, message, type }]);

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        fadeAnims.delete(id);
      });
    }, 3000);
  }, []);

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const error = useCallback((message: string) => showToast(message, 'error'), [showToast]);
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast]);
  const warning = useCallback((message: string) => showToast(message, 'warning'), [showToast]);

  const getToastColor = (type: ToastType) => {
    switch (type) {
      case 'success': return '#10B981';
      case 'error': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'info': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="none">
        {toasts.map(toast => {
          const fadeAnim = fadeAnims.get(toast.id);
          if (!fadeAnim) return null;

          return (
            <Animated.View
              key={toast.id}
              style={[
                styles.toast,
                { 
                  backgroundColor: getToastColor(toast.type),
                  opacity: fadeAnim,
                  transform: [{
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  }],
                },
              ]}
            >
              <Text style={styles.toastIcon}>{getToastIcon(toast.type)}</Text>
              <Text style={styles.toastText}>{toast.message}</Text>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 16,
    maxWidth: Dimensions.get('window').width - 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    gap: 8,
  },
  toastIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});

