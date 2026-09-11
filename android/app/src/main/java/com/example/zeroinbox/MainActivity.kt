package com.example.zeroinbox

import android.accounts.AccountManager
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
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val authManager by lazy { AuthManager(this) }
    private val viewModel: MailViewModel by viewModels(
        factoryProducer = { MailViewModelFactory(GmailRepository(this)) }
    )

    // Launcher for system Google Account Chooser
    private val accountPickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == android.app.Activity.RESULT_OK && result.data != null) {
            val accountName = result.data?.getStringExtra(AccountManager.KEY_ACCOUNT_NAME)
                ?: result.data?.getStringExtra("authAccount")
            if (!accountName.isNullOrBlank()) {
                authManager.saveAccount(accountName)
                viewModel.setAccount(accountName)
                Toast.makeText(this, "Connected: $accountName", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // Launcher for Google OAuth consent permission screen
    private val authRecoveryLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        // User responded to Google OAuth permissions prompt; refresh emails
        viewModel.onAuthRecoverySuccess()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Observe OAuth recovery intents from GmailRepository / MailViewModel
        lifecycleScope.launch {
            viewModel.authRecoveryIntent.collectLatest { intent ->
                try {
                    authRecoveryLauncher.launch(intent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        // Check if there is already a saved account from previous session
        val savedAccount = authManager.getSavedAccount()
        if (savedAccount != null) {
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
                                accountPickerLauncher.launch(authManager.createAccountPickerIntent())
                            } catch (e: Exception) {
                                e.printStackTrace()
                                Toast.makeText(
                                    this,
                                    "Could not open Google Account Chooser: ${e.message}",
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
}

