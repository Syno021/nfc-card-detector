import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { User } from '@/models/User';
import { UserService } from '@/services/userService';
import { UserCardUtils } from '@/utils/userCardUtils';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';

const DEFAULT_CARD_NUMBER = 'Admin01';

export default function UserProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const params = useLocalSearchParams<{ cardNumber?: string; nfcId?: string }>();
  const routeCardNumber =
    typeof params.cardNumber === 'string' ? params.cardNumber : undefined;
  const routeNfcId = typeof params.nfcId === 'string' ? params.nfcId : undefined;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        setError(null);
        let profile: User | null = null;

        // Priority: NFC ID from route, then explicit cardNumber from route, then default
        if (routeNfcId) {
          profile = await UserService.getUserByNfcId(routeNfcId);
          if (!profile) {
            setError(`No user found for NFC ID ${routeNfcId}`);
          }
        } else {
          const cardToUse = routeCardNumber || DEFAULT_CARD_NUMBER;
          profile = await UserService.getUserByCardNumber(cardToUse);

          if (!profile) {
            setError(`No user found for card ${cardToUse}`);
          }
        }

        setUser(profile);
      } catch (err: any) {
        console.error('Error loading user profile:', err);
        setError(err.message || 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [routeCardNumber, routeNfcId]);

  const initials = UserCardUtils.getInitials(user, 'NA');
  const fullName = UserCardUtils.getFullName(user) || 'Unknown User';
  const cardStatus = UserCardUtils.getCardStatus(user);
  const roleDisplay = user ? UserCardUtils.getRoleDisplayName(user.role) : 'Unknown Role';
  const accessLevel = user ? UserCardUtils.getAccessLevel(user.role) : 'Unknown';

  const createdAtText =
    user?.createdAt && user.createdAt instanceof Date
      ? UserCardUtils.formatDateTime(user.createdAt)
      : 'Not available';

  const updatedAtText =
    user?.updatedAt && user.updatedAt instanceof Date
      ? UserCardUtils.formatDateTime(user.updatedAt)
      : 'Not available';

  const showWarning = UserCardUtils.shouldShowWarning(user);
  const showError = UserCardUtils.shouldShowError(user);
  const showSuccess = UserCardUtils.shouldShowSuccess(user);

  const statusColor = showSuccess
    ? '#00C8FC'
    : showError
    ? '#FF3B30'
    : showWarning
    ? '#FFCC00'
    : colors.textSecondary;
    

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.gradientOverlay}>
          <View
            style={[
              styles.circle,
              styles.circle1,
              { backgroundColor: '#00C8FC', opacity: isDark ? 0.08 : 0.12 },
            ]}
          />
          <View
            style={[
              styles.circle,
              styles.circle2,
              { backgroundColor: '#00C8FC', opacity: isDark ? 0.08 : 0.12 },
            ]}
          />
        </View>

        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color="#00C8FC" />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading profile…
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.gradientOverlay}>
          <View
            style={[
              styles.circle,
              styles.circle1,
              { backgroundColor: '#00C8FC', opacity: isDark ? 0.08 : 0.12 },
            ]}
          />
          <View
            style={[
              styles.circle,
              styles.circle2,
              { backgroundColor: '#00C8FC', opacity: isDark ? 0.08 : 0.12 },
            ]}
          />
        </View>

        <View style={styles.loadingWrapper}>
          <ThemedText style={[styles.errorTitle, { color: colors.text }]}>
            Unable to load profile
          </ThemedText>
          <ThemedText style={[styles.errorText, { color: colors.textSecondary }]}>
            {error}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.gradientOverlay}>
        <View
          style={[
            styles.circle,
            styles.circle1,
            { backgroundColor: '#00C8FC', opacity: isDark ? 0.08 : 0.12 },
          ]}
        />
        <View
          style={[
            styles.circle,
            styles.circle2,
            { backgroundColor: '#00C8FC', opacity: isDark ? 0.08 : 0.12 },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card header / avatar section */}
        <View
          style={[
            styles.headerCard,
            {
              backgroundColor: colors.card,
              shadowColor: colors.shadow,
              borderColor: colors.borderLight,
              borderWidth: isDark ? 0.5 : 0,
            },
          ]}
        >
          <View style={styles.avatarWrapper}>
            <View
              style={[
                styles.avatarGlow,
                {
                  borderColor: '#00C8FC40',
                  backgroundColor: isDark ? 'rgba(0, 200, 252, 0.1)' : 'rgba(0, 200, 252, 0.06)',
                },
              ]}
            />

            <View
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.borderLight,
                  borderWidth: isDark ? 1 : 0.5,
                },
              ]}
            >
              {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
              ) : (
                <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
              )}
            </View>
          </View>

          <ThemedText style={[styles.nameText, { color: colors.text }]}>
            {fullName}
          </ThemedText>
          <ThemedText style={[styles.roleText, { color: colors.textSecondary }]}>
            {roleDisplay} · {accessLevel}
          </ThemedText>

          <View
            style={[
              styles.statusChip,
              {
                borderColor: `${statusColor}55`,
                backgroundColor: colors.backgroundSecondary,
              },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <ThemedText style={[styles.statusText, { color: statusColor }]}>
              {cardStatus}
            </ThemedText>
          </View>

          <View
            style={[
              styles.cardNumberBadge,
              {
                backgroundColor: colors.backgroundSecondary,
              },
            ]}
          >
            <ThemedText style={styles.cardNumberLabel}>Card Number</ThemedText>
            <ThemedText style={styles.cardNumberValue}>{user?.cardNumber}</ThemedText>
          </View>
        </View>

        {/* Details grid */}
        <View style={styles.detailsGrid}>
          <View
            style={[
              styles.detailColumn,
              {
                backgroundColor: colors.card,
                borderColor: colors.borderLight,
                borderWidth: isDark ? 1 : 0.5,
              },
            ]}
          >
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              Account details
            </ThemedText>

            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Email
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                {user?.email || 'Not set'}
              </ThemedText>
            </View>

            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Department
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                {user?.department || 'Not set'}
              </ThemedText>
            </View>

            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Role
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                {roleDisplay}
              </ThemedText>
            </View>

            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                NFC ID
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                {user?.nfcId || 'Not assigned'}
              </ThemedText>
            </View>
          </View>

          <View
            style={[
              styles.detailColumn,
              {
                backgroundColor: colors.card,
                borderColor: colors.borderLight,
                borderWidth: isDark ? 1 : 0.5,
              },
            ]}
          >
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              Status & metadata
            </ThemedText>

            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Active
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                {user?.isActive ? 'Yes' : 'No'}
              </ThemedText>
            </View>

            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Approved
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                {user?.isApproved ? 'Yes' : 'No'}
              </ThemedText>
            </View>

            {user?.role === 'staff' && (
              <View style={styles.detailItem}>
                <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Can approve students
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                  {user.canApproveStudents ? 'Yes' : 'No'}
                </ThemedText>
              </View>
            )}

            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Created at
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                {createdAtText}
              </ThemedText>
            </View>

            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Last updated
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                {updatedAtText}
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 1000,
  },
  circle1: {
    width: 380,
    height: 380,
    top: -150,
    right: -150,
  },
  circle2: {
    width: 340,
    height: 340,
    bottom: -140,
    left: -140,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    opacity: 0.7,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerCard: {
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 22,
    marginBottom: 28,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
  },
  avatarWrapper: {
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#00C8FC',
    letterSpacing: 2,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  roleText: {
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 16,
    textAlign: 'center',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 16,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardNumberBadge: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  cardNumberLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.7,
    color: '#00C8FC',
  },
  cardNumberValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#00C8FC',
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  detailColumn: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailItem: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
  },
});

