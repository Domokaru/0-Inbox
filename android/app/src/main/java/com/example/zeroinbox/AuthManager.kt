package com.example.zeroinbox

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.openid.appauth.AuthState
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.ResponseTypeValues
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/**
 * Manages Google OAuth 2.0 authentication using standard web browser flow with AppAuth.
 * Handles opening the Google authorization webpage, capturing the redirect code,
 * and exchanging it for access/refresh tokens.
 */
class AuthManager(private val context: Context) {

    companion object {
        private const val PREFS_NAME = "zero_inbox_auth_prefs"
        private const val KEY_SAVED_ACCOUNT = "saved_google_account"
        private const val KEY_AUTH_STATE = "saved_auth_state_json"
        private const val KEY_CUSTOM_CLIENT_ID = "custom_client_id"

        // Default Google OAuth Client ID
        const val DEFAULT_CLIENT_ID = "683169336275-0n04hpf7nf0apm025u4midmdtuggass5.apps.googleusercontent.com"
        const val REDIRECT_URI_STRING = "com.example.zeroinbox:/oauth2redirect"

        private val AUTH_ENDPOINT = Uri.parse("https://accounts.google.com/o/oauth2/v2/auth")
        private val TOKEN_ENDPOINT = Uri.parse("https://oauth2.googleapis.com/token")
    }

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val authService = AuthorizationService(context)

    private var cachedAuthState: AuthState? = null

    init {
        loadAuthState()
    }

    private fun loadAuthState(): AuthState? {
        if (cachedAuthState != null) return cachedAuthState
        val jsonString = prefs.getString(KEY_AUTH_STATE, null) ?: return null
        return try {
            val state = AuthState.jsonDeserialize(jsonString)
            cachedAuthState = state
            state
        } catch (e: Exception) {
            Log.e("AuthManager", "Failed to deserialize AuthState: ${e.message}")
            null
        }
    }

    @Synchronized
    private fun saveAuthState(state: AuthState) {
        cachedAuthState = state
        prefs.edit().putString(KEY_AUTH_STATE, state.jsonSerializeString()).apply()
    }

    fun getAuthState(): AuthState? {
        return cachedAuthState ?: loadAuthState()
    }

    fun isAuthorized(): Boolean {
        val state = getAuthState()
        return state != null && state.isAuthorized
    }

    fun getClientId(): String {
        return prefs.getString(KEY_CUSTOM_CLIENT_ID, null) ?: DEFAULT_CLIENT_ID
    }

    fun setClientId(clientId: String) {
        prefs.edit().putString(KEY_CUSTOM_CLIENT_ID, clientId.trim()).apply()
    }

    fun getRedirectUri(): Uri {
        return Uri.parse(REDIRECT_URI_STRING)
    }

    fun getSavedAccount(): String? {
        val saved = prefs.getString(KEY_SAVED_ACCOUNT, null)
        return if (!saved.isNullOrBlank()) saved else null
    }

    fun saveAccount(accountName: String) {
        prefs.edit().putString(KEY_SAVED_ACCOUNT, accountName.trim()).apply()
    }

    fun clearAccount() {
        cachedAuthState = null
        prefs.edit()
            .remove(KEY_SAVED_ACCOUNT)
            .remove(KEY_AUTH_STATE)
            .apply()
    }

    /**
     * Builds the Intent to open Chrome Custom Tabs / Browser for Google Web OAuth.
     */
    fun createAuthIntent(): Intent {
        val serviceConfig = AuthorizationServiceConfiguration(AUTH_ENDPOINT, TOKEN_ENDPOINT)
        val redirectUri = getRedirectUri()
        val clientId = getClientId()

        val authRequest = AuthorizationRequest.Builder(
            serviceConfig,
            clientId,
            ResponseTypeValues.CODE,
            redirectUri
        )
            .setScopes(
                "https://www.googleapis.com/auth/gmail.modify",
                "email",
                "profile",
                "openid"
            )
            .setPrompt("select_account consent")
            .setAdditionalParameters(mapOf("access_type" to "offline"))
            .build()

        return authService.getAuthorizationRequestIntent(authRequest)
    }

