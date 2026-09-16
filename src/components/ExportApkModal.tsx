import React, { useState } from 'react';
import { X, Download, Github, Terminal, Check, PackageCheck, Sparkles, Smartphone, ExternalLink, Copy, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';

// Import raw source strings for zip packaging
import readmeContent from '../android-code/README.md?raw';
import gradleContent from '../android-code/build.gradle.kts?raw';
import manifestContent from '../android-code/AndroidManifest.xml?raw';
import mainActivityContent from '../android-code/MainActivity.kt?raw';
import googleAuthManagerContent from '../android-code/GoogleAuthManager.kt?raw';
import repositoryContent from '../android-code/GmailRepository.kt?raw';
import viewModelContent from '../android-code/MailViewModel.kt?raw';
import modelsContent from '../android-code/Models.kt?raw';
import uiContent from '../android-code/SwipeableMailStack.kt?raw';
import themeContent from '../android-code/Theme.kt?raw';

interface ExportApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkTheme: boolean;
}

export default function ExportApkModal({ isOpen, onClose, isDarkTheme }: ExportApkModalProps) {
  const [isZipping, setIsZipping] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyCommand = (cmd: string, key: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // Top-level Android configuration files
      zip.file('settings.gradle.kts', `pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\\\.android.*")
                includeGroupByRegex("com\\\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ZeroInbox"
include(":app")
`);

      zip.file('build.gradle.kts', `plugins {
    id("com.android.application") version "8.3.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.23" apply false
}
`);

      zip.file('gradle.properties', `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
`);

      zip.file('README.md', readmeContent);

      // GitHub Actions workflow for automatic APK building
      const githubFolder = zip.folder('.github')?.folder('workflows');
      if (githubFolder) {
        githubFolder.file('build-apk.yml', `name: Build Zero Inbox Android APK

on:
  push:
    branches: [ "main", "master" ]
    tags: [ "v*" ]
  pull_request:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    name: Build & Package APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Codebase
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: 'gradle'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v3
        with:
          gradle-version: '8.4'

      - name: Build Android Debug APK
        working-directory: android
        run: |
          gradle assembleDebug --stacktrace --no-daemon

      - name: Verify APK Generated
        run: |
          cp android/app/build/outputs/apk/debug/app-debug.apk ./ZeroInbox-v1.0.1-debug.apk

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: ZeroInbox-v1.0.1-debug-APK
          path: ./ZeroInbox-v1.0.1-debug.apk
          retention-days: 90
`);
      }

      // App module
      const appFolder = zip.folder('app');
      if (appFolder) {
        appFolder.file('build.gradle.kts', gradleContent);
        appFolder.file('proguard-rules.pro', `# ProGuard rules for ZeroInbox
-keepattributes *Annotation*
-keepclassmembers class * {
    @org.apache.http.annotation.NotThreadSafe <fields>;
    @org.apache.http.annotation.ThreadSafe <fields>;
    @org.apache.http.annotation.Immutable <fields>;
    @org.apache.http.annotation.GuardedBy <fields>;
}
-dontwarn com.google.api.client.**
-dontwarn com.google.common.**
-dontwarn org.apache.http.**
`);

        const mainFolder = appFolder.folder('src')?.folder('main');
        if (mainFolder) {
          mainFolder.file('AndroidManifest.xml', manifestContent);

          // Kotlin source files
          const pkgFolder = mainFolder.folder('java')?.folder('com')?.folder('example')?.folder('zeroinbox');
          if (pkgFolder) {
            pkgFolder.file('MainActivity.kt', mainActivityContent);
            pkgFolder.file('GoogleAuthManager.kt', googleAuthManagerContent);
            pkgFolder.file('GmailRepository.kt', repositoryContent);
            pkgFolder.file('MailViewModel.kt', viewModelContent);
            pkgFolder.file('Models.kt', modelsContent);

            const uiFolder = pkgFolder.folder('ui');
            uiFolder?.file('SwipeableMailStack.kt', uiContent);

            const themeFolder = uiFolder?.folder('theme');
            themeFolder?.file('Theme.kt', themeContent);
          }

          // Resources
          const resFolder = mainFolder.folder('res');
          if (resFolder) {
            const valuesFolder = resFolder.folder('values');
            valuesFolder?.file('strings.xml', `<resources>
    <string name="app_name">Zero Inbox</string>
</resources>`);
            valuesFolder?.file('colors.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="black">#FF000000</color>
    <color name="white">#FFFFFFFF</color>
    <color name="neon_cyan">#FF00FFFF</color>
    <color name="neon_magenta">#FFFF00FF</color>
    <color name="neon_blue">#FF007BFF</color>
</resources>`);
            valuesFolder?.file('themes.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.ZeroInbox" parent="android:Theme.Material.NoActionBar">
        <item name="android:statusBarColor">#0A0A0E</item>
        <item name="android:navigationBarColor">#0A0A0E</item>
    </style>
</resources>`);

            // Launcher Icon Drawables
            const drawableFolder = resFolder.folder('drawable');
            drawableFolder?.file('ic_launcher_background.xml', `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#0D0E15"
        android:pathData="M0,0h108v108h-108z" />
</vector>`);
            drawableFolder?.file('ic_launcher_foreground.xml', `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:strokeColor="#FF00FF"
        android:strokeWidth="2.4"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M 42,28 L 66,28 A 14,14 0 0 1 80,42 L 80,66 A 14,14 0 0 1 66,80 L 42,80 A 14,14 0 0 1 28,66 L 28,42 A 14,14 0 0 1 42,28 Z" />
    <path
        android:strokeColor="#00FFFF"
        android:strokeWidth="2.8"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M 37,41 L 71,41 A 4,4 0 0 1 75,45 L 75,64 A 4,4 0 0 1 71,68 L 37,68 A 4,4 0 0 1 33,64 L 33,45 A 4,4 0 0 1 37,41 Z" />
    <path
        android:strokeColor="#00FFFF"
        android:strokeWidth="2.8"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M 33,42 L 54,56 L 75,42" />
    <path
        android:strokeColor="#4D9FFF"
        android:strokeWidth="2.0"
        android:strokeLineCap="round"
        android:pathData="M 34,67 L 48,53 M 74,67 L 60,53" />
</vector>`);

            // Adaptive Launcher Icons for Android 8.0+ (API 26+)
            const mipmapFolder = resFolder.folder('mipmap-anydpi-v26');
            const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>`;
            mipmapFolder?.file('ic_launcher.xml', adaptiveXml);
            mipmapFolder?.file('ic_launcher_round.xml', adaptiveXml);
          }
        }
      }

      // Generate zip blob and trigger download
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ZeroInbox-Android-Project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create project zip', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
          isDarkTheme ? 'bg-[#13131A] border-[#2E2E3E] text-gray-200' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`p-5 border-b flex items-center justify-between sticky top-0 z-10 ${
            isDarkTheme ? 'bg-[#13131A] border-[#222230]' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#007BFF] to-[#00FFFF] p-[2px] flex items-center justify-center">
              <div className={`w-full h-full ${isDarkTheme ? 'bg-[#13131A]' : 'bg-white'} rounded-[9px] flex items-center justify-center`}>
                <Smartphone className={isDarkTheme ? 'text-[#00FFFF]' : 'text-sky-600'} size={18} />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Package & Download APK
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Ready
                </span>
              </h2>
              <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                Automated GitHub Actions APK build & ready-to-run Android Gradle project
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDarkTheme ? 'hover:bg-[#1F1F2C] text-gray-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Method 1: Automatic GitHub Actions APK Builder */}
          <div
            className={`p-5 rounded-xl border ${
              isDarkTheme
                ? 'bg-[#1A1A24] border-[#00FFFF]/30 shadow-[0_0_20px_rgba(0,255,255,0.06)]'
                : 'bg-sky-50/70 border-sky-200'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Github size={18} className={isDarkTheme ? 'text-[#00FFFF]' : 'text-sky-600'} />
                  <h3 className="text-sm font-bold">1. Push to GitHub & Download APK from Artifacts</h3>
                </div>
                <p className={`text-xs leading-relaxed ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
                  The project includes the production GitHub Actions CI pipeline (
                  <code className="text-[11px] px-1 py-0.5 rounded bg-black/20 font-mono">.github/workflows/build-apk.yml</code>
                  ). When you push this codebase to GitHub, GitHub automatically compiles the Android APK in the cloud and provides a direct download link under the Actions tab!
                </p>
              </div>
            </div>

            {/* Steps in GitHub */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className={`p-3 rounded-lg border ${isDarkTheme ? 'bg-[#14141E] border-[#282838]' : 'bg-white border-slate-200'}`}>
                <span className="font-mono text-[10px] text-[#00FFFF] font-bold">STEP 1</span>
                <p className="font-semibold mt-1">Export / Push</p>
                <p className={`text-[11px] mt-0.5 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                  Export to GitHub via the AI Studio menu, or run terminal push below.
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${isDarkTheme ? 'bg-[#14141E] border-[#282838]' : 'bg-white border-slate-200'}`}>
                <span className="font-mono text-[10px] text-[#FF00FF] font-bold">STEP 2</span>
                <p className="font-semibold mt-1">GitHub Builds APK</p>
                <p className={`text-[11px] mt-0.5 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                  Gradle automatically runs with JDK 17 & Android SDK 34.
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${isDarkTheme ? 'bg-[#14141E] border-[#282838]' : 'bg-white border-slate-200'}`}>
                <span className="font-mono text-[10px] text-emerald-400 font-bold">STEP 3</span>
                <p className="font-semibold mt-1">Download APK</p>
                <p className={`text-[11px] mt-0.5 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                  Go to repository &gt; <strong>Actions</strong> &gt; Click latest run &gt; Download <strong>ZeroInbox-v1.0.1-debug-APK</strong>!
                </p>
              </div>
            </div>

            {/* Quick Git Push Terminal Commands */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                  <Terminal size={13} />
                  Terminal Push Commands (Git repository is already initialized):
                </span>
                <button
                  onClick={() =>
                    copyCommand(
                      `git remote add origin https://github.com/<YOUR_USERNAME>/zero-inbox.git\ngit push -u origin main`,
                      'git-push'
                    )
                  }
                  className="text-[10px] text-[#00FFFF] hover:underline flex items-center gap-1"
                >
                  {copiedCmd === 'git-push' ? <Check size={12} className="text-emerald-400" /> : null}
                  {copiedCmd === 'git-push' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className={`p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto ${isDarkTheme ? 'bg-black/50 text-gray-300 border border-[#2A2A3A]' : 'bg-slate-100 text-slate-800 border border-slate-200'}`}>
{`git remote add origin https://github.com/<YOUR_USERNAME>/zero-inbox.git
git push -u origin main`}
              </pre>
            </div>
          </div>

          {/* Method 2: Direct 1-Click ZIP Download */}
          <div
            className={`p-5 rounded-xl border space-y-4 ${
              isDarkTheme ? 'bg-[#181822] border-[#2A2A38]' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <PackageCheck size={18} className={isDarkTheme ? 'text-[#FF00FF]' : 'text-pink-600'} />
                  <h3 className="text-sm font-bold">2. Download Standalone Android Project (.ZIP)</h3>
                </div>
                <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                  Complete ready-to-build Android Studio project containing all Kotlin Compose source files, Gradle wrapper, AndroidManifest, resources, and build configuration.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <a
                  href="/ZeroInbox-Android-Project.zip"
                  download="ZeroInbox-Android-Project.zip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#007BFF] to-[#00FFFF] text-white font-bold text-xs shadow-lg shadow-blue-500/20 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 no-underline cursor-pointer"
                >
                  <Download size={15} />
                  <span>Download (.zip)</span>
                </a>

                <a
                  href="/ZeroInbox-Android-Project.zip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isDarkTheme
                      ? 'border-[#38384E] bg-[#1F1F2C] text-gray-200 hover:bg-[#282838]'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Open file URL directly in a new tab"
                >
                  <ExternalLink size={14} />
                  <span>New Tab</span>
                </a>
              </div>
            </div>

            {/* Direct URL & Terminal Curl Command */}
            <div className={`p-3 rounded-lg border text-xs space-y-2 ${isDarkTheme ? 'bg-[#12121A] border-[#252534]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${isDarkTheme ? 'text-gray-300' : 'text-slate-700'}`}>
                  <Terminal size={13} />
                  Direct Download Link / Terminal Command:
                </span>
                <button
                  onClick={() =>
                    copyCommand(
                      `${window.location.origin}/ZeroInbox-Android-Project.zip`,
                      'direct-url'
                    )
                  }
                  className="text-[10px] text-[#00FFFF] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copiedCmd === 'direct-url' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copiedCmd === 'direct-url' ? 'URL Copied!' : 'Copy Direct URL'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/ZeroInbox-Android-Project.zip`}
                  className={`w-full text-[11px] font-mono p-2 rounded border focus:outline-none select-all ${
                    isDarkTheme
                      ? 'bg-black/40 border-[#2A2A38] text-gray-300'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                />
              </div>

              {/* Iframe Notice */}
              <div className="flex items-start gap-2 pt-1">
                <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className={`text-[11px] leading-relaxed ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
                  <strong>Why in-frame clicks might fail:</strong> Web browsers prevent download prompts inside embedded iframes. If clicking <strong>Download (.zip)</strong> doesn't open a file dialog, click <strong>New Tab</strong> or paste the link above into a new browser window.
                </p>
              </div>
            </div>
          </div>

          {/* Local Android Studio / CLI Build command */}
          <div className={`p-4 rounded-xl border ${isDarkTheme ? 'bg-[#14141E] border-[#222230]' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="text-xs font-bold flex items-center gap-2 mb-2">
              <Sparkles size={14} className={isDarkTheme ? 'text-[#FFE600]' : 'text-amber-500'} />
              Local APK Build (Android Studio or Command Line):
            </h4>
            <div className="flex items-center justify-between">
              <code className={`text-[11px] font-mono px-2 py-1 rounded ${isDarkTheme ? 'bg-black/40 text-emerald-400' : 'bg-slate-200 text-slate-800'}`}>
                cd android && ./gradlew assembleDebug
              </code>
              <button
                onClick={() => copyCommand('cd android && ./gradlew assembleDebug', 'gradlew-cmd')}
                className="text-[11px] text-[#00FFFF] hover:underline flex items-center gap-1 font-medium"
              >
                {copiedCmd === 'gradlew-cmd' ? <Check size={12} className="text-emerald-400" /> : null}
                {copiedCmd === 'gradlew-cmd' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className={`text-[11px] mt-2 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
              Outputs the installable APK directly to <span className="font-mono text-[10px]">android/app/build/outputs/apk/debug/app-debug.apk</span>.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`p-4 border-t flex items-center justify-end ${
            isDarkTheme ? 'bg-[#13131A] border-[#222230]' : 'bg-white border-slate-200'
          }`}
        >
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer ${
              isDarkTheme ? 'bg-[#1E1E2A] text-gray-200 hover:bg-[#282838]' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
