import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, NativeModules } from 'react-native';
import { Camera } from 'expo-camera';
import * as Contacts from 'expo-contacts';
import * as MediaLibrary from 'expo-media-library';

const { FridayNativeModule } = NativeModules;

export const OnboardingScreen = ({ onCompleted }: { onCompleted: () => void }) => {
  const requestAllPermissions = async () => {
    try {
      await Camera.requestCameraPermissionsAsync();
      await Camera.requestMicrophonePermissionsAsync();
      await Contacts.requestPermissionsAsync();
      await MediaLibrary.requestPermissionsAsync();

      if (FridayNativeModule) {
        FridayNativeModule.requestOverlayPermission();
        FridayNativeModule.requestBatteryOptimizationExemption();
      }
    } catch (e) {
      console.log(e);
    }
    onCompleted();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Friday</Text>
      <Text style={styles.subtitle}>Your Always-On Voice Companion</Text>

      <ScrollView style={styles.card}>
        <Text style={styles.permissionItem}>✓ Microphone: 24/7 wake word detection</Text>
        <Text style={styles.permissionItem}>✓ Floating Overlay: Visual widget over all apps</Text>
        <Text style={styles.permissionItem}>✓ Battery Exemption: Runs reliably in background</Text>
        <Text style={styles.permissionItem}>✓ Contacts & Calls: Hands-free dialing</Text>
        <Text style={styles.permissionItem}>✓ Media & Camera: Voice intents & photography</Text>
      </ScrollView>

      <TouchableOpacity style={styles.button} onPress={requestAllPermissions}>
        <Text style={styles.buttonText}>Grant Permissions & Start</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 24, justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: 'bold', color: '#00E5FF', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#88A0BF', textAlign: 'center', marginBottom: 24 },
  card: { backgroundColor: '#131B2E', borderRadius: 12, padding: 16, maxHeight: 300 },
  permissionItem: { color: '#E0E6ED', fontSize: 15, marginVertical: 8 },
  button: { backgroundColor: '#00E5FF', padding: 18, borderRadius: 30, marginTop: 24 },
  buttonText: { textAlign: 'center', color: '#0A0E1A', fontWeight: 'bold', fontSize: 16 },
});
