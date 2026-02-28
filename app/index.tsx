import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { UserService } from '@/services/userService';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Platform, StyleSheet, View } from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

/** NDEF record type for app-specific user ID (optional; first text record is also used). */
export const NDEF_RECORD_TYPE_USER_ID = 'application/vnd.nfc-card-detector.user';

type CardReadResult = {
  cardId: string;
  cardType: string;
  data?: any;
} | null;

/**
 * Supported NFC technologies, in priority order:
 * - NfcA: physical cards (ISO 14443-3A), many student cards
 * - Ndef: NDEF tags and phones emulating NDEF (e.g. Android Beam / app-written tags)
 * - IsoDep: smart cards, some HCE on Android
 * - MifareClassic: legacy MIFARE Classic cards
 */
const NFC_TECH_LIST = [
  NfcTech.NfcA,
  NfcTech.Ndef,
  NfcTech.IsoDep,
  NfcTech.MifareClassic,
] as const;

/**
 * Try to get a user ID from the tag's NDEF message (for phones/NDEF-only tags).
 * Returns the first text payload, or a payload from a record with our app type, or null.
 */
const getNdefUserId = async (): Promise<string | null> => {
  try {
    const ndef = await NfcManager.getNdefMessage();
    if (!ndef?.ndefMessage?.length) return null;

    // Prefer a record with our app-specific type
    for (const record of ndef.ndefMessage) {
      const type = record.tnf === Ndef.TNF_EXTERNAL_TYPE && record.type
        ? String.fromCharCode(...(Array.isArray(record.type) ? record.type : [record.type]))
        : '';
      if (type && type.toLowerCase().includes('nfc-card-detector')) {
        const payload = decodeNdefPayload(record.payload);
        if (payload) return payload.trim();
      }
    }

    // Fallback: first text record
    for (const record of ndef.ndefMessage) {
      if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) {
        const text = Ndef.text.decodePayload(record.payload);
        if (text) return text.trim();
      }
    }

    // Last resort: first record with any payload (treat as UTF-8 string)
    const first = ndef.ndefMessage[0];
    if (first?.payload?.length) {
      const decoded = decodeNdefPayload(first.payload);
      if (decoded) return decoded.trim();
    }
  } catch (e) {
    console.log('[NFC] NDEF read skipped or failed:', e);
  }
  return null;
};

