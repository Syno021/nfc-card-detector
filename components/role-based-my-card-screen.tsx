import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserCardLoading } from '@/components/user-card-loading';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserCard } from '@/hooks/use-user-card';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

type Role = 'student' | 'staff' | 'admin';

////////////////////////////// NFC/RFID helpers //////////////////////////////

/**
 * Read student RFID card data
 * This function is designed to work with common student ID RFID cards
 * (typically MIFARE Classic, MIFARE Ultralight, or ISO14443A cards)
 */
const readStudentRfidCard = async (): Promise<{
  cardId: string;
  cardType: string;
  data?: any;
} | null> => {
  try {
    // Request NFC technology - using NfcA for most student RFID cards
    await NfcManager.requestTechnology([NfcTech.NfcA, NfcTech.MifareClassic]);
    
    // Get the tag information
    const tag = await NfcManager.getTag();
    
    if (!tag) {
      console.log('No tag found');
      return null;
    }

    console.log('Tag detected:', tag);

    // Extract card ID (UID) - this is the unique identifier
    const cardId = tag.id || 'UNKNOWN';
    
    // Get card type
    const cardType = tag.techTypes?.join(', ') || 'Unknown RFID';
    
    // For MIFARE Classic cards, you can read specific sectors
    // (requires authentication with keys - usually default keys)
    let additionalData = null;
    
    if (tag.techTypes?.includes('android.nfc.tech.MifareClassic')) {
      try {
        additionalData = await readMifareClassicData();
      } catch (error) {
        console.log('Could not read MIFARE data:', error);
      }
    }

    return {
      cardId: formatCardId(cardId),
      cardType,
      data: additionalData,
    };
  } catch (error) {
    console.log('RFID card read error:', error);
    return null;
  } finally {
    // Always cancel the technology request
    NfcManager.cancelTechnologyRequest();
  }
};

/**
 * Read data from MIFARE Classic card sectors
 * Note: This requires knowing the authentication keys
 * Most student cards use default keys: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]
 */
const readMifareClassicData = async () => {
  try {
    const defaultKey = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]; // Default MIFARE key
    const sector = 1; // Read from sector 1 (sector 0 is usually system data)
    const blockIndex = 4; // First block of sector 1

    // Authenticate with the sector
    await NfcManager.mifareClassicAuthenticateA(blockIndex, defaultKey);
    
    // Read the block
    const data = await NfcManager.mifareClassicReadBlock(blockIndex);
    
    return {
      sector,
      block: blockIndex,
      data: toHexString(data),
    };
  } catch (error) {
    console.log('MIFARE read error:', error);
    return null;
  }
};

/**
 * Format card ID for display
 * Converts byte array to readable hex format
 */
const formatCardId = (cardId: string | number[]): string => {
  if (typeof cardId === 'string') {
    return cardId.toUpperCase();
  }
  
  if (Array.isArray(cardId)) {
    return cardId
      .map(byte => ('00' + byte.toString(16).toUpperCase()).slice(-2))
      .join(':');
  }
  
  return 'UNKNOWN';
};

/**
 * Convert byte array to hex string
 */
const toHexString = (byteArr: number[]): string => {
  return byteArr
    .map(byte => ('00' + byte.toString(16).toUpperCase()).slice(-2))
    .join(' ');
};

/**
 * Verify student card against backend
 * This replaces the payment processing with student verification
 */
const verifyStudentCard = async (cardId: string, studentData: any) => {
  try {
    const response = await fetch('http://localhost:8081/verify-student-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        cardId, 
        studentData,
        timestamp: new Date().toISOString(),
      }),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.log('Verification error:', error);
    return { success: false, error: 'Network error' };
  }
};

/**
 * Handle successful card read
 */
const handleCardSuccess = (cardData: any) => {
  console.log('Student card read successfully:', cardData);
  Alert.alert(
    'Card Read Successfully',
    `Card ID: ${cardData.cardId}\nType: ${cardData.cardType}`,
    [{ text: 'OK' }]
  );
};

/**
 * Handle card read failure
 */
const handleCardFailure = (error?: string) => {
  console.log('Card read failed:', error);
  Alert.alert(
    'Card Read Failed',
    error || 'Unable to read student card. Please try again.',
    [{ text: 'OK' }]
  );
};

////////////////////////////// Main Component //////////////////////////////

type RoleConfig = {
  cardHeaderTitle: string;
  cardHeaderSubtitle?: string;
  cardTypeLabel: string;
  infoRoleIcon: string;
  loadingColorKey: keyof typeof Colors.light;
};

