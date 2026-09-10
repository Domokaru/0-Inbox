package com.example.zeroinbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MailViewModel(private val repository: GmailRepository) : ViewModel() {

    private val _emails = MutableStateFlow<List<EmailModel>>(emptyList())
    val emails: StateFlow<List<EmailModel>> = _emails.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()

    private val _lastAction = MutableStateFlow<LastSwipeAction?>(null)
    val lastAction: StateFlow<LastSwipeAction?> = _lastAction.asStateFlow()

    // Available labels in user's Gmail account (refreshed anytime the app is opened)
    private val _labels = MutableStateFlow<List<LabelModel>>(emptyList())
    val labels: StateFlow<List<LabelModel>> = _labels.asStateFlow()

    private val _isRefreshingLabels = MutableStateFlow(false)
    val isRefreshingLabels: StateFlow<Boolean> = _isRefreshingLabels.asStateFlow()

    private var currentNextPageToken: String? = null
    private var isInitialized = false

    fun initializeRepository(accountName: String) {
        if (!isInitialized) {
            repository.initialize(accountName)
            isInitialized = true
            loadNextBatch()
            refreshLabels()
        }
    }

    /**
     * Refreshes all labels from the user's Gmail account anytime the app opens.
     */
    fun refreshLabels() {
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
        if (_isLoading.value || !_hasMore.value) return
        
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val (newEmails, nextPageToken) = repository.fetchEmails(currentNextPageToken)
                currentNextPageToken = nextPageToken
                
                // For a Tinder stack, we add the new items to the bottom.
                // In Compose, if we render items in order, the first item is drawn first (at bottom).
                // We'll handle the visual stacking order in the Compose view.
                _emails.value = newEmails.reversed() + _emails.value
                _hasMore.value = nextPageToken != null
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun processEmailSwipe(email: EmailModel, direction: SwipeDirection) {
        // Record action for Snackbar Undo
        _lastAction.value = LastSwipeAction(email, direction)

        // Remove locally from UI state instantly
        _emails.value = _emails.value.filter { it.id != email.id }
        
        // Execute API call asynchronously
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
                e.printStackTrace() // In production, handle reverse-state on failure
            }
        }
    }

    /**
     * Triggered either via Long Press on the card or via the dedicated bottom action button:
     * 1. Applies selected label to email in Gmail
     * 2. Marks email as read
     * 3. Moves it from inbox (archives into the target label)
     */
    fun applyCustomLabel(email: EmailModel, label: LabelModel) {
        _lastAction.value = LastSwipeAction(
            email = email,
            direction = null,
            customLabel = label
        )

        // Remove from UI stack
        _emails.value = _emails.value.filter { it.id != email.id }

        viewModelScope.launch {
            try {
                repository.applyLabelAndArchive(email.threadId, label.id)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun undoLastAction() {
        val action = _lastAction.value ?: return
        _lastAction.value = null

        // Immediately restore the email to the top of the stack
        _emails.value = _emails.value + action.email

        // Asynchronously revert the Gmail API modification
        viewModelScope.launch {
            try {
                if (action.customLabel != null) {
                    // Revert custom label: remove label and restore to inbox
                    repository.unapplyLabel(action.email.threadId, action.customLabel.id)
                } else when (action.direction) {
                    SwipeDirection.RIGHT -> {
                        // Un-archive (restore to inbox)
                        repository.unarchiveEmail(action.email.threadId)
                    }
                    SwipeDirection.LEFT -> {
                        // Un-trash (restore from bin)
                        repository.untrashEmail(action.email.threadId)
                    }
                    SwipeDirection.UP -> {
                        // Remove "Needs Response" label
                        repository.removeNeedsResponse(action.email.threadId)
                    }
                    SwipeDirection.DOWN -> {
                        // Mark back as Unread
                        repository.markUnread(action.email.threadId)
                    }
                    null -> {}
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun clearLastAction() {
        _lastAction.value = null
    }
}

data class LastSwipeAction(
    val email: EmailModel,
    val direction: SwipeDirection?,
    val customLabel: LabelModel? = null,
    val timestamp: Long = System.currentTimeMillis()
)

enum class SwipeDirection { LEFT, RIGHT, UP, DOWN }

class MailViewModelFactory(private val repository: GmailRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MailViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return MailViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
