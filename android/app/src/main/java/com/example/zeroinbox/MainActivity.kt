package com.example.zeroinbox

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.zeroinbox.ui.SwipeableMailStack
import com.example.zeroinbox.ui.theme.ZeroInboxTheme

class MainActivity : ComponentActivity() {

    private val imapAuthManager by lazy { ImapAuthManager(this) }
    private val imapRepository by lazy { ImapMailRepository(this, imapAuthManager) }
    private val viewModel: MailViewModel by viewModels(
        factoryProducer = { MailViewModelFactory(imapRepository) }
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Auto-connect if credentials already saved
        if (imapAuthManager.isConfigured()) {
            val savedEmail = imapAuthManager.getEmail() ?: "Connected Gmail"
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
                        savedEmail = imapAuthManager.getEmail() ?: "",
                        onSaveImapCredentials = { email, appPassword ->
                            imapAuthManager.saveCredentials(email, appPassword)
                            viewModel.setAccount(email)
                            Toast.makeText(this@MainActivity, "Connected to $email via IMAP!", Toast.LENGTH_SHORT).show()
                        },
                        onToggleTheme = { isDarkTheme = it },
                        onSignOut = {
                            imapAuthManager.clearCredentials()
                            viewModel.signOut()
                            Toast.makeText(this@MainActivity, "Signed out of Gmail.", Toast.LENGTH_SHORT).show()
                        }
                    )
                }
            }
        }
    }
}
