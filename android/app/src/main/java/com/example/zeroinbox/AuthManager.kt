package com.example.zeroinbox

import android.app.Activity
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthManager(private val activity: Activity) {

    // IMPORTANT: Replace this with the Web Client ID you created in Google Cloud Console
    private val WEB_CLIENT_ID = "YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com"
    private val credentialManager = CredentialManager.create(activity)

    suspend fun signIn(): String? = withContext(Dispatchers.IO) {
        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(WEB_CLIENT_ID)
            .setAutoSelectEnabled(true)
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
                credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                
                val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                // Returning the email address to be used by GoogleAccountCredential in the Repository
                return@withContext googleIdTokenCredential.id
            }
        } catch (e: Exception) {
            Log.e("AuthManager", "Sign-in failed", e)
        }
        return@withContext null
    }
}
