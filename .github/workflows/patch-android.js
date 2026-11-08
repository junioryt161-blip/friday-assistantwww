const fs = require('fs');
const path = require('path');

// 1. Copy Kotlin files into the generated Android directory
const targetDir = path.join(__dirname, 'android/app/src/main/java/com/friday/assistant');
fs.mkdirSync(targetDir, { recursive: true });

const filesToCopy = ['FridayVoiceService.kt', 'FridayModule.kt', 'FridayPackage.kt'];
filesToCopy.forEach((file) => {
  const src = path.join(__dirname, 'android-custom', file);
  const dest = path.join(targetDir, file);
  fs.copyFileSync(src, dest);
});

// 2. Register Service in AndroidManifest.xml
const manifestPath = path.join(__dirname, 'android/app/src/main/AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');

const serviceDeclaration = `
    <service
        android:name=".FridayVoiceService"
        android:enabled="true"
        android:exported="false"
        android:foregroundServiceType="microphone" />
  </application>`;

manifest = manifest.replace('</application>', serviceDeclaration);
fs.writeFileSync(manifestPath, manifest, 'utf8');

// 3. Register Package in MainApplication.kt
const mainAppPath = path.join(targetDir, 'MainApplication.kt');
if (fs.existsSync(mainAppPath)) {
  let mainApp = fs.readFileSync(mainAppPath, 'utf8');
  mainApp = mainApp.replace(
    'PackageList(this).packages.apply {',
    'PackageList(this).packages.apply {\n              add(FridayPackage())'
  );
  fs.writeFileSync(mainAppPath, mainApp, 'utf8');
}

console.log('Successfully patched Android native files and manifest.');
