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
        private const val PREFS_NAME = "google_auth_prefs"
        private const val KEY_USER_EMAIL = "google_user_email"
        private const val KEY_ACCESS_TOKEN = "google_access_token"
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getGoogleSignInClient(activity: Activity): GoogleSignInClient {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(Scope(GMAIL_SCOPE))
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

    suspend fun fetchOAuthToken(account: GoogleSignInAccount): String? = withContext(Dispatchers.IO) {
        try {
            val scopeStr = "oauth2:$GMAIL_SCOPE"
            val token = GoogleAuthUtil.getToken(context, account.account!!, scopeStr)
            if (token != null) {
                saveAccessToken(token)
                account.email?.let { saveUserEmail(it) }
            }
            token
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun clearCredentials() {
        prefs.edit().clear().apply()
    }
}
