import React from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  cameraDenied: boolean;
  locationDenied: boolean;
  onRetry: () => void;
}

function openSettings() {
  // Linking.openSettings() has no web implementation, and no web page can
  // programmatically open a browser's or OS's settings screen — browsers
  // block that for security. The best we can do is tell the user exactly
  // where to look, which differs depending on whether this is running as
  // the installed app (no address bar to tap) or a normal browser tab.
  if (Platform.OS === 'web') {
    const isStandalone =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;

    const message = isStandalone
      ? "This is the installed app, so there's no address bar to tap. On Android: long-press this app's icon on your home screen, open \"App info\", then \"Permissions\", and turn on Camera and Location. Then reopen the app."
      : "Tap the lock or info icon just left of the web address at the top of the screen, turn on Camera and Location for this site, then reload the page.";

    // window.alert is used directly (rather than RN's Alert.alert) because
    // its web rendering isn't guaranteed to be visible across platforms.
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message);
    } else {
      Alert.alert('Check permissions', message);
    }
    return;
  }
  Linking.openSettings();
}

export default function PermissionScreen({ cameraDenied, locationDenied, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Permissions required</Text>
      <Text style={styles.body}>
        GeoField Camera needs camera and precise (fine) location access to record where each
        fieldwork photo was taken. Without both, photos cannot be geotagged.
      </Text>

      {cameraDenied && (
        <View style={styles.row}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.rowText}>Camera access was denied.</Text>
        </View>
      )}
      {locationDenied && (
        <View style={styles.row}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.rowText}>
            Precise location access was denied. Make sure "Precise Location" is enabled.
          </Text>
        </View>
      )}

      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.secondaryButton]} onPress={openSettings}>
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Open device settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  bullet: {
    color: '#FF6B6B',
    marginRight: 8,
  },
  rowText: {
    color: '#FF6B6B',
    fontSize: 13,
    flex: 1,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#2C2C2E',
  },
  buttonText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
  },
});
