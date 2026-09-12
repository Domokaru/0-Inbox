package com.example.zeroinbox

import android.content.Intent
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
import kotlinx.coroutines.launch
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationResponse

class MainActivity : ComponentActivity() {

    private val authManager by lazy { AuthManager(this) }
    private val viewModel: MailViewModel by viewModels(
        factoryProducer = { MailViewModelFactory(GmailRepository(this, authManager)) }
    )

    // Launcher for Google Web OAuth via AppAuth (Chrome Custom Tabs / Web Browser)
    private val authLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val intent = result.data
        if (intent != null) {
            handleAuthIntent(intent)
        }
    }

    /**
     * Processes authorization redirect callback intents and exchanges auth code for tokens.
     */
    private fun handleAuthIntent(intent: Intent) {
        val response = AuthorizationResponse.fromIntent(intent)
        val exception = AuthorizationException.fromIntent(intent)

        if (response != null || exception != null) {
            lifecycleScope.launch {
                val (success, resultMsg) = authManager.handleAuthorizationResponse(response, exception)
                if (success && resultMsg != null) {
                    viewModel.setAccount(resultMsg)
                    Toast.makeText(this@MainActivity, "Connected: $resultMsg", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(
                        this@MainActivity,
                        resultMsg ?: "Google sign in was not completed.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthIntent(intent)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Process any authorization redirect intent if launched directly
        intent?.let { handleAuthIntent(it) }

        // Check if there is already a saved account / authorized state from previous session
        if (authManager.isAuthorized()) {
            val savedAccount = authManager.getSavedAccount() ?: "Connected Gmail Account"
            viewModel.initializeWithSavedAccount(savedAccount)
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
                        signingSha1 = authManager.getCertificateFingerprint(),
                        onToggleTheme = { isDarkTheme = it },
                        onLaunchAccountPicker = {
                            try {
                                val authIntent = authManager.createAuthIntent()
                                authLauncher.launch(authIntent)
                            } catch (e: Exception) {
                                e.printStackTrace()
                                Toast.makeText(
                                    this,
                                    "Could not open browser for sign in: ${e.message}",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        },
                        onSignOut = {
                            authManager.clearAccount()
                            viewModel.signOut()
                        }
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        authManager.dispose()
    }
}
