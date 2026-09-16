package com.example.zeroinbox

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.example.zeroinbox.ui.SwipeableMailStack
import com.example.zeroinbox.ui.theme.ZeroInboxTheme
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.common.api.ApiException
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val authManager by lazy { GoogleAuthManager(this) }
    private val repository by lazy { GmailRepository(this, authManager) }
    private val viewModel: MailViewModel by viewModels(
        factoryProducer = { MailViewModelFactory(repository) }
    )

    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            if (account != null) {
                val email = account.email ?: "Google Account"
                lifecycleScope.launch {
                    authManager.saveUserEmail(email)
                    val token = authManager.fetchOAuthToken(account)
                    viewModel.setAccount(email)
                    if (token != null) {
                        Toast.makeText(this@MainActivity, "Connected to $email!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@MainActivity, "Signed in as $email. Fetching mailbox...", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            val errorMessage = when (e) {
                is ApiException -> when (e.statusCode) {
                    10 -> "Google Sign-In Error 10 (DEVELOPER_ERROR): Please register an Android OAuth Client ID in Google Cloud Console with package 'com.example.zeroinbox' and your APK's SHA-1 fingerprint."
                    12500 -> "Google Sign-In Error 12500: Check Google Cloud OAuth Consent Screen and ensure your email is added to Test Users."
                    else -> "Google Sign-In failed (code ${e.statusCode}): ${e.localizedMessage ?: "Unknown error"}"
                }
                else -> "Google Sign-In failed: ${e.localizedMessage ?: e.message}"
            }
            Toast.makeText(this@MainActivity, errorMessage, Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Auto-connect if Google account already saved
        val savedEmail = authManager.getSavedEmail()
        if (savedEmail != null) {
            viewModel.initializeWithSavedAccount(savedEmail)
        }

        setContent {
            var isDarkTheme by remember { mutableStateOf(true) }

            ZeroInboxTheme(darkTheme = isDarkTheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    SwipeableMailStack(
                        viewModel = viewModel,
                        isDarkTheme = isDarkTheme,
                        savedEmail = authManager.getSavedEmail() ?: "",
                        onSignInWithGoogle = {
                            val client = authManager.getGoogleSignInClient(this@MainActivity)
                            googleSignInLauncher.launch(client.signInIntent)
                        },
                        onToggleTheme = { isDarkTheme = it },
                        onSignOut = {
                            val client = authManager.getGoogleSignInClient(this@MainActivity)
                            client.signOut().addOnCompleteListener {
                                authManager.clearCredentials()
                                viewModel.signOut()
                                Toast.makeText(this@MainActivity, "Signed out of Google account.", Toast.LENGTH_SHORT).show()
                            }
                        }
                    )
                }
            }
        }
    }
}
