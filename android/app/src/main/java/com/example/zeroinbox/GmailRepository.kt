package com.example.zeroinbox

import android.content.Context
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
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
    val snippet: String
)

data class LabelModel(
    val id: String,
    val name: String,
    val type: String = "user" // "user" or "system"
)

class GmailRepository(private val context: Context) {

    private var gmailService: Gmail? = null
    private var needsResponseLabelId: String? = null

    fun initialize(accountName: String) {
        val credential = GoogleAccountCredential.usingOAuth2(
            context, listOf(GmailScopes.GMAIL_MODIFY)
        ).apply {
            selectedAccountName = accountName
        }

        gmailService = Gmail.Builder(
            GoogleNetHttpTransport.newTrustedTransport(),
            GsonFactory.getDefaultInstance(),
            credential
        ).setApplicationName("Neon Gmail Client").build()
    }

    suspend fun fetchEmails(pageToken: String? = null): Pair<List<EmailModel>, String?> = withContext(Dispatchers.IO) {
        val service = gmailService ?: throw IllegalStateException("Gmail service not initialized")
        
        // Requirements: Primary, Promotions, Social, Updates, newer than 2 days.
        val query = "category:primary OR category:promotions OR category:social OR category:updates newer_than:2d"
        
        val listResponse = service.users().messages().list("me")
            .setQ(query)
            .setMaxResults(20L)
            .setPageToken(pageToken)
            .execute()

        val messages = listResponse.messages ?: emptyList()
        val emailModels = messages.mapNotNull { msgMeta ->
            // Fetch the full message to get headers and snippet
            val msg = service.users().messages().get("me", msgMeta.id).setFormat("metadata").execute()
            
            val headers = msg.payload?.headers
            val subject = headers?.find { it.name.equals("Subject", ignoreCase = true) }?.value ?: "No Subject"
            val sender = headers?.find { it.name.equals("From", ignoreCase = true) }?.value ?: "Unknown Sender"
            
            EmailModel(
                id = msg.id,
                threadId = msg.threadId,
                sender = sender,
                subject = subject,
                snippet = msg.snippet ?: ""
            )
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
            var targetLabel = labels?.find { it.name == "Needs Response" }
            
            if (targetLabel == null) {
                // Create it if it doesn't exist
                val newLabel = Label().apply {
                    name = "Needs Response"
                    labelListVisibility = "labelShow"
                    messageListVisibility = "show"
                }
                targetLabel = service.users().labels().create("me", newLabel).execute()
            }
            needsResponseLabelId = targetLabel.id
        }

        service.users().threads().modify(
            "me", 
            threadId, 
            ModifyThreadRequest()
                .setAddLabelIds(listOf(needsResponseLabelId!!))
                .setRemoveLabelIds(listOf("UNREAD")) // Ensure it acts like it was triaged
        ).execute()
    }

    /**
     * Fetches all available labels from the user's Gmail account anytime the app opens.
     * Filters out non-actionable internal system labels while preserving user-defined labels.
     */
    suspend fun fetchLabels(): List<LabelModel> = withContext(Dispatchers.IO) {
        val service = gmailService ?: throw IllegalStateException("Gmail service not initialized")
        val response = service.users().labels().list("me").execute()
        val labels = response.labels ?: emptyList()

        // Exclude internal markers like CHAT, DRAFT, SPAM, TRASH, UNREAD, INBOX from selectable destination labels
        val excludedIds = setOf("CHAT", "DRAFT", "SPAM", "TRASH", "UNREAD", "INBOX")
        labels
            .filter { !excludedIds.contains(it.id) }
            .map { LabelModel(id = it.id, name = it.name, type = it.type ?: "user") }
            .sortedBy { it.name.lowercase() }
    }

    /**
     * Applies the selected label to the email, marks it as read, and moves it from the inbox.
     */
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

    /**
     * Reverses the custom label application on undo: removes the applied label and restores to INBOX.
     */
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
}
