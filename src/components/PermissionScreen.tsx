import React from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  cameraDenied: boolean;
  locationDenied: boolean;
  onRetry: () => void;
}

function openSettings() {
  // Linking.openSettings() has no web implementation — browsers manage
  // per-site camera/location permission via the address-bar padlock, not
  // an OS settings screen.
  if (Platform.OS === 'web') {
    Alert.alert(
      'Check browser permissions',
      "Click the lock or info icon in your browser's address bar, allow Camera and Location for this site, then reload the page."
    );
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
