# 0 INBOX - Android Client Architecture & Setup Guide

Welcome to the comprehensive source code deliverable for **0 INBOX**, a modern Jetpack Compose Android client designed to rapidly achieve Inbox Zero through fluid swipe triage.

This package contains all Kotlin files, Gradle build scripts, AndroidManifest configurations, and design systems for both **Neon Dark Theme** and **Pastel Light Theme**.

---

## 1. App Identity & Design System

*   **Logo & Identity:** 8-bit visual pixel-art typography where all characters (`0` and `INBOX`) share the exact same height scale, with visible blocky square pixels.
*   **Cross-Hatch Slashed Zero (Ø):** The number zero features a classic retro diagonal cross-hatch pixel slash.
*   **Double-Tap Header Settings:** Double-tapping directly on the pixel `0 INBOX` header opens the in-app Settings menu to seamlessly toggle between **Dark Theme** and **Light Theme** (clean minimal header with no helper text).
*   **Dark Theme:** Deep dark canvas (`#0F0F13`) accented with vivid Neon Cyan (`#00FFFF`), Neon Magenta (`#FF00FF`), and Electric Blue (`#007BFF`).
*   **Light Theme:** Pure crisp white background (`#FFFFFF`) featuring soft pastel accents (Pastel Sky Cyan `#0EA5E9`, Pastel Rose `#EC4899`, Pastel Royal Blue `#3B82F6`) and high-contrast slate typography (`#0F172A`) for effortless legibility.
*   **Swipe Popups:** Screen-centered circular overlays showing **strictly the neon or pastel colored action icon** alone with no text, subtitles, or labels, lasting under 1 second.

---

## 2. Google Cloud Console Setup

To authenticate users and access the Gmail API via Jetpack Credential Manager:

### Step 1: Create a Project & Enable APIs
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "0 INBOX Client").
3. Go to **APIs & Services > Library**.
4. Search for **Gmail API** and click **Enable**.

### Step 2: Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select **External** (or Internal if you have a Google Workspace).
3. Fill in the required app information (App Name: `0 INBOX`, Support Email, Developer Contact).
4. In the **Scopes** section, add: `https://www.googleapis.com/auth/gmail.modify`.
5. Add your personal Google account under **Test users**.

### Step 3: Create Credentials (Android & Web)
Modern Jetpack Credential Manager (`androidx.credentials`) requires an Android Client ID paired with a Web Client ID for OAuth token resolution:

1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. **For Android:**
   * Select **Android** as Application type.
   * Name: `0 INBOX Android Client`
   * Package name: `com.example.zeroinbox`
   * SHA-1 Certificate Fingerprint: 
     * *Run `./gradlew signingReport` in Android Studio and copy the debug SHA-1 key.*
   * Click **Create**.
4. **For Web (Required for Credential Manager):**
   * Click **Create Credentials > OAuth client ID**.
   * Select **Web application**.
   * Name: `0 INBOX Web Client`
   * Click **Create** and copy the generated `Client ID`.
   * Paste this into `YOUR_WEB_CLIENT_ID` in `AuthManager.kt`.

---

## 3. Project Architecture Overview

*   **Architecture:** Clean MVVM (Model-View-ViewModel)
*   **UI Framework:** Jetpack Compose (100% declarative UI)
*   **Asynchronous Engine:** Kotlin Coroutines with `StateFlow` and `Dispatchers.IO`
*   **Authentication:** Jetpack `androidx.credentials` (Credential Manager)
*   **API Client:** Google API Client for Android (`com.google.apis:google-api-services-gmail`)

### 4-Way Swipe Triage
Cards are swiped using Compose `pointerInput` and `detectDragGestures`:
*   **Right:** Archive (`ModifyThreadRequest().setRemoveLabelIds(listOf("INBOX"))`)
*   **Left:** Delete / Trash (`threads().trash("me", threadId)`)
*   **Up:** Needs Update / Response Label (`threads().modify(addLabel = "Needs Update")` represented by a pen writing icon)
*   **Down:** Mark Read / Keep in Inbox (`ModifyThreadRequest().setRemoveLabelIds(listOf("UNREAD"))`)

### Instant Snackbar with "Undo"
*   Swiping any email displays a floating Material 3 `SnackbarHost` at the bottom of the screen.
*   The Snackbar features an **UNDO** action button.
*   Tapping **UNDO** triggers `viewModel.undoLastAction()`, instantly restoring the email back to the top of the Compose swipe stack and asynchronously reversing the Gmail API call in the background.

### Unread Inbox Counter & Inbox Zero Celebration
*   **Unread Counter:** Positioned directly under the swipe cards and above the bottom action icons, clearly displaying current unread emails in the inbox.
*   **Inbox Zero Celebration:** When the count hits 0, a celebratory neon explosion occurs and a prominent pixelated "0" (`BigPixelZero`) is rendered in the center of the screen with glowing theme accents.

---

Navigate through the files in the sidebar to review, test, or copy the production-ready code!