    /**
     * Handles the authorization response received back from the browser redirect,
     * and performs the token exchange to obtain access_token and refresh_token.
     */
    suspend fun handleAuthorizationResponse(
        response: AuthorizationResponse?,
        exception: AuthorizationException?
    ): Pair<Boolean, String?> = withContext(Dispatchers.IO) {
        if (exception != null) {
            val errorMsg = exception.errorDescription ?: exception.message ?: "Authorization failed"
            Log.e("AuthManager", "OAuth authorization error: $errorMsg", exception)
            return@withContext Pair(false, "Authorization error: $errorMsg")
        }
        if (response == null) {
            return@withContext Pair(false, "No authorization response received.")
        }

        val state = AuthState(response, exception)
        val tokenRequest = response.createTokenExchangeRequest()

        suspendCoroutine { continuation ->
            authService.performTokenRequest(tokenRequest) { tokenResponse, tokenException ->
                state.update(tokenResponse, tokenException)
                if (tokenException != null) {
                    val err = tokenException.errorDescription ?: tokenException.message ?: "Token exchange failed"
                    Log.e("AuthManager", "Token exchange failed: $err", tokenException)
                    continuation.resume(Pair(false, "Token exchange failed: $err"))
                } else if (tokenResponse != null) {
                    saveAuthState(state)
                    // Retrieve email from user profile or ID token
                    val accessToken = tokenResponse.accessToken ?: state.accessToken
                    val email = (if (accessToken != null) fetchGmailUserEmail(accessToken) else null)
                        ?: extractEmailFromIdToken(tokenResponse.idToken)
                        ?: extractEmailFromIdToken(state.idToken)
                        ?: "Connected Gmail Account"
                    saveAccount(email)
                    continuation.resume(Pair(true, email))
                } else {
                    continuation.resume(Pair(false, "Token exchange returned empty response."))
                }
            }
        }
    }

    /**
     * Returns a valid, fresh access token. Automatically refreshes using refresh token if expired.
     */
    suspend fun getFreshAccessToken(): String? = withContext(Dispatchers.IO) {
        val state = getAuthState() ?: return@withContext null
        if (!state.needsTokenRefresh && !state.accessToken.isNullOrBlank()) {
            return@withContext state.accessToken
        }

        suspendCoroutine { continuation ->
            state.performActionWithFreshTokens(authService) { accessToken, _, ex ->
                if (ex != null) {
                    Log.e("AuthManager", "Token refresh error: ${ex.message}")
                    continuation.resume(null)
                } else {
                    saveAuthState(state)
                    continuation.resume(accessToken)
                }
            }
        }
    }

    fun getCachedAccessToken(): String? {
        return getAuthState()?.accessToken
    }

    private fun extractEmailFromIdToken(idToken: String?): String? {
        if (idToken == null) return null
        return try {
            val parts = idToken.split(".")
            if (parts.size >= 2) {
                val decoded = String(Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING))
                val json = JSONObject(decoded)
                json.optString("email", null)
            } else null
        } catch (e: Exception) {
            null
        }
    }

    private fun fetchGmailUserEmail(accessToken: String): String? {
        return try {
            val url = URL("https://gmail.googleapis.com/gmail/v1/users/me/profile")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $accessToken")
            conn.setRequestProperty("Accept", "application/json")
            conn.connectTimeout = 10000
            conn.readTimeout = 10000
            if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                json.optString("emailAddress", null)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

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
                val signingInfo = packageInfo.signingInfo
                when {
                    signingInfo == null -> null
                    signingInfo.hasMultipleSigners() -> signingInfo.apkContentsSigners
                    else -> signingInfo.signingCertificateHistory
                }
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }
            val cert = signatures?.firstOrNull()?.toByteArray() ?: return "Unknown"
            val standardAlgo = if (algorithm.equals("SHA1", ignoreCase = true)) "SHA-1" else algorithm
            val md = java.security.MessageDigest.getInstance(standardAlgo)
            val digest = md.digest(cert)
            digest.joinToString(":") { String.format("%02X", it) }
        } catch (e: Exception) {
            "Unavailable: ${e.message}"
        }
    }

    fun dispose() {
        authService.dispose()
    }
}
