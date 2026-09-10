package com.example.zeroinbox

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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

class MainActivity : ComponentActivity() {

    private val authManager by lazy { AuthManager(this) }
    private val viewModel: MailViewModel by viewModels { 
        MailViewModelFactory(GmailRepository(this)) 
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initiate sign-in on launch via Credential Manager
        lifecycleScope.launch {
            val accountName = authManager.signIn()
            if (accountName != null) {
                viewModel.initializeRepository(accountName)
            }
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
                        onToggleTheme = { isDarkTheme = it }
                    )
                }
            }
        }
    }
}
