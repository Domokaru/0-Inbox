# Version History

## [1.0.2] - 2026-09-16
### Added
- **Custom Neon Icon:** Uploaded and integrated a vibrant new vector neon envelope icon (`app-icon.svg`) for the sign-in screen and app launcher.
- **Gmail REST API Integration:** Fully transitioned the backend from legacy IMAP to the official Google Gmail REST API (v1) for robust inbox loading, search queries, thread archiving, trashing, unread removal, and custom label modifications.

### Changed
- **Authentication Overhaul:** Replaced the direct IMAP App Password login flow with a secure, native **Google OAuth 2.0 Sign-In** implementation (`GoogleAuthManager.kt`).
- **UI Streamlining:** Removed the legacy IMAP setup dialogs and simplified the sign-in screen by centering the new Google Sign-In button and removing the redundant "Welcome to 0 INBOX" text.
- **Dependency Updates:** Cleaned up unused dependencies (`com.sun.mail`) and added Google Play Services Auth (`com.google.android.gms:play-services-auth:21.2.0`).

### Removed
- **Legacy IMAP:** Deleted obsolete files (`ImapAuthManager.kt`, `ImapMailRepository.kt`) and purged all IMAP state, menus, and clipboard helpers.

---

## [1.0.1] - 2026-09-15
### Changed
- Initial release of the 0 INBOX Android application featuring a Tinder-style swipeable interface for Gmail triage.
