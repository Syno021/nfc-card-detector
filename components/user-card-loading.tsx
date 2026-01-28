import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

interface UserCardLoadingProps {
  color?: string;
  message?: string;
}

export function UserCardLoading({ color, message = 'Loading your card...' }: UserCardLoadingProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const indicatorColor = color || '#00C8FC';

  return (
    <ThemedView style={styles.container}>
      {/* Background Gradient Overlay */}
      <View style={styles.gradientOverlay}>
        <View style={[styles.circle, styles.circle1, { backgroundColor: '#00C8FC', opacity: isDark ? 0.08 : 0.12 }]} />
        <View style={[styles.circle, styles.circle2, { backgroundColor: '#00C8FC', opacity: isDark ? 0.08 : 0.12 }]} />
      </View>

      <View style={styles.loadingContainer}>
        {/* Logo */}
        <View style={styles.logoWrapper}>
          {isDark && (
            <View style={styles.logoBackground} />
          )}
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
          />
        </View>

        <ActivityIndicator size="large" color={indicatorColor} style={styles.spinner} />
        <ThemedText style={styles.loadingText}>{message}</ThemedText>
      </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBackground: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFFFFF',
    shadowColor: '#00C8FC',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    zIndex: 1,
  },
  spinner: {
    marginTop: 16,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 16,
    letterSpacing: 0.3,
  },
});

