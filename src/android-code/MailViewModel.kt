package com.example.zeroinbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Manages email triage state and interaction with the IMAP Mail Repository.
 */
class MailViewModel(private val repository: ImapMailRepository) : ViewModel() {

    private val _emails = MutableStateFlow<List<EmailModel>>(emptyList())
    val emails: StateFlow<List<EmailModel>> = _emails.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

    private val _lastAction = MutableStateFlow<LastSwipeAction?>(null)
    val lastAction: StateFlow<LastSwipeAction?> = _lastAction.asStateFlow()

    private val _labels = MutableStateFlow<List<LabelModel>>(emptyList())
    val labels: StateFlow<List<LabelModel>> = _labels.asStateFlow()

    private val _isRefreshingLabels = MutableStateFlow(false)
    val isRefreshingLabels: StateFlow<Boolean> = _isRefreshingLabels.asStateFlow()

    private val _currentAccount = MutableStateFlow<String?>(null)
    val currentAccount: StateFlow<String?> = _currentAccount.asStateFlow()

    private val _isDemoMode = MutableStateFlow(false)
    val isDemoMode: StateFlow<Boolean> = _isDemoMode.asStateFlow()

    private val _filterTwoDays = MutableStateFlow(true)
    val filterTwoDays: StateFlow<Boolean> = _filterTwoDays.asStateFlow()

    fun setFilterTwoDays(filter: Boolean) {
        if (_filterTwoDays.value != filter) {
            _filterTwoDays.value = filter
            currentNextPageToken = null
            _emails.value = emptyList()
            _hasMore.value = true
            loadNextBatch()
        }
    }

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var currentNextPageToken: String? = null
    private var isInitialized = false

    fun initializeWithSavedAccount(accountName: String) {
        if (_currentAccount.value != accountName || !isInitialized) {
            setAccount(accountName)
        }
    }

    fun setAccount(accountName: String) {
        _currentAccount.value = accountName
        _isDemoMode.value = false
        _errorMessage.value = null
        currentNextPageToken = null
        _emails.value = emptyList()
        isInitialized = true

        repository.initialize(accountName)
        loadNextBatch()
    }

    fun enableDemoMode() {
        _isDemoMode.value = true
        _currentAccount.value = null
        _errorMessage.value = null
        _emails.value = repository.getDemoEmails()
        _labels.value = repository.getDemoLabels()
        _hasMore.value = false
        _isLoading.value = false
    }

    fun signOut() {
        _currentAccount.value = null
        _isDemoMode.value = false
        _emails.value = emptyList()
        _labels.value = emptyList()
        _errorMessage.value = null
        isInitialized = false
    }

    private fun formatDetailedErrorMessage(throwable: Throwable?): String {
        var current = throwable
        var depth = 0
        var fallbackMsg: String? = null

        while (current != null && depth < 10) {
            val msg = current.message
            if (!msg.isNullOrBlank() && fallbackMsg == null && !msg.contains("Exception")) {
                fallbackMsg = msg
            }

            val msgLower = (msg ?: "").lowercase()
            if (msgLower.contains("authenticationfailed") || msgLower.contains("invalid credentials") || msgLower.contains("535") || msgLower.contains("username and password not accepted")) {
                return "Gmail Authentication Failed: Please verify your Google App Password (16 characters, generated in your Google Account > Security > 2-Step Verification > App Passwords)."
            }
            if (msgLower.contains("imap is disabled") || msgLower.contains("enable imap")) {
                return "IMAP is disabled for this account: Open Gmail Settings > Forwarding and POP/IMAP, and choose 'Enable IMAP'."
            }
            if (msgLower.contains("timeout") || msgLower.contains("timed out")) {
                return "Connection Timed Out: Please check your internet connection and verify imap.gmail.com port 993 is accessible."
            }
            if (msgLower.contains("no google app password") || msgLower.contains("no gmail address")) {
                return msg ?: "Please enter your Gmail address and 16-character App Password in Settings."
            }
            current = current.cause
            depth++
        }

        return fallbackMsg ?: throwable?.localizedMessage ?: "Failed to connect to Gmail IMAP. Check your App Password."
    }

