package com.example.zeroinbox

import android.content.Context
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.googleapis.extensions.android.gms.auth.UserRecoverableAuthIOException
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.gmail.Gmail
import com.google.api.services.gmail.GmailScopes
import com.google.api.services.gmail.model.Label
import com.google.api.services.gmail.model.ModifyThreadRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class EmailModel(
    val id: String,
    val threadId: String,
    val sender: String,
    val subject: String,
    val snippet: String,
    val isDemo: Boolean = false
)

data class LabelModel(
    val id: String,
    val name: String,
    val type: String = "user" // "user" or "system"
)

class GmailRepository(private val context: Context) {

    private var gmailService: Gmail? = null
    private var needsResponseLabelId: String? = null
    var activeAccount: String? = null
        private set

    fun initialize(accountName: String) {
        activeAccount = accountName
        val credential = GoogleAccountCredential.usingOAuth2(
            context, listOf(GmailScopes.GMAIL_MODIFY)
        ).apply {
            selectedAccountName = accountName
        }

        gmailService = Gmail.Builder(
            GoogleNetHttpTransport.newTrustedTransport(),
            GsonFactory.getDefaultInstance(),
            credential
        ).setApplicationName("Zero Inbox").build()
    }

    suspend fun fetchEmails(pageToken: String? = null, filterTwoDays: Boolean = true): Pair<List<EmailModel>, String?> = withContext(Dispatchers.IO) {
        val service = gmailService ?: throw IllegalStateException("Gmail service not initialized. Please connect your Gmail account.")

        // Primary inbox query: retrieves all messages currently residing in the user's INBOX
        var request = service.users().messages().list("me")
            .setLabelIds(listOf("INBOX"))
            .setMaxResults(50L)
            .setPageToken(pageToken)
            
        if (filterTwoDays) {
            request = request.setQ("newer_than:2d")
        }
        
        val listResponse = request.execute()

        val messages = listResponse.messages ?: emptyList()
        val emailModels = messages.mapNotNull { msgMeta ->
            try {
                // Fetch the message metadata to get headers and snippet
                val msg = service.users().messages().get("me", msgMeta.id)
                    .setFormat("metadata")
                    .setMetadataHeaders(listOf("Subject", "From", "Date"))
                    .execute()

                val headers = msg.payload?.headers
                val subject = headers?.find { it.name.equals("Subject", ignoreCase = true) }?.value ?: "(No Subject)"
                val sender = headers?.find { it.name.equals("From", ignoreCase = true) }?.value ?: "Unknown Sender"

                EmailModel(
                    id = msg.id,
                    threadId = msg.threadId,
                    sender = sender,
                    subject = subject,
                    snippet = msg.snippet ?: "",
                    isDemo = false
                )
            } catch (e: Exception) {
                null
            }
        }

        Pair(emailModels, listResponse.nextPageToken)
    }

    suspend fun archiveEmail(threadId: String) = withContext(Dispatchers.IO) {
        gmailService?.users()?.threads()?.modify(
            "me",
            threadId,
            ModifyThreadRequest().setRemoveLabelIds(listOf("INBOX"))
        )?.execute()
    }

    suspend fun markRead(threadId: String) = withContext(Dispatchers.IO) {
        gmailService?.users()?.threads()?.modify(
            "me",
            threadId,
            ModifyThreadRequest().setRemoveLabelIds(listOf("UNREAD"))
        )?.execute()
    }

    suspend fun deleteEmail(threadId: String) = withContext(Dispatchers.IO) {
        gmailService?.users()?.threads()?.trash("me", threadId)?.execute()
    }

    suspend fun unarchiveEmail(threadId: String) = withContext(Dispatchers.IO) {
        gmailService?.users()?.threads()?.modify(
            "me",
            threadId,
            ModifyThreadRequest().setAddLabelIds(listOf("INBOX"))
        )?.execute()
    }

    suspend fun untrashEmail(threadId: String) = withContext(Dispatchers.IO) {
        gmailService?.users()?.threads()?.untrash("me", threadId)?.execute()
    }

    suspend fun markUnread(threadId: String) = withContext(Dispatchers.IO) {
        gmailService?.users()?.threads()?.modify(
            "me",
            threadId,
            ModifyThreadRequest().setAddLabelIds(listOf("UNREAD"))
        )?.execute()
    }

    suspend fun removeNeedsResponse(threadId: String) = withContext(Dispatchers.IO) {
        val service = gmailService ?: return@withContext
        val labelId = needsResponseLabelId ?: run {
            val labels = service.users().labels().list("me").execute().labels
            labels?.find { it.name == "Needs Response" }?.id
        } ?: return@withContext

        service.users().threads().modify(
            "me",
            threadId,
            ModifyThreadRequest().setRemoveLabelIds(listOf(labelId))
        ).execute()
    }

