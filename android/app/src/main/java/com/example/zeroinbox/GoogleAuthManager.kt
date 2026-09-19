package com.example.zeroinbox

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Handles Google OAuth 2.0 Sign-In and Token acquisition for Gmail API access.
 */
class GoogleAuthManager(private val context: Context) {

    companion object {
        const val GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify"
        const val GMAIL_SETTINGS_SCOPE = "https://www.googleapis.com/auth/gmail.settings.basic"
        private const val PREFS_NAME = "google_auth_prefs"
        private const val KEY_USER_EMAIL = "google_user_email"
        private const val KEY_ACCESS_TOKEN = "google_access_token"
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getGoogleSignInClient(activity: Activity): GoogleSignInClient {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(Scope(GMAIL_SCOPE), Scope(GMAIL_SETTINGS_SCOPE))
            .build()
        return GoogleSignIn.getClient(activity, gso)
    }

    fun getSavedAccount(): GoogleSignInAccount? {
        return GoogleSignIn.getLastSignedInAccount(context)
    }

    fun getSavedEmail(): String? {
        return getSavedAccount()?.email ?: prefs.getString(KEY_USER_EMAIL, null)
    }

    fun isConfigured(): Boolean {
        return getSavedEmail() != null
    }

    fun saveUserEmail(email: String) {
        prefs.edit().putString(KEY_USER_EMAIL, email).apply()
    }

    fun saveAccessToken(token: String) {
        prefs.edit().putString(KEY_ACCESS_TOKEN, token).apply()
    }

    fun getStoredAccessToken(): String? {
        return prefs.getString(KEY_ACCESS_TOKEN, null)
    }

    fun hasExistingCredentials(): Boolean {
        return getSavedAccount() != null || !getSavedEmail().isNullOrBlank() || !getStoredAccessToken().isNullOrBlank()
    }

    fun invalidateCurrentToken() {
        val token = getStoredAccessToken()
        if (!token.isNullOrBlank()) {
            try {
                GoogleAuthUtil.invalidateToken(context, token)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        prefs.edit().remove(KEY_ACCESS_TOKEN).apply()
    }

    suspend fun getOrRefreshOAuthToken(forceRefresh: Boolean = false): String? = withContext(Dispatchers.IO) {
        if (forceRefresh) {
            invalidateCurrentToken()
        }
        val storedToken = getStoredAccessToken()
        if (!storedToken.isNullOrBlank()) {
            return@withContext storedToken
        }
        val account = getSavedAccount()
        if (account?.account != null) {
            try {
                val scopeStr = "oauth2:$GMAIL_SCOPE $GMAIL_SETTINGS_SCOPE"
                val token = GoogleAuthUtil.getToken(context, account.account!!, scopeStr)
                if (token != null) {
                    saveAccessToken(token)
                    account.email?.let { saveUserEmail(it) }
                    return@withContext token
                }
            } catch (e: Exception) {
                // Fallback to single scope if settings basic not yet granted
                try {
                    val scopeStrFallback = "oauth2:$GMAIL_SCOPE"
                    val tokenFallback = GoogleAuthUtil.getToken(context, account.account!!, scopeStrFallback)
                    if (tokenFallback != null) {
                        saveAccessToken(tokenFallback)
                        account.email?.let { saveUserEmail(it) }
                        return@withContext tokenFallback
                    }
                } catch (e2: Exception) {
                    e2.printStackTrace()
                }
            }
        }
        null
    }

    suspend fun fetchOAuthToken(account: GoogleSignInAccount): String? = withContext(Dispatchers.IO) {
        try {
            val scopeStr = "oauth2:$GMAIL_SCOPE $GMAIL_SETTINGS_SCOPE"
            val token = GoogleAuthUtil.getToken(context, account.account!!, scopeStr)
            if (token != null) {
                saveAccessToken(token)
                account.email?.let { saveUserEmail(it) }
            }
            token
        } catch (e: Exception) {
            try {
                val scopeStrFallback = "oauth2:$GMAIL_SCOPE"
                val tokenFallback = GoogleAuthUtil.getToken(context, account.account!!, scopeStrFallback)
                if (tokenFallback != null) {
                    saveAccessToken(tokenFallback)
                    account.email?.let { saveUserEmail(it) }
                }
                tokenFallback
            } catch (e2: Exception) {
                e2.printStackTrace()
                null
            }
        }
    }

    fun clearCredentials() {
        invalidateCurrentToken()
        prefs.edit().clear().apply()
    }
}