    fun retryAuth() {
        _errorMessage.value = null
        val account = _currentAccount.value
        if (account != null) {
            setAccount(account)
        } else {
            loadNextBatch()
        }
    }

    fun refreshLabels() {
        if (_isDemoMode.value) {
            _labels.value = repository.getDemoLabels()
            return
        }
        viewModelScope.launch {
            _isRefreshingLabels.value = true
            try {
                _labels.value = repository.fetchLabels()
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                _isRefreshingLabels.value = false
            }
        }
    }

    fun loadNextBatch() {
        if (_isDemoMode.value) {
            return
        }
        if (_isLoading.value || !_hasMore.value) return

        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                val (newEmails, nextPageToken) = repository.fetchEmails(currentNextPageToken, _filterTwoDays.value)
                currentNextPageToken = nextPageToken

                // In Compose Tinder stack, items at the end of the list are rendered on top
                _emails.value = newEmails.reversed() + _emails.value
                _hasMore.value = nextPageToken != null

                // Once primary batch loads successfully, refresh labels in the background
                if (_labels.value.isEmpty()) {
                    refreshLabels()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                _errorMessage.value = formatDetailedErrorMessage(e)
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun processEmailSwipe(email: EmailModel, direction: SwipeDirection) {
        _lastAction.value = LastSwipeAction(email, direction)
        _emails.value = _emails.value.filter { it.id != email.id }

        if (email.isDemo) return

        viewModelScope.launch {
            try {
                when (direction) {
                    SwipeDirection.RIGHT -> {
                        repository.markRead(email.threadId)
                        repository.archiveEmail(email.threadId)
                    }
                    SwipeDirection.LEFT -> {
                        repository.deleteEmail(email.threadId)
                    }
                    SwipeDirection.UP -> {
                        repository.applyNeedsResponse(email.threadId)
                    }
                    SwipeDirection.DOWN -> {
                        repository.markRead(email.threadId)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                _errorMessage.value = formatDetailedErrorMessage(e)
            }
        }
    }

    fun applyCustomLabel(email: EmailModel, label: LabelModel) {
        _lastAction.value = LastSwipeAction(
            email = email,
            direction = null,
            customLabel = label
        )
        _emails.value = _emails.value.filter { it.id != email.id }

        if (email.isDemo) return

        viewModelScope.launch {
            try {
                repository.applyLabelAndArchive(email.threadId, label.id)
            } catch (e: Exception) {
                e.printStackTrace()
                _errorMessage.value = formatDetailedErrorMessage(e)
            }
        }
    }

    fun undoLastAction() {
        val action = _lastAction.value ?: return
        _lastAction.value = null
        _emails.value = _emails.value + action.email

        if (action.email.isDemo) return

        viewModelScope.launch {
            try {
                if (action.customLabel != null) {
                    repository.unapplyLabel(action.email.threadId, action.customLabel.id)
                } else {
                    when (action.direction) {
                        SwipeDirection.RIGHT -> repository.unarchiveEmail(action.email.threadId)
                        SwipeDirection.LEFT -> repository.untrashEmail(action.email.threadId)
                        SwipeDirection.UP -> repository.removeNeedsResponse(action.email.threadId)
                        SwipeDirection.DOWN -> repository.markUnread(action.email.threadId)
                        null -> {}
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun clearLastAction() {
        _lastAction.value = null
    }

    fun clearError() {
        _errorMessage.value = null
    }
}

data class LastSwipeAction(
    val email: EmailModel,
    val direction: SwipeDirection?,
    val customLabel: LabelModel? = null,
    val timestamp: Long = System.currentTimeMillis()
)

enum class SwipeDirection { LEFT, RIGHT, UP, DOWN }

class MailViewModelFactory(private val repository: ImapMailRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MailViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return MailViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
