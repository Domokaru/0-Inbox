# Zero Inbox

A modern, gesture-driven Android email client designed to help you reach "Inbox Zero" with speed and style. Built entirely with Kotlin and Jetpack Compose, Zero Inbox features a Tinder-style swipeable interface for rapidly triaging your Gmail inbox.

## 🚀 Features & Functionality

*   **4-Way Swipe Triage**: Rapidly process your emails using intuitive gestures (Archive, Trash, Mark Read/Unread, and Custom Labels).
*   **Direct Custom Labeling**: Easily categorize emails into your existing Gmail labels directly from the swipe interface.
*   **Undo Actions**: Made a mistake? Material 3 snackbars provide a quick "Undo" option for destructive actions.
*   **Dual Themes**: Toggle between a high-contrast Retro Neon Dark mode and a clean Pastel Light mode.
*   **Demo Mode**: Want to try the interface without connecting your Google account? Enable "Demo Mode" to interact with a mock inbox.
*   **Time Filters**: Focus on what's important by filtering your inbox to only show emails from the "Last 2 Days".
*   **Native Android Architecture**: Built using Jetpack Compose, Kotlin Coroutines, and the modern Android Credential Manager for secure, seamless Google Sign-In.

## 🛠️ Limitations

*   **Gmail Only**: This application is strictly integrated with the Google REST API and currently only supports Gmail accounts. It does not support IMAP/POP3 for Outlook, Yahoo, or custom domain emails.
*   **Triage-Focused**: Zero Inbox is purpose-built for inbox organization (archiving, trashing, labeling). It currently does not support composing new emails or replying to threads.
*   **API Quotas**: Because it relies on the official Gmail API, standard Google Cloud quota limits apply. Extremely heavy usage could temporarily rate-limit syncs.
*   **Local Caching**: The app pulls recent emails for quick triage but is not designed as a full offline archive of your entire email history.

## ⚙️ Google Cloud & OAuth Setup

To build and run this app with your own Gmail account, you must configure a Google Cloud Project with the Gmail API enabled.

### 1. Enable the Gmail API
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services** > **Library**.
4. Search for **Gmail API** and click **Enable**.

### 2. Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** (unless you have a Google Workspace org).
3. Fill in the required app details (App Name, Support Email).
4. **Important:** If your app is in "Testing" mode, you *must* add your personal Gmail address to the **Test users** list, or you will not be able to log in.

### 3. Create OAuth Client ID (Android Application)
Zero Inbox uses native Google Play Services Google Sign-In on Android. Google Play Services verifies your app cryptographically using your **Package Name** and **SHA-1 Fingerprint**:

1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. In the **Application type** dropdown, select **Android** (do *not* choose Desktop app or Web application).
4. Fill in the fields:
   * **Name:** `Zero Inbox Android Client`
   * **Package name:** `com.example.zeroinbox`
   * **SHA-1 certificate fingerprint:** `D1:4C:EC:9B:48:D5:FB:13:D3:4B:9E:45:3D:32:0F:9C:FA:8F:F3:65`
5. Click **Create**.

> 💡 **Tip for GitHub Actions Builds:** If you built your APK via GitHub Actions before the bundled keystore was present, or using a fallback GitHub runner, create a second Android client ID with the GitHub runner SHA-1 fingerprint:
> `87:D1:D4:79:4B:29:DD:C4:78:4A:D3:C7:AD:02:E7:E6:51:FB:41:FB`
> Having both fingerprints registered in Google Cloud Console guarantees sign-in works whether built locally in Android Studio or automatically via GitHub Actions!

### 4. Important: Add Your Email to Test Users
While your Google Cloud OAuth Consent Screen is in **Testing** status (the default), Google will block any Google account that is not explicitly whitelisted:
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Scroll down to **Test users**.
3. Click **+ ADD USERS**.
4. Type your Gmail address (the one you are signing into on your phone).
5. Click **Save**.

## 🏗️ Building Locally

To build the project locally, ensure you have Android Studio installed.

1. Clone the repository.
2. Open the project in Android Studio.
3. Sync Gradle files.
4. Build and run on an emulator or physical device running Android 8.0 (API 26) or higher.

The build relies on the included `debug.keystore` which Gradle will automatically use for the `assembleDebug` tasks.