/** Decode NDEF payload bytes to string (UTF-8). */
function decodeNdefPayload(payload: number[] | Uint8Array): string | null {
  if (!payload?.length) return null;
  try {
    const bytes = Array.isArray(payload) ? payload : [...payload];
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

/**
 * Read any NFC tag or device: physical cards (NfcA, MifareClassic), NDEF tags, or phones emulating NDEF/IsoDep.
 * Returns the formatted tag ID (or NDEF user ID) and basic metadata.
 */
const readRfidCard = async (): Promise<CardReadResult> => {
  if (Platform.OS === 'web') return null;

  try {
    const isEnabled = await NfcManager.isEnabled();
    if (!isEnabled) {
      console.log('[NFC] ⚠️ NFC is not enabled');
      return null;
    }

    // Request multiple techs so we support cards, NDEF tags, and phones (HCE/NDEF)
    await NfcManager.requestTechnology([...NFC_TECH_LIST]);

    const tag = await NfcManager.getTag();
    if (!tag) {
      console.log('[NFC] No tag found');
      return null;
    }

    console.log('[NFC] 🏷️ Tag detected:', JSON.stringify(tag, null, 2));

    const techList = tag.techTypes ?? [];
    const cardType = techList.join(', ') || 'Unknown NFC';

    // 1) Prefer tag UID (cards and many devices)
    let rawId: string | number[] | null = tag.id ?? null;
    let cardId = rawId != null ? formatCardId(rawId) : '';

    // 2) If no UID or UNKNOWN, try NDEF (phones / NDEF-only tags)
    if ((!cardId || cardId === 'UNKNOWN') && techList.some((t: string) => t?.toLowerCase?.().includes('ndef'))) {
      const ndefUserId = await getNdefUserId();
      if (ndefUserId) {
        cardId = ndefUserId;
        console.log('[NFC] 📋 User ID from NDEF:', cardId);
      }
    }

    if (!cardId || cardId === 'UNKNOWN') {
      console.log('[NFC] No usable ID from tag or NDEF');
      return null;
    }

    console.log('[NFC] 📋 Card/Device ID:', cardId);
    console.log('[NFC] 📋 Tech:', cardType);

    let additionalData: { sector?: number; block?: number; data?: string } | null = null;
    if (techList.some((t: string) => t?.includes?.('MifareClassic'))) {
      try {
        console.log('[NFC] Reading MIFARE Classic data...');
        additionalData = await readMifareClassicData(tag);
        if (additionalData) console.log('[NFC] ✓ MIFARE data read successfully');
      } catch (err) {
        console.log('[NFC] ⚠️ Could not read MIFARE data:', err);
      }
    }

    return {
      cardId,
      cardType,
      data: additionalData ?? undefined,
    };
  } catch (error: any) {
    if (error?.message?.includes('cancel') || error?.message?.includes('User')) {
      console.log('[NFC] Card read cancelled by user');
      return null;
    }
    console.log('[NFC] ❌ NFC read error:', error);
    return null;
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch (_) {}
  }
};

/**
 * Read data from MIFARE Classic card sectors
 * Note: This requires knowing the authentication keys
 * Most student cards use default keys: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]
 * @param tag - The tag object from getTag() (optional, will use current tag if not provided)
 */
const readMifareClassicData = async (tag?: any) => {
  try {
    const defaultKey = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff]; // Default MIFARE key
    const sector = 1; // Read from sector 1 (sector 0 is usually system data)
    const blockIndex = 4; // First block of sector 1

    // Technology is already requested in readRfidCard, so we can directly authenticate
    // The correct way to authenticate depends on the library version
    // For react-native-nfc-manager v3+, use:
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

export default function LandingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const { user, loading } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'ready' | 'scanning' | 'processing'>('ready');
  const appState = useRef(AppState.currentState);
  const isProcessingRef = useRef(false);

  const [isNfcReady, setIsNfcReady] = useState(false);
  const nfcInitializedRef = useRef(false);

  // Initialise NFC once when screen is mounted
  useEffect(() => {
    let isActive = true;

    const initNfc = async () => {
      // Skip on web platform
      if (Platform.OS === 'web') {
        console.log('[NFC] NFC not supported on web platform');
        return;
      }

      // Prevent multiple initializations
      if (nfcInitializedRef.current) {
        console.log('[NFC] NFC already initialized, skipping...');
        return;
      }

      try {
        console.log('[NFC] Initializing NFC Manager...');
        
        // Check if NFC manager is available
        if (!NfcManager || typeof (NfcManager as any).isSupported !== 'function') {
          console.log('[NFC] ❌ NFC manager native module not available');
          return;
        }

        const supported = await NfcManager.isSupported();
        if (!supported) {
          console.log('[NFC] ❌ NFC is not supported on this device');
          return;
        }
        
        console.log('[NFC] ✓ NFC is supported on this device');
        await NfcManager.start();
        nfcInitializedRef.current = true;
        console.log('[NFC] ✓ NFC Manager started');
        
        // Check if NFC is enabled
        const isEnabled = await NfcManager.isEnabled();
        if (!isEnabled) {
          console.log('[NFC] ⚠️ NFC is not enabled. Please enable NFC in device settings.');
          return;
        }

        console.log('[NFC] ✓ NFC is enabled and ready');

        if (isActive) {
          setIsNfcReady(true);
          console.log('[NFC] ✅ NFC Manager initialized successfully - Ready to scan for tags');
        }
      } catch (err) {
        console.log('[NFC] ❌ Error starting NFC manager:', err);
      }
    };

    initNfc();

    return () => {
      isActive = false;
      // Clean up NFC when component unmounts
      if (Platform.OS !== 'web' && nfcInitializedRef.current) {
        NfcManager.cancelTechnologyRequest().catch(() => {});
      }
    };
  }, []);

  // Continuous NFC scanning
  useEffect(() => {
    if (loading || user || !isNfcReady || Platform.OS === 'web') {
      // Don't scan if still loading, user is logged in, NFC not ready, or on web
      if (loading) {
        console.log('[NFC] ⏳ Waiting for auth to finish loading...');
      } else if (user) {
        console.log('[NFC] ⏸️ User is logged in - Skipping NFC scan');
      } else if (!isNfcReady) {
        console.log('[NFC] ⏳ Waiting for NFC to be ready...');
      } else if (Platform.OS === 'web') {
        console.log('[NFC] ⏸️ Web platform - NFC scanning disabled');
      }
      return;
    }

    console.log('[NFC] ✅ All conditions met - Starting NFC scanning effect');
    let isMounted = true;

    const startContinuousScanning = async () => {
      console.log('[NFC] 🔄 Starting continuous NFC scanning...');
      while (isMounted) {
        if (isProcessingRef.current) {
          // Wait a bit before trying again if we're processing
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        // Check if NFC is still enabled before each scan attempt
        try {
          const isEnabled = await NfcManager.isEnabled();
          if (!isEnabled) {
            console.log('[NFC] ⚠️ NFC disabled - waiting for re-enable...');
            // Wait longer if NFC is disabled
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        } catch (err) {
          console.log('[NFC] ⚠️ Error checking NFC status:', err);
          // If we can't check status, wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        try {
          setScanStatus('scanning');
          console.log('[NFC] 🔍 Scanning for NFC tags...');
          const cardData = await readRfidCard();

          if (!isMounted) break;

          if (cardData && cardData.cardId && cardData.cardId !== 'UNKNOWN') {
            isProcessingRef.current = true;
            setScanStatus('processing');
            console.log('[NFC] ✓ Card detected with ID:', cardData.cardId);
            console.log('[NFC] 🔍 Looking up user in Firebase...');

            // Look up the user by NFC ID in Firestore
            const matchedUser = await UserService.getUserByNfcId(cardData.cardId);

            if (!isMounted) break;

            if (!matchedUser) {
              console.log('[NFC] ❌ No user found in Firebase for NFC ID:', cardData.cardId);
              handleCardFailure('This card is not registered in the system.');
              isProcessingRef.current = false;
              setScanStatus('ready');
              // Wait before scanning again
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }

            console.log('[NFC] ✅ User found in Firebase!');
            console.log('[NFC] 👤 User details:', {
              uid: matchedUser.uid,
              email: matchedUser.email,
              name: `${matchedUser.FirstName} ${matchedUser.LastName}`,
              role: matchedUser.role,
            });
            console.log('[NFC] 🧭 Navigating to user-profile page...');

            // Navigate to profile screen, passing the NFC ID
            router.push({
              pathname: '/user-profile',
              params: { nfcId: cardData.cardId },
            });

            console.log('[NFC] ✅ Navigation completed - Stopping scan loop');
            // Don't reset processing flag - we're navigating away
            break;
          }

          // Small delay before next scan attempt
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.log('[NFC] ❌ Error during NFC scan:', error);
          if (isMounted) {
            setScanStatus('ready');
            // Wait a bit longer on error before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      console.log('[NFC] 🔄 Scanning loop ended');
    };

    startContinuousScanning();

    return () => {
      isMounted = false;
      isProcessingRef.current = false;
      if (Platform.OS !== 'web') {
        NfcManager.cancelTechnologyRequest().catch(() => {});
      }
    };
  }, [loading, user, router, isNfcReady]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to foreground - NFC will auto-resume via the scanning effect
        console.log('[NFC] App resumed - NFC scanning will continue');
      } else if (nextAppState === 'background') {
        // App going to background - cancel any ongoing NFC requests
        console.log('[NFC] App going to background - Cancelling NFC requests');
        if (Platform.OS !== 'web') {
          NfcManager.cancelTechnologyRequest().catch(() => {});
        }
        isProcessingRef.current = false;
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <ThemedView style={styles.container}>
        {/* Background Gradient Overlay */}
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

        <View style={[styles.content, styles.centerContent]}>
          {/* Logo */}
          <View style={styles.logoWrapper}>
            {isDark && <View style={styles.logoBackground} />}
            <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
          </View>

          {/* Loading Indicator */}
          <ActivityIndicator size="large" color="#00C8FC" style={styles.loadingSpinner} />
          <ThemedText style={styles.loadingText}>Preparing NFC reader…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const getStatusText = () => {
    switch (scanStatus) {
      case 'scanning':
        return 'Scanning for cards…';
      case 'processing':
        return 'Processing card…';
      default:
        return 'Ready to scan';
    }
  };

  const getStatusColor = () => {
    switch (scanStatus) {
      case 'processing':
        return '#00E676'; // Green
      case 'scanning':
        return '#00C8FC'; // Cyan
      default:
        return colors.text;
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Background Gradient Overlay */}
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

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.logoWrapper}>
          {isDark && <View style={styles.logoBackground} />}
          <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        </View>

        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
          Tap your card to begin
        </ThemedText>
        <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Hold your student or staff card near this device&apos;s NFC reader.
        </ThemedText>

        {/* NFC Reader Visual */}
        <View style={styles.readerContainer}>
          <View
            style={[
              styles.readerGlow,
              {
                borderColor: scanStatus === 'processing' ? '#00E67640' : '#00C8FC40',
                backgroundColor: isDark ? 'rgba(0, 200, 252, 0.06)' : 'rgba(0, 200, 252, 0.04)',
              },
            ]}
          />
          <View style={styles.readerCircle}>
            <View style={styles.readerInnerCircle}>
              {scanStatus === 'processing' ? (
                <ActivityIndicator size="large" color="#00E676" />
              ) : (
                <>
                  <View style={styles.readerWavesRow}>
                    <View style={[styles.readerWave, scanStatus === 'scanning' && styles.readerWaveActive]} />
                    <View style={[styles.readerWave, styles.readerWaveMiddle, scanStatus === 'scanning' && styles.readerWaveActive]} />
                    <View style={[styles.readerWave, scanStatus === 'scanning' && styles.readerWaveActive]} />
                  </View>
                  <ThemedText style={styles.readerIconText}>NFC</ThemedText>
                </>
              )}
            </View>
          </View>

          <ThemedText style={[styles.readerPromptTitle, { color: getStatusColor() }]}>
            {getStatusText()}
          </ThemedText>
          <ThemedText style={[styles.readerPromptSubtitle, { color: colors.textSecondary }]}>
            {scanStatus === 'scanning' 
              ? 'Bring the card close and keep it steady…'
              : scanStatus === 'processing'
              ? 'Verifying card information…'
              : 'The reader is active and waiting for your card.'
            }
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSpinner: {
    marginTop: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    opacity: 0.6,
    letterSpacing: 0.3,
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
    width: 400,
    height: 400,
    top: -150,
    right: -150,
  },
  circle2: {
    width: 350,
    height: 350,
    bottom: -120,
    left: -120,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  logoWrapper: {
    marginBottom: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBackground: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FFFFFF',
    shadowColor: '#00C8FC',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  logo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 18,
  },
  readerContainer: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    marginBottom: 32,
  },
  readerGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.5,
  },
  readerCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  readerInnerCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(0, 200, 252, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  readerWavesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  readerWave: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#00C8FC50',
  },
  readerWaveMiddle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderColor: '#00C8FC',
  },
  readerIconText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#00C8FC',
  },
  readerPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 4,
  },
  readerPromptSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  secondaryActions: {
    width: '100%',
    maxWidth: 340,
    marginTop: 16,
  },
  secondaryLabel: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
});