    suspend fun applyNeedsResponse(threadId: String) = withContext(Dispatchers.IO) {
        val service = gmailService ?: return@withContext

        if (needsResponseLabelId == null) {
            val labels = service.users().labels().list("me").execute().labels
            val targetLabel = labels?.find { it.name == "Needs Response" }
                ?: service.users().labels().create("me", Label().apply {
                    name = "Needs Response"
                    labelListVisibility = "labelShow"
                    messageListVisibility = "show"
                }).execute()
            needsResponseLabelId = targetLabel?.id
        }

        val labelId = needsResponseLabelId ?: return@withContext
        service.users().threads().modify(
            "me",
            threadId,
            ModifyThreadRequest()
                .setAddLabelIds(listOf(labelId))
                .setRemoveLabelIds(listOf("UNREAD"))
        ).execute()
    }

    suspend fun fetchLabels(): List<LabelModel> = withContext(Dispatchers.IO) {
        val service = gmailService ?: throw IllegalStateException("Gmail service not initialized")
        val response = service.users().labels().list("me").execute()
        val labels = response.labels ?: emptyList()

        val excludedIds = setOf("CHAT", "DRAFT", "SPAM", "TRASH", "UNREAD", "INBOX")
        labels
            .filter { !excludedIds.contains(it.id) }
            .map { LabelModel(id = it.id, name = it.name, type = it.type ?: "user") }
            .sortedBy { it.name.lowercase() }
    }

    suspend fun applyLabelAndArchive(threadId: String, labelId: String) = withContext(Dispatchers.IO) {
        val service = gmailService ?: throw IllegalStateException("Gmail service not initialized")
        service.users().threads().modify(
            "me",
            threadId,
            ModifyThreadRequest()
                .setAddLabelIds(listOf(labelId))
                .setRemoveLabelIds(listOf("INBOX", "UNREAD"))
        ).execute()
    }

    suspend fun unapplyLabel(threadId: String, labelId: String) = withContext(Dispatchers.IO) {
        val service = gmailService ?: return@withContext
        service.users().threads().modify(
            "me",
            threadId,
            ModifyThreadRequest()
                .setRemoveLabelIds(listOf(labelId))
                .setAddLabelIds(listOf("INBOX", "UNREAD"))
        ).execute()
    }

    fun getDemoEmails(): List<EmailModel> {
        return listOf(
            EmailModel(
                id = "demo-1",
                threadId = "demo-thread-1",
                sender = "GitHub <notifications@github.com>",
                subject = "New Release v1.0.0 for Zero Inbox Android Client",
                snippet = "A new release has been published by your automated CI/CD pipeline. Check the release notes and installable debug APK.",
                isDemo = true
            ),
            EmailModel(
                id = "demo-2",
                threadId = "demo-thread-2",
                sender = "Alex Rivers <alex.rivers@designsystem.io>",
                subject = "Design System Update: Neon and Pastel Color Tokens",
                snippet = "We just merged the new 8-bit retro high-contrast palettes for both dark and light viewports. Please review the PR when you have a moment.",
                isDemo = true
            ),
            EmailModel(
                id = "demo-3",
                threadId = "demo-thread-3",
                sender = "Google Cloud <no-reply-cloud@google.com>",
                subject = "Google Cloud Console: OAuth Consent Screen Configured",
                snippet = "Your OAuth consent screen settings have been saved for project Zero Inbox. Verify your Gmail API scopes.",
                isDemo = true
            ),
            EmailModel(
                id = "demo-4",
                threadId = "demo-thread-4",
                sender = "Substack Daily <digest@substack.com>",
                subject = "The Art of Triage: Reaching 0 Inbox in under 5 minutes",
                snippet = "How rapid 4-way gesture swiping is reshaping mobile productivity. Swipe right to archive, left to delete, up for response.",
                isDemo = true
            ),
            EmailModel(
                id = "demo-5",
                threadId = "demo-thread-5",
                sender = "Jetpack Compose Weekly <newsletter@compose.dev>",
                subject = "Compose 1.6: PointerInput swipe physics and smooth springs",
                snippet = "Learn how velocity-tracking gesture states and spring specs deliver silky-smooth Tinder card stacking on Android.",
                isDemo = true
            )
        )
    }

    fun getDemoLabels(): List<LabelModel> {
        return listOf(
            LabelModel(id = "lbl-urgent", name = "Urgent", type = "user"),
            LabelModel(id = "lbl-work", name = "Work", type = "user"),
            LabelModel(id = "lbl-receipts", name = "Receipts", type = "user"),
            LabelModel(id = "lbl-projects", name = "Projects", type = "user"),
            LabelModel(id = "lbl-personal", name = "Personal", type = "user")
        )
    }
}

