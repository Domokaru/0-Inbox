package com.example.zeroinbox

import android.accounts.AccountManager
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import com.google.android.gms.common.AccountPicker
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.services.gmail.GmailScopes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthManager(private val context: Context) {

    companion object {
        private const val PREFS_NAME = "zero_inbox_auth_prefs"
        private const val KEY_SAVED_ACCOUNT = "saved_google_account"
        private const val WEB_CLIENT_ID = "683169336275-0n04hpf7nf0apm025u4midmdtuggass5.apps.googleusercontent.com"
    }

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val credentialManager = CredentialManager.create(context)

    /**
     * Retrieves any previously saved Google account email from SharedPreferences.
     */
    fun getSavedAccount(): String? {
        val saved = prefs.getString(KEY_SAVED_ACCOUNT, null)
        return if (!saved.isNullOrBlank()) saved else null
    }

    /**
     * Persists the selected or manually confirmed account email.
     */
    fun saveAccount(accountName: String) {
        prefs.edit().putString(KEY_SAVED_ACCOUNT, accountName.trim()).apply()
    }

    /**
     * Clears the saved account upon sign out.
     */
    fun clearAccount() {
        prefs.edit().remove(KEY_SAVED_ACCOUNT).apply()
    }

    /**
     * Reads existing Google accounts configured on this Android device (if accessible).
     */
    fun getAvailableGoogleAccounts(): List<String> {
        return try {
            val accountManager = AccountManager.get(context)
            val accounts = accountManager.getAccountsByType("com.google")
            accounts.map { it.name }.filter { it.isNotBlank() }
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Reads the SHA-1 or SHA-256 certificate fingerprint of the APK at runtime.
     * Useful for diagnostics and verifying against Google Cloud Console.
     */
    fun getCertificateFingerprint(algorithm: String = "SHA1"): String {
        return try {
            val packageInfo = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                context.packageManager.getPackageInfo(
                    context.packageName,
                    android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(
                    context.packageName,
                    android.content.pm.PackageManager.GET_SIGNATURES
                )
            }

            val signatures = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                packageInfo.signingInfo?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }

            val cert = signatures?.firstOrNull()?.toByteArray() ?: return "Unknown"
            val md = java.security.MessageDigest.getInstance(algorithm)
            val digest = md.digest(cert)
            digest.joinToString(":") { String.format("%02X", it) }
        } catch (e: Exception) {
            "Unavailable: ${e.message}"
        }
    }

    /**
     * Creates an Intent to launch Android's native Google Account Chooser dialog.
     * This allows the user to select from all Google accounts installed on the device.
     */
    fun createAccountPickerIntent(): Intent {
        return try {
            val credential = GoogleAccountCredential.usingOAuth2(
                context,
                listOf(GmailScopes.GMAIL_MODIFY)
            )
            credential.newChooseAccountIntent()
                ?: createFallbackAccountChooser()
        } catch (e: Throwable) {
            createFallbackAccountChooser()
        }
    }

    private fun createFallbackAccountChooser(): Intent {
        return try {
            val options = AccountPicker.AccountChooserOptions.Builder()
                .setAllowableAccountsTypes(listOf("com.google"))
                .setAlwaysShowAccountPicker(true)
                .build()
            AccountPicker.newChooseAccountIntent(options)
        } catch (t: Throwable) {
            AccountManager.newChooseAccountIntent(null, null, arrayOf("com.google"), null, null, null, null)
        }
    }

    /**
     * Modern Jetpack Credential Manager Sign-In attempt.
     */
    suspend fun signInWithCredentialManager(activity: Activity): String? = withContext(Dispatchers.IO) {
        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(WEB_CLIENT_ID)
            .setAutoSelectEnabled(false)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        try {
            val result: GetCredentialResponse = credentialManager.getCredential(
                request = request,
                context = activity
            )
            val credential = result.credential
            if (credential is CustomCredential &&
                credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
            ) {
                val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                val email = googleIdTokenCredential.id
                if (email.isNotBlank()) {
                    saveAccount(email)
                    return@withContext email
                }
            }
        } catch (e: Exception) {
            Log.w("AuthManager", "Credential Manager not available or cancelled: ${e.message}")
        }
        return@withContext null
    }
}

