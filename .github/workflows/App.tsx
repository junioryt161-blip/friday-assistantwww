import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, NativeEventEmitter, NativeModules } from 'react-native';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CommandEngine } from './src/services/CommandEngine';

const { FridayNativeModule } = NativeModules;
const eventEmitter = FridayNativeModule ? new NativeEventEmitter(FridayNativeModule) : null;

export default function App() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isServiceActive, setIsServiceActive] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [currentScreen, setCurrentScreen] = useState<'main' | 'settings'>('main');

  useEffect(() => {
    if (!eventEmitter) return;

    const cmdSub = eventEmitter.addListener('onCommandReceived', async (rawCommand: string) => {
      addLog(`User: "${rawCommand}"`);
      setStatus('Processing...');

      await CommandEngine.execute(rawCommand, (reply) => {
        addLog(`Friday: "${reply}"`);
        setStatus('Responding...');
        FridayNativeModule?.speak(reply);
      });
    });

    return () => cmdSub.remove();
  }, []);

  const addLog = (entry: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${entry}`, ...prev.slice(0, 9)]);
  };

  const toggleService = () => {
    if (!FridayNativeModule) return;

    if (isServiceActive) {
      FridayNativeModule.stopFridayService();
      setIsServiceActive(false);
      setStatus('OFF');
    } else {
      FridayNativeModule.startFridayService();
      setIsServiceActive(true);
      setStatus('Listening for "Friday"...');
    }
  };

  if (!isOnboarded) {
    return <OnboardingScreen onCompleted={() => setIsOnboarded(true)} />;
  }

  if (currentScreen === 'settings') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentScreen('main')}>
          <Text style={{ color: '#00E5FF' }}>← Back to Dashboard</Text>
        </TouchableOpacity>
        <SettingsScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>FRIDAY</Text>
        <TouchableOpacity onPress={() => setCurrentScreen('settings')}>
          <Text style={styles.settingsLink}>Settings</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.powerCircle, { borderColor: isServiceActive ? '#00E676' : '#FF1744' }]}
        onPress={toggleService}
      >
        <Text style={[styles.powerText, { color: isServiceActive ? '#00E676' : '#FF1744' }]}>
          {isServiceActive ? 'ONLINE' : 'OFFLINE'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.statusText}>{status}</Text>

      <View style={styles.logContainer}>
        <Text style={styles.logHeader}>Live Command Feed</Text>
        <FlatList
          data={logs}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => <Text style={styles.logItem}>{item}</Text>}
          ListEmptyComponent={<Text style={{ color: '#4F6785' }}>Tap the circle to start Friday.</Text>}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 24, paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appTitle: { fontSize: 24, fontWeight: 'bold', color: '#00E5FF', letterSpacing: 2 },
  settingsLink: { color: '#88A0BF', fontSize: 16 },
  powerCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 4,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 36,
  },
  powerText: { fontSize: 22, fontWeight: 'bold' },
  statusText: { textAlign: 'center', color: '#88A0BF', fontSize: 16, marginBottom: 20 },
  logContainer: { flex: 1, backgroundColor: '#131B2E', borderRadius: 12, padding: 16 },
  logHeader: { color: '#FFF', fontWeight: 'bold', marginBottom: 12, fontSize: 16 },
  logItem: { color: '#00E676', fontSize: 13, marginVertical: 4, fontFamily: 'monospace' },
  backBtn: { padding: 16, paddingTop: 40 },
});
