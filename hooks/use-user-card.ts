import { useAuth } from '@/contexts/AuthContext';
import { UserCardUtils } from '@/utils/userCardUtils';

/**
 * Custom hook for user card screens
 * Provides common functionality and data for displaying user cards
 */
export function useUserCard() {
  const { user, loading } = useAuth();

  return {
    // Auth state
    user,
    loading,
    isReady: !loading && !!user,

    // Helper functions bound to current user
    getInitials: (fallback?: string) => UserCardUtils.getInitials(user, fallback),
    getFullName: () => UserCardUtils.getFullName(user),
    formatDate: (date: Date) => UserCardUtils.formatDate(date),
    formatDateTime: (date: Date) => UserCardUtils.formatDateTime(date),
    getCardStatus: () => UserCardUtils.getCardStatus(user),
    getAccessStatusText: (role: 'admin' | 'staff' | 'student') => 
      UserCardUtils.getAccessStatusText(user, role),
    getAccessLevel: (role: 'admin' | 'staff' | 'student') => 
      UserCardUtils.getAccessLevel(role),
    getRoleDisplayName: (role: 'admin' | 'staff' | 'student') => 
      UserCardUtils.getRoleDisplayName(role),
    
    // User state checks
    hasProfileImage: () => UserCardUtils.hasProfileImage(user),
    hasNfcId: () => UserCardUtils.hasNfcId(user),
    shouldShowWarning: () => UserCardUtils.shouldShowWarning(user),
    shouldShowError: () => UserCardUtils.shouldShowError(user),
    shouldShowSuccess: () => UserCardUtils.shouldShowSuccess(user),
    
    // Utilities
    getCardValidYear: () => UserCardUtils.getCardValidYear(),
  };
}

