import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { UserService } from '@/services/userService';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, View, AppState } from 'react-native';
import NfcManager, { NfcTech, NfcEvents } from 'react-native-nfc-manager';

type CardReadResult = {
  cardId: string;
  cardType: string;
  data?: any;
} | null;

/**
 * Read a generic NFC / RFID card.
 * Returns the formatted card ID and basic metadata.
 */
const readRfidCard = async (): Promise<CardReadResult> => {
  try {
    // Request NFC technology - using NfcA / MifareClassic for most student RFID cards
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
    const defaultKey = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff]; // Default MIFARE key
    const sector = 1; // Read from sector 1 (sector 0 is usually system data)
    const blockIndex = 4; // First block of sector 1

    // Authenticate with the sector using the correct API
    // Use MifareClassicHandlerAndroid for Android-specific operations
    const tech = await NfcManager.requestTechnology(NfcTech.MifareClassic);
    
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

  // Initialise NFC once when screen is mounted
  useEffect(() => {
    let isActive = true;

    const initNfc = async () => {
      try {
        const supported = await NfcManager.isSupported();
        if (!supported) {
          console.log('NFC is not supported on this device');
          return;
        }
        
        await NfcManager.start();
        console.log('NFC Manager started successfully');
      } catch (err) {
        console.log('Error starting NFC manager:', err);
      }
    };

    initNfc();

    return () => {
      isActive = false;
    };
  }, []);

  // Redirect already logged-in users based on their status
  useEffect(() => {
    if (!loading && user) {
      // Check if user is approved and active
      if (!user.isApproved || !user.isActive) {
        router.replace('/pending-approval');
        return;
      }

      // Redirect to appropriate dashboard
      if (user.role === 'admin') {
        router.replace('/(admin)/students');
      } else if (user.role === 'staff') {
        router.replace('/(staff)/my-card');
      } else if (user.role === 'student') {
        router.replace('/(student)/my-card');
      }
    }
  }, [user, loading]);

  // Continuous NFC scanning
  useEffect(() => {
    if (loading || user) {
      // Don't scan if still loading or user is logged in
      return;
    }

    let isMounted = true;

    const startContinuousScanning = async () => {
      while (isMounted) {
        if (isProcessingRef.current) {
          // Wait a bit before trying again if we're processing
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        try {
          setScanStatus('scanning');
          const cardData = await readRfidCard();

          if (!isMounted) break;

          if (cardData && cardData.cardId && cardData.cardId !== 'UNKNOWN') {
            isProcessingRef.current = true;
            setScanStatus('processing');

            // Look up the user by NFC ID in Firestore
            const matchedUser = await UserService.getUserByNfcId(cardData.cardId);

            if (!isMounted) break;

            if (!matchedUser) {
              handleCardFailure('This card is not registered in the system.');
              isProcessingRef.current = false;
              setScanStatus('ready');
              // Wait before scanning again
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }

            // Navigate to profile screen, passing the NFC ID
            router.push({
              pathname: '/user-profile',
              params: { nfcId: cardData.cardId },
            });

            // Don't reset processing flag - we're navigating away
            break;
          }

          // Small delay before next scan attempt
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.log('Error during NFC scan:', error);
          if (isMounted) {
            setScanStatus('ready');
            // Wait a bit longer on error before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    };

    startContinuousScanning();

    return () => {
      isMounted = false;
      isProcessingRef.current = false;
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, [loading, user, router]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to foreground - NFC will auto-resume via the scanning effect
        console.log('App resumed - NFC scanning will continue');
      } else if (nextAppState === 'background') {
        // App going to background - cancel any ongoing NFC requests
        NfcManager.cancelTechnologyRequest().catch(() => {});
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