const ROLE_CONFIG: Record<Role, RoleConfig> = {
  student: {
    cardHeaderTitle: 'Student ID Card',
    cardHeaderSubtitle: 'Virtual Access Card',
    cardTypeLabel: 'STUDENT ID',
    infoRoleIcon: '👨‍🎓',
    loadingColorKey: 'info',
  },
  staff: {
    cardHeaderTitle: 'Staff ID Card',
    cardHeaderSubtitle: 'Virtual Access Card',
    cardTypeLabel: 'STAFF ID',
    infoRoleIcon: '👨‍💼',
    loadingColorKey: 'secondary',
  },
  admin: {
    cardHeaderTitle: 'Admin ID Card',
    cardHeaderSubtitle: 'Virtual Access Card',
    cardTypeLabel: 'ADMIN ID',
    infoRoleIcon: '🛡️',
    loadingColorKey: 'primary',
  },
};

type RoleBasedMyCardScreenProps = {
  role: Role;
};

export default function RoleBasedMyCardScreen({ role }: RoleBasedMyCardScreenProps) {
  const config = ROLE_CONFIG[role];
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const card = useUserCard();
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [isNfcSupported, setIsNfcSupported] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Animation values
  const flipAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Initialize NFC
  useEffect(() => {
    let isMounted = true;

    const initNfc = async () => {
      try {
        // NFC is not available on web, and the native module will be undefined.
        if (Platform.OS === 'web') {
          console.log('NFC not supported on web platform');
          if (isMounted) {
            setIsNfcSupported(false);
          }
          return;
        }

        // Extra guard: native NFC module may not be available
        // (e.g. running inside Expo Go or a build without react-native-nfc-manager linked).
        if (
          !NfcManager ||
          typeof (NfcManager as any).isSupported !== 'function' ||
          typeof (NfcManager as any).start !== 'function'
        ) {
          console.log(
            'NFC manager native module not available in this runtime. ' +
              'Build a native app / custom dev client with react-native-nfc-manager to enable NFC.'
          );
          if (isMounted) {
            setIsNfcSupported(false);
          }
          return;
        }

        // Check support first, then start NFC only on supported native platforms
        const supported = await NfcManager.isSupported();
        if (!isMounted) return;

        setIsNfcSupported(supported);

        if (supported) {
          await NfcManager.start();

          if (!(await NfcManager.isEnabled())) {
            Alert.alert(
              'NFC is disabled',
              'Please enable NFC in settings to scan student cards.'
            );
          }
        }
      } catch (error) {
        console.error('NFC init failed:', error);
        if (isMounted) setIsNfcSupported(false);
      }
    };

    initNfc();

    return () => {
      isMounted = false;
      if (Platform.OS !== 'web') {
        NfcManager.cancelTechnologyRequest().catch(() => {});
      }
    };
  }, []);

  // Handle scanning student RFID card
  const handleScanCard = async () => {
    if (!isNfcSupported) {
      Alert.alert(
        'NFC Not Available',
        'NFC is not available in this app build or on this device. ' +
          'If your device supports NFC, install a native build that includes react-native-nfc-manager.'
      );
      return;
    }

    setIsScanning(true);

    try {
      Alert.alert(
        'Ready to Scan',
        'Please hold your student card near the device.',
        [{ text: 'Cancel', onPress: () => setIsScanning(false) }]
      );

      const cardData = await readStudentRfidCard();

      if (cardData) {
        handleCardSuccess(cardData);

        // Optionally verify with backend
        const verification = await verifyStudentCard(cardData.cardId, card.user);

        if (verification.success) {
          console.log('Card verified:', verification);
        } else {
          console.log('Card verification failed:', verification);
        }
      } else {
        handleCardFailure();
      }
    } catch (error) {
      console.error('Scan error:', error);
      handleCardFailure(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsScanning(false);
    }
  };

  // Handle card activation with flip and glow
  const handleCardAccess = () => {
    if (!isCardVisible) {
      // Activate card with animations
      setIsCardVisible(true);
      setCountdown(30);

      // Rotation animation (landscape to portrait)
      Animated.spring(rotateAnim, {
        toValue: 1,
        tension: 8,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Flip animation
      Animated.spring(flipAnim, {
        toValue: 1,
        tension: 10,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Scale up animation
      Animated.spring(scaleAnim, {
        toValue: 1.08,
        tension: 100,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Pulsing glow animation - store reference to stop it later
      glowAnimationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      glowAnimationRef.current.start();
    } else {
      // Deactivate card
      deactivateCard();
    }
  };

  const deactivateCard = () => {
    setIsCardVisible(false);
    setCountdown(30); // Reset countdown

    // Stop glow animation loop
    if (glowAnimationRef.current) {
      glowAnimationRef.current.stop();
      glowAnimationRef.current = null;
    }

    // Reset all animations to return to landscape
    Animated.parallel([
      Animated.spring(rotateAnim, {
        toValue: 0,
        tension: 8,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(flipAnim, {
        toValue: 0,
        tension: 10,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Countdown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isCardVisible && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            deactivateCard();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCardVisible, countdown]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      if (glowAnimationRef.current) {
        glowAnimationRef.current.stop();
      }
    };
  }, []);

  // Interpolate animations
  const rotateZ = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'], // Rotate to portrait
  });

  const rotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '10deg'], // Subtle 3D tilt
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  if (!card.isReady) {
    return <UserCardLoading color={colors[config.loadingColorKey]} />;
  }

  const { user } = card;
  const firstName = user?.FirstName ?? user?.firstName ?? '';
  const lastName = user?.LastName ?? user?.lastName ?? '';
  const fullName =
    card.getFullName() ||
    [firstName, lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

  return (
    <ThemedView style={styles.container}>
      {/* Background Gradient Overlay - Same as home */}
      <View style={styles.gradientOverlay}>
        <View
          style={[
            styles.circle,
            styles.circle1,
            { backgroundColor: '#00C8FC', opacity: isDark ? 0.06 : 0.1 },
          ]}
        />
        <View
          style={[
            styles.circle,
            styles.circle2,
            { backgroundColor: '#00C8FC', opacity: isDark ? 0.06 : 0.1 },
          ]}
        />
        <View
          style={[
            styles.circle,
            styles.circle3,
            { backgroundColor: '#00C8FC', opacity: isDark ? 0.04 : 0.08 },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Virtual Card Section - Bank Style */}
        <View style={styles.virtualCardSection}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardHeaderTitle}>{config.cardHeaderTitle}</ThemedText>
            <ThemedText style={styles.cardHeaderSubtitle}>
              {config.cardHeaderSubtitle ?? 'Virtual Access Card'}
            </ThemedText>
          </View>

          {/* Modern Bank-Style Virtual Card with Animations */}
          <View style={[styles.bankCardWrapper, isCardVisible && styles.portraitCardWrapper]}>
            <Animated.View
              style={[
                styles.bankCard,
                {
                  shadowColor: '#00C8FC',
                  transform: [
                    { perspective: 1000 },
                    { rotateZ },
                    { rotateY },
                    { scale: scaleAnim },
                  ],
                },
              ]}
            >
              <View style={styles.bankCardInner}>
                {/* Glow Effect Overlay */}
                {isCardVisible && (
                  <Animated.View
                    style={[
                      styles.glowOverlay,
                      {
                        opacity: glowOpacity,
                        transform: [{ scale: glowScale }],
                      },
                    ]}
                  />
                )}

                {/* Gradient Background */}
                <View style={styles.cardGradient}>
                  <View style={[styles.gradientCircle1]} />
                  <View style={[styles.gradientCircle2]} />
                </View>

                {/* Card Content */}
                <View style={[styles.bankCardContent, isCardVisible && styles.portraitCardContent]}>
                  {/* Card Type with Countdown */}
                  <View style={styles.cardTopRow}>
                  <ThemedText
                    style={[
                      styles.cardType,
                      isCardVisible && styles.portraitCardType,
                    ]}
                  >
                    {config.cardTypeLabel}
                  </ThemedText>
                    {isCardVisible ? (
                      <View style={styles.countdownBadge}>
                        <ThemedText style={styles.countdownText}>{countdown}s</ThemedText>
                      </View>
                    ) : (
                      <View style={styles.cardChip}>
                        <View style={styles.chipPattern} />
                      </View>
                    )}
                  </View>

                  {/* Card Number - Blurred or Visible */}
                  <View style={styles.cardNumberSection}>
                    <ThemedText style={styles.cardLabel}>Card Number</ThemedText>
                    <ThemedText
                      style={[
                      styles.cardNumber,
                      !isCardVisible && styles.blurredText,
                      isCardVisible && styles.portraitCardNumber,
                      ]}
                    >
                      {isCardVisible ? user!.cardNumber : '•••• •••• ••••'}
                    </ThemedText>
                  </View>

                  {/* Card Details */}
                  <View style={[styles.cardDetailsRow, isCardVisible && styles.portraitDetailsRow]}>
                    <View style={styles.cardDetailItem}>
                      <ThemedText style={styles.cardLabel}>Name</ThemedText>
                      <ThemedText
                        style={[
                        styles.cardValue,
                        !isCardVisible && styles.blurredText,
                        isCardVisible && styles.portraitCardValue,
                        ]}
                      >
                        {isCardVisible ? fullName || 'Unnamed User' : '•••••••••'}
                      </ThemedText>
                    </View>
                    <View style={styles.cardDetailItem}>
                      <ThemedText style={styles.cardLabel}>Valid From</ThemedText>
                      <ThemedText
                        style={[
                        styles.cardValue,
                        !isCardVisible && styles.blurredText,
                        isCardVisible && styles.portraitCardValue,
                        ]}
                      >
                        {isCardVisible ? card.formatDate(user!.createdAt) : '••/••/••'}
                      </ThemedText>
                    </View>
                  </View>

                  {/* NFC Icon - Animated when active */}
                  <Animated.View
                    style={[
                      styles.nfcIconWrapper,
                      isCardVisible && {
                        opacity: glowOpacity,
                      },
                    ]}
                  >
                    <View style={styles.nfcIcon}>
                      <View style={styles.nfcWave1} />
                      <View style={styles.nfcWave2} />
                      <View style={styles.nfcWave3} />
                    </View>
                  </Animated.View>

                  {/* Hidden NFC ID for reading */}
                  <View style={styles.hiddenNfc}>
                    <ThemedText style={styles.nfcId}>{user!.nfcId || user!.uid}</ThemedText>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Action Buttons - Bank Style */}
            <View
              style={[
                styles.cardActions,
                isCardVisible && styles.portraitCardActions,
                isCardVisible && styles.cardActionsActive,
              ]}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleCardAccess}
              >
                <View style={styles.buttonIconWrapper}>
                  <ThemedText style={styles.buttonIcon}>{isCardVisible ? '✕' : '👁️'}</ThemedText>
                </View>
                <ThemedText style={styles.primaryButtonText}>
                  {isCardVisible ? `Cancel (${countdown}s)` : 'Tap to Access'}
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.secondaryButton,
                  { borderColor: '#00C8FC' },
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleScanCard}
                disabled={isScanning}
              >
                <View style={styles.buttonIconWrapper}>
                  <ThemedText style={styles.buttonIcon}>📱</ThemedText>
                </View>
                <ThemedText style={[styles.secondaryButtonText, { color: '#00C8FC' }]}>
                  {isScanning ? 'Scanning...' : 'Scan Physical Card'}
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.secondaryButton,
                  { borderColor: '#00C8FC' },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowFullDetails(!showFullDetails)}
              >
                <View style={styles.buttonIconWrapper}>
                  <ThemedText style={styles.buttonIcon}>📋</ThemedText>
                </View>
                <ThemedText style={[styles.secondaryButtonText, { color: '#00C8FC' }]}>
                  {showFullDetails ? 'Hide Details' : 'View Details'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Full Details Section - Conditionally Rendered */}
        {showFullDetails && (
          <>
            {/* Elegant Info Cards with Gradient Accents */}
            <View style={[styles.infoSection, isCardVisible && styles.portraitSpacing]}>
              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(0, 200, 252, 0.08)'
                      : 'rgba(0, 200, 252, 0.05)',
                    borderColor: 'rgba(0, 200, 252, 0.3)',
                    shadowColor: '#00C8FC',
                  },
                ]}
              >
                <View style={[styles.iconBadge, { backgroundColor: '#00C8FC' }]}>
                  <ThemedText style={styles.infoIcon}>{config.infoRoleIcon}</ThemedText>
                </View>
                <ThemedText style={styles.infoLabel}>Role</ThemedText>
                <ThemedText style={[styles.infoValue, { color: '#00C8FC' }]}>
                  {card.getRoleDisplayName(role)}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(0, 200, 252, 0.08)'
                      : 'rgba(0, 200, 252, 0.05)',
                    borderColor: 'rgba(0, 200, 252, 0.3)',
                    shadowColor: '#00C8FC',
                  },
                ]}
              >
                <View style={[styles.iconBadge, { backgroundColor: '#00C8FC' }]}>
                  <ThemedText style={styles.infoIcon}>🏢</ThemedText>
                </View>
                <ThemedText style={styles.infoLabel}>Department</ThemedText>
                <ThemedText style={[styles.infoValue, { color: '#00C8FC' }]}>
                  {user!.department}
                </ThemedText>
              </View>
            </View>

            {/* Elegant Access Status Card */}
            <View
              style={[
                styles.accessCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(52, 199, 89, 0.1)'
                    : 'rgba(52, 199, 89, 0.05)',
                  borderColor: card.shouldShowSuccess() ? '#34C759' : colors.error,
                  shadowColor: card.shouldShowSuccess() ? '#34C759' : colors.error,
                },
              ]}
            >
              <View style={styles.accessHeader}>
                <View
                  style={[
                    styles.statusIconWrapper,
                    {
                      backgroundColor: user!.isActive ? '#34C759' : colors.error,
                    },
                  ]}
                >
                  <ThemedText style={styles.accessIcon}>{user!.isActive ? '✓' : '✕'}</ThemedText>
                </View>
                <View style={styles.accessInfo}>
                  <ThemedText style={styles.accessTitle}>Access Status</ThemedText>
                  <ThemedText style={styles.accessSubtitle}>
                    {card.getAccessStatusText(role)}
                  </ThemedText>
                </View>
              </View>
              <View
                style={[
                  styles.accessBadge,
                  {
                    backgroundColor: user!.isActive ? '#34C759' : colors.error,
                    shadowColor: user!.isActive ? '#34C759' : colors.error,
                  },
                ]}
              >
                <ThemedText style={styles.accessBadgeText}>
                  {user!.isActive ? 'ACTIVE' : 'INACTIVE'}
                </ThemedText>
              </View>
            </View>

            {/* Elegant Account Details Card */}
            <View
              style={[
                styles.detailsCard,
                {
                  backgroundColor: isDark ? 'rgba(0, 200, 252, 0.05)' : colors.card,
                  borderColor: 'rgba(0, 200, 252, 0.2)',
                  shadowColor: '#00C8FC',
                },
              ]}
            >
              <View style={styles.detailsHeader}>
                <View style={[styles.detailsIconBadge, { backgroundColor: '#00C8FC' }]}>
                  <ThemedText style={styles.detailsIconText}>📋</ThemedText>
                </View>
                <ThemedText style={styles.detailsTitle}>Card Information</ThemedText>
              </View>
              <View
                style={[
                  styles.detailRow,
                  {
                    borderBottomColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.1)',
                  },
                ]}
              >
                <ThemedText style={styles.detailLabel}>Card Number:</ThemedText>
                <ThemedText style={[styles.detailValue, { color: '#00C8FC' }]}>
                  {user!.cardNumber}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.detailRow,
                  {
                    borderBottomColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.1)',
                  },
                ]}
              >
                <ThemedText style={styles.detailLabel}>Email:</ThemedText>
                <ThemedText style={styles.detailValue}>{user!.email}</ThemedText>
              </View>
              <View
                style={[
                  styles.detailRow,
                  {
                    borderBottomColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.1)',
                  },
                ]}
              >
                <ThemedText style={styles.detailLabel}>Department:</ThemedText>
                <ThemedText style={styles.detailValue}>{user!.department}</ThemedText>
              </View>
              <View
                style={[
                  styles.detailRow,
                  {
                    borderBottomColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.1)',
                  },
                ]}
              >
                <ThemedText style={styles.detailLabel}>Card Registered:</ThemedText>
                <ThemedText style={styles.detailValue}>{card.formatDate(user!.createdAt)}</ThemedText>
              </View>
              <View
                style={[
                  styles.detailRow,
                  {
                    borderBottomWidth: 0,
                  },
                ]}
              >
                <ThemedText style={styles.detailLabel}>Card Status:</ThemedText>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: card.shouldShowSuccess()
                        ? '#34C759'
                        : card.shouldShowWarning()
                        ? colors.warning
                        : colors.error,
                    },
                  ]}
                >
                  <ThemedText style={styles.statusBadgeText}>{card.getCardStatus()}</ThemedText>
                </View>
              </View>
            </View>

            {/* Elegant Usage Info with Glass Effect */}
            <View
              style={[
                styles.infoBox,
                {
                  backgroundColor: isDark
                    ? 'rgba(0, 200, 252, 0.12)'
                    : 'rgba(0, 200, 252, 0.08)',
                  borderColor: 'rgba(0, 200, 252, 0.4)',
                  shadowColor: '#00C8FC',
                },
              ]}
            >
              <View style={[styles.infoIconBadge, { backgroundColor: '#00C8FC' }]}>
                <ThemedText style={styles.infoBoxIcon}>ℹ️</ThemedText>
              </View>
              <View style={styles.infoBoxContent}>
                <ThemedText style={[styles.infoBoxTitle, { color: '#00C8FC' }]}>
                  How to Use Your Card
                </ThemedText>
                <ThemedText style={styles.infoBoxText}>
                  Present this digital card at RFID readers around campus for building access, library
                  services, and meal plans. Tap "Scan Physical Card" to register a new physical student card.
                </ThemedText>
              </View>
            </View>
          </>
        )}
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
    zIndex: 0,
  },
  circle: {
    position: 'absolute',
    borderRadius: 1000,
  },
  circle1: {
    width: 350,
    height: 350,
    top: -100,
    right: -100,
  },
  circle2: {
    width: 300,
    height: 300,
    bottom: -80,
    left: -80,
  },
  circle3: {
    width: 250,
    height: 250,
    top: '40%',
    left: -100,
  },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 120,
  },
  // Bank Card Styles
  virtualCardSection: {
    gap: 16,
    alignItems: 'center',
  },
  cardHeader: {
    gap: 4,
    width: '100%',
    maxWidth: 460,
  },
  cardHeaderTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cardHeaderSubtitle: {
    fontSize: 14,
    opacity: 0.6,
    fontWeight: '500',
  },
  bankCardWrapper: {
    gap: 16,
    paddingHorizontal: 10,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitCardWrapper: {
    marginBottom: 40,
    marginTop: 24,
    paddingVertical: 60,
    minHeight: 560,
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  bankCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    aspectRatio: 1.6,
    borderRadius: 20,
    overflow: 'visible',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  bankCardInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  glowOverlay: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 25,
    backgroundColor: '#00C8FC',
    opacity: 0.3,
    shadowColor: '#00C8FC',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
  },
  cardGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#00C8FC',
    overflow: 'hidden',
    borderRadius: 20,
  },
  gradientCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -50,
    right: -50,
  },
  gradientCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    bottom: -40,
    left: -40,
  },
  bankCardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  portraitCardContent: {
    padding: 16,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardType: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  portraitCardType: {
    fontSize: 12,
    letterSpacing: 1.2,
  },
  cardChip: {
    width: 48,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: 4,
    overflow: 'hidden',
  },
  chipPattern: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  countdownBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cardNumberSection: {
    gap: 4,
    marginTop: 8,
  },
  cardLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  portraitCardNumber: {
    fontSize: 18,
    letterSpacing: 1,
    lineHeight: 24,
  },
  blurredText: {
    opacity: 0.5,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  portraitDetailsRow: {
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 10,
  },
  cardDetailItem: {
    gap: 4,
    flex: 1,
    minWidth: '45%',
  },
  portraitText: {
    fontSize: 16,
  },
  cardValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  portraitCardValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  nfcIconWrapper: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  nfcIcon: {
    width: 40,
    height: 40,
    position: 'relative',
    transform: [{ rotate: '90deg' }],
  },
  nfcWave1: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    top: 12,
    left: 12,
  },
  nfcWave2: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    top: 7,
    left: 7,
  },
  nfcWave3: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    top: 2,
    left: 2,
  },
  hiddenNfc: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
  nfcId: {
    fontSize: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
  },
  portraitCardActions: {
    marginTop: 20,
  },
  cardActionsActive: {
    marginTop: 32,
    paddingTop: 16,
    paddingBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#00C8FC',
    shadowColor: '#00C8FC',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonIconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  portraitSpacing: {
    marginTop: 20, // Extra spacing when card is in portrait
  },
  infoSection: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  infoIcon: {
    fontSize: 28,
  },
  infoLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 6,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  accessCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  accessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  statusIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  accessIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  accessInfo: {
    flex: 1,
  },
  accessTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  accessSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
  accessBadge: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 14,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  accessBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  detailsCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  detailsIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsIconText: {
    fontSize: 20,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  detailLabel: {
    fontSize: 14,
    opacity: 0.7,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    gap: 14,
    alignItems: 'flex-start',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  infoIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  infoBoxIcon: {
    fontSize: 22,
  },
  infoBoxContent: {
    flex: 1,
  },
  infoBoxTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  infoBoxText: {
    fontSize: 14,
    opacity: 0.85,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
});


