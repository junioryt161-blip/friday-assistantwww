import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, NativeEventEmitter, NativeModules } from 'react-native';

const { FridayNativeModule } = NativeModules;
const fridayEvents = FridayNativeModule ? new NativeEventEmitter(FridayNativeModule) : null;

export const SettingsScreen = () => {
  const [liveTranscript, setLiveTranscript] = useState('Press "Test Microphone" and speak...');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!fridayEvents) return;

    const speechSub = fridayEvents.addListener('onSpeechRecognized', (text) => {
      setLiveTranscript(`Recognized Final: "${text}"`);
    });

    const partialSub = fridayEvents.addListener('onPartialSpeech', (text) => {
      setLiveTranscript(`Hearing: "${text}"`);
    });

    return () => {
      speechSub.remove();
      partialSub.remove();
    };
  }, []);

  const toggleTest = () => {
    if (!FridayNativeModule) return;
    if (isTesting) {
      FridayNativeModule.stopFridayService();
      setIsTesting(false);
    } else {
      FridayNativeModule.startFridayService();
      setIsTesting(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Microphone Diagnostics</Text>

      <View style={styles.debugBox}>
        <Text style={styles.debugLabel}>Live Recognition Stream:</Text>
        <Text style={styles.transcript}>{liveTranscript}</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: isTesting ? '#FF3D00' : '#00E5FF' }]}
        onPress={toggleTest}
      >
        <Text style={styles.buttonText}>
          {isTesting ? 'Stop Mic Diagnostic' : 'Test Microphone'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginBottom: 20 },
  debugBox: { backgroundColor: '#131B2E', padding: 16, borderRadius: 10, minHeight: 180 },
  debugLabel: { color: '#88A0BF', fontSize: 14, marginBottom: 8 },
  transcript: { color: '#00E676', fontSize: 18, fontFamily: 'monospace' },
  button: { padding: 16, borderRadius: 10, marginTop: 20 },
  buttonText: { textAlign: 'center', fontWeight: 'bold', color: '#0A0E1A' },
});
