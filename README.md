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

### 3. Create OAuth Client ID (Web / Desktop App)
Zero Inbox uses standard OAuth 2.0 Web authorization (via AppAuth) rather than device-bound Google Play Services tokens. This allows you to log into any Google account through your default browser with standard consent screens.

1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Select **Desktop app** (or **Web application**) as the Application type.
4. Set the **Authorized redirect URI** to:
   ```text
   com.example.zeroinbox:/oauth2redirect
   ```
5. Click **Create**.
6. The app comes pre-configured with a default client ID, or you can supply your own client ID in the app settings. When you tap **Sign In With Google (Browser)**, the app opens Chrome Custom Tabs / your browser, where you log into whatever Google account is needed and grant permissions. Upon completion, Google redirects back to `com.example.zeroinbox:/oauth2redirect`, where the app exchanges the code for access and refresh tokens.

## 🏗️ Building Locally

To build the project locally, ensure you have Android Studio installed.

1. Clone the repository.
2. Open the project in Android Studio.
3. Sync Gradle files.
4. Build and run on an emulator or physical device running Android 8.0 (API 26) or higher.

The build relies on the included `debug.keystore` which Gradle will automatically use for the `assembleDebug` tasks.
