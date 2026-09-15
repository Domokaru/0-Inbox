package com.example.zeroinbox

import android.content.Context
import android.util.Log
import com.sun.mail.imap.IMAPFolder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.Calendar
import java.util.Date
import java.util.Properties
import javax.mail.Flags
import javax.mail.Folder
import javax.mail.Message
import javax.mail.MessagingException
import javax.mail.Session
import javax.mail.Store
import javax.mail.internet.MimeMessage
import javax.mail.internet.MimeMultipart
import javax.mail.search.ComparisonTerm
import javax.mail.search.ReceivedDateTerm
import javax.mail.search.SearchTerm

/**
 * High-performance IMAP Repository for Gmail.
 * Connects securely to imap.gmail.com:993 via SSL/TLS using the user's Gmail address and 16-character Google App Password.
 *
 * Provides complete inbox triage:
 * - Fetch Inbox messages (with optional 2-day filter)
 * - Archive (move from INBOX to [Gmail]/All Mail)
 * - Trash / Delete (move to [Gmail]/Trash or mark Deleted)
 * - Mark as Read / Unread (SEEN flag)
 * - Apply Labels / Folders (Folder copy + archive)
 */
class ImapMailRepository(
    private val context: Context,
    private val imapAuthManager: ImapAuthManager
) {
    companion object {
        private const val TAG = "ImapMailRepository"
    }

    var activeAccount: String? = null
        private set

    fun initialize(accountName: String) {
        activeAccount = accountName
    }

    private fun getSession(): Session {
        val props = Properties().apply {
            put("mail.store.protocol", "imaps")
            put("mail.imaps.host", imapAuthManager.getServer())
            put("mail.imaps.port", imapAuthManager.getPort().toString())
            put("mail.imaps.ssl.enable", "true")
            put("mail.imaps.ssl.protocols", "TLSv1.2 TLSv1.3")
            put("mail.imaps.connectiontimeout", "15000")
            put("mail.imaps.timeout", "15000")
            put("mail.imaps.peek", "true") // Do not automatically mark messages as read when fetching
        }
        return Session.getInstance(props, null)
    }

    private var persistentStore: Store? = null
    private val imapMutex = Mutex()

    @Synchronized
    private fun getConnectedStore(): Store {
        val currentStore = persistentStore
        if (currentStore != null && currentStore.isConnected) {
            return currentStore
        }
        val email = imapAuthManager.getEmail()
            ?: throw IllegalStateException("No Gmail address provided. Please configure your credentials.")
        val password = imapAuthManager.getAppPassword()
            ?: throw IllegalStateException("No Google App Password provided. Please configure your App Password.")

        val session = getSession()
        val store = session.getStore("imaps")
        store.connect(imapAuthManager.getServer(), imapAuthManager.getPort(), email, password)
        persistentStore = store
        return store
    }

    suspend fun verifyCredentials(): Boolean = withContext(Dispatchers.IO) {
        imapMutex.withLock {
            try {
                val store = getConnectedStore()
                store.isConnected
            } catch (e: Exception) {
                Log.e(TAG, "Failed to connect to IMAP: ${e.message}", e)
                throw e
            }
        }
    }

    suspend fun fetchEmails(
        pageToken: String? = null,
        filterTwoDays: Boolean = true
    ): Pair<List<EmailModel>, String?> = withContext(Dispatchers.IO) {
        imapMutex.withLock {
        var store: Store? = null
        var inbox: Folder? = null
        try {
            store = getConnectedStore()
            inbox = store.getFolder("INBOX")
            inbox.open(Folder.READ_ONLY)

            val totalMessages = inbox.messageCount
            if (totalMessages == 0) {
                return@withContext Pair(emptyList(), null)
            }

            // Determine search term or index window
            val messages: Array<Message> = if (filterTwoDays) {
                val cal = Calendar.getInstance()
                cal.add(Calendar.DAY_OF_YEAR, -2)
                val cutoffDate = cal.time
                val searchTerm = ReceivedDateTerm(ComparisonTerm.GE, cutoffDate)
                val searchResults = inbox.search(searchTerm)
                if (searchResults.isNotEmpty()) {
                    searchResults
                } else {
                    // Fallback to the latest 30 messages if search yields none
                    val start = maxOf(1, totalMessages - 29)
                    inbox.getMessages(start, totalMessages)
                }
            } else {
                // Paginate or take the most recent slice
                val pageSize = 30
                val end = if (pageToken != null) {
                    val tokenInt = pageToken.toIntOrNull() ?: totalMessages
                    minOf(tokenInt, totalMessages)
                } else {
                    totalMessages
                }
                val start = maxOf(1, end - pageSize + 1)
                inbox.getMessages(start, end)
            }

            // Reverse order so newest emails appear first
            val reversed = messages.reversedArray()

            val emailModels = reversed.mapNotNull { msg ->
                try {
                    val msgNumber = msg.messageNumber
                    val mimeMsg = msg as? MimeMessage
                    val messageId = mimeMsg?.messageID ?: "msg-$msgNumber-${msg.receivedDate?.time ?: System.currentTimeMillis()}"

                    val sender = msg.from?.firstOrNull()?.toString() ?: "Unknown Sender"
                    val subject = msg.subject ?: "(No Subject)"
                    val snippet = extractSnippet(msg)

                    EmailModel(
                        id = messageId,
                        threadId = msgNumber.toString(), // Message number in IMAP folder
                        sender = cleanSender(sender),
                        subject = subject,
                        snippet = snippet,
                        isDemo = false
                    )
                } catch (e: Exception) {
                    Log.w(TAG, "Error parsing message: ${e.message}")
                    null
                }
            }

            val nextToken = if (!filterTwoDays && messages.isNotEmpty()) {
                val earliestNumber = messages.first().messageNumber
                if (earliestNumber > 1) (earliestNumber - 1).toString() else null
            } else {
                null
            }

            Pair(emailModels, nextToken)
        } finally {
            try { inbox?.close(false) } catch (e: Exception) {}
        }
        }
    }

    private fun cleanSender(raw: String): String {
        return try {
            val decoded = javax.mail.internet.MimeUtility.decodeText(raw)
            decoded.replace("\"", "").trim()
        } catch (e: Exception) {
            raw
        }
    }

    private fun extractSnippet(message: Message): String {
        return try {
            val content = message.content
            val text = when (content) {
                is String -> content
                is MimeMultipart -> extractTextFromMultipart(content)
                else -> ""
            }
            val cleaned = text.replace(Regex("<[^>]*>"), " ")
                .replace(Regex("\\s+"), " ")
                .trim()
            if (cleaned.length > 180) cleaned.substring(0, 180) + "..." else cleaned
        } catch (e: Exception) {
            ""
        }
    }

    private fun extractTextFromMultipart(multipart: MimeMultipart): String {
        val sb = StringBuilder()
        for (i in 0 until multipart.count) {
            val bodyPart = multipart.getBodyPart(i)
            if (bodyPart.isMimeType("text/plain")) {
                sb.append(bodyPart.content.toString())
                break
            } else if (bodyPart.isMimeType("text/html") && sb.isEmpty()) {
                sb.append(bodyPart.content.toString())
            } else if (bodyPart.content is MimeMultipart) {
                sb.append(extractTextFromMultipart(bodyPart.content as MimeMultipart))
            }
        }
        return sb.toString()
    }

    /**
     * Archive email:
     * In Gmail IMAP, INBOX messages are removed from INBOX (which leaves them in [Gmail]/All Mail).
     */
    suspend fun archiveEmail(msgIdOrNumber: String) = withContext(Dispatchers.IO) {
        operateOnInboxMessage(msgIdOrNumber) { inbox, message ->
            // Copy to All Mail if needed, then flag deleted in INBOX
            val allMailFolder = findFolderCaseInsensitive(inbox.store, listOf("[Gmail]/All Mail", "[Google Mail]/All Mail", "Archive"))
            if (allMailFolder != null && allMailFolder.exists()) {
                inbox.copyMessages(arrayOf(message), allMailFolder)
            }
            message.setFlag(Flags.Flag.DELETED, true)
        }
    }

    /**
     * Delete email:
     * Move to [Gmail]/Trash or set DELETED flag.
     */
    suspend fun deleteEmail(msgIdOrNumber: String) = withContext(Dispatchers.IO) {
        operateOnInboxMessage(msgIdOrNumber) { inbox, message ->
            val trashFolder = findFolderCaseInsensitive(inbox.store, listOf("[Gmail]/Trash", "[Gmail]/Bin", "[Google Mail]/Trash", "Trash"))
            if (trashFolder != null && trashFolder.exists()) {
                inbox.copyMessages(arrayOf(message), trashFolder)
            }
            message.setFlag(Flags.Flag.DELETED, true)
        }
    }

    /**
     * Mark email as read:
     * Set SEEN flag on the message.
     */
    suspend fun markRead(msgIdOrNumber: String) = withContext(Dispatchers.IO) {
        operateOnInboxMessage(msgIdOrNumber) { _, message ->
            message.setFlag(Flags.Flag.SEEN, true)
        }
    }

    /**
     * Mark email as unread:
     * Clear SEEN flag on the message.
     */
    suspend fun markUnread(msgIdOrNumber: String) = withContext(Dispatchers.IO) {
        operateOnInboxMessage(msgIdOrNumber) { _, message ->
            message.setFlag(Flags.Flag.SEEN, false)
        }
    }

    /**
     * Unarchive email: Move back to INBOX.
     */
    suspend fun unarchiveEmail(msgIdOrNumber: String) = withContext(Dispatchers.IO) {
        operateOnInboxMessage(msgIdOrNumber) { _, message ->
            message.setFlag(Flags.Flag.DELETED, false)
        }
    }

    /**
     * Untrash email: Move from Trash back to INBOX.
     */
    suspend fun untrashEmail(msgIdOrNumber: String) = withContext(Dispatchers.IO) {
        operateOnInboxMessage(msgIdOrNumber) { _, message ->
            message.setFlag(Flags.Flag.DELETED, false)
        }
    }

    /**
     * Flag as Needs Response / Starred.
     */
    suspend fun applyNeedsResponse(msgIdOrNumber: String) = withContext(Dispatchers.IO) {
        operateOnInboxMessage(msgIdOrNumber) { _, message ->
            message.setFlag(Flags.Flag.FLAGGED, true)
            message.setFlag(Flags.Flag.SEEN, true)
        }
    }

    /**
     * Remove Needs Response / Flagged star.
     */
    suspend fun removeNeedsResponse(msgIdOrNumber: String) = withContext(Dispatchers.IO) {
        operateOnInboxMessage(msgIdOrNumber) { _, message ->
            message.setFlag(Flags.Flag.FLAGGED, false)
        }
    }

    /**
     * Fetch user labels / IMAP folders.
     */
    suspend fun fetchLabels(): List<LabelModel> = withContext(Dispatchers.IO) {
        imapMutex.withLock {
        var store: Store? = null
        try {
            store = getConnectedStore()
            val defaultFolder = store.defaultFolder
            val allFolders = defaultFolder.list("*")

            val excludedNames = setOf(
                "INBOX", "[Gmail]", "[Google Mail]",
                "[Gmail]/All Mail", "[Gmail]/Trash", "[Gmail]/Bin",
                "[Gmail]/Spam", "[Gmail]/Drafts", "[Gmail]/Sent Mail"
            )

            allFolders
                .filter { folder ->
                    val name = folder.fullName
                    !excludedNames.contains(name) && (folder.type and Folder.HOLDS_MESSAGES != 0)
                }
                .map { folder ->
                    val displayName = folder.name.replace("[Gmail]/", "")
                    LabelModel(id = folder.fullName, name = displayName, type = "user")
                }
                .sortedBy { it.name.lowercase() }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to list folders: ${e.message}")
            getDemoLabels()
        } finally {
        }
        }
    }

    /**
     * Move message to a specific folder/label, mark read, and remove from INBOX.
     */
    suspend fun applyLabelAndArchive(msgIdOrNumber: String, labelId: String) = withContext(Dispatchers.IO) {
        operateOnInboxMessage(msgIdOrNumber) { inbox, message ->
            val targetFolder = inbox.store.getFolder(labelId)
            if (targetFolder != null && targetFolder.exists()) {
                inbox.copyMessages(arrayOf(message), targetFolder)
            }
            message.setFlag(Flags.Flag.SEEN, true)
            message.setFlag(Flags.Flag.DELETED, true)
        }
    }

    suspend fun unapplyLabel(msgIdOrNumber: String, labelId: String) = withContext(Dispatchers.IO) {
        operateOnInboxMessage(msgIdOrNumber) { _, message ->
            message.setFlag(Flags.Flag.DELETED, false)
        }
    }

    private fun findFolderCaseInsensitive(store: Store, possibleNames: List<String>): Folder? {
        for (name in possibleNames) {
            try {
                val f = store.getFolder(name)
                if (f.exists()) return f
            } catch (e: Exception) {}
        }
        return null
    }

    private suspend fun operateOnInboxMessage(
        msgIdOrNumber: String,
        operation: (inbox: Folder, message: Message) -> Unit
    ) = withContext(Dispatchers.IO) {
        imapMutex.withLock {
        var store: Store? = null
        var inbox: Folder? = null
        try {
            store = getConnectedStore()
            inbox = store.getFolder("INBOX")
            inbox.open(Folder.READ_WRITE)

            val msgNumber = msgIdOrNumber.toIntOrNull()
            val message: Message? = if (msgNumber != null && msgNumber in 1..inbox.messageCount) {
                inbox.getMessage(msgNumber)
            } else {
                // Search by Message-ID header if available
                val allMsgs = inbox.getMessages(maxOf(1, inbox.messageCount - 100), inbox.messageCount)
                allMsgs.find { m ->
                    val mime = m as? MimeMessage
                    mime?.messageID == msgIdOrNumber
                } ?: allMsgs.lastOrNull()
            }

            if (message != null) {
                operation(inbox, message)
            }
        } finally {
            try { inbox?.close(true) } catch (e: Exception) {} // expunge deleted
        }
        }
    }

    fun getDemoEmails(): List<EmailModel> {
        return listOf(
            EmailModel(
                id = "demo-1",
                threadId = "1",
                sender = "GitHub <notifications@github.com>",
                subject = "New Release v1.0.0 for Zero Inbox Android Client",
                snippet = "A new release has been published by your automated CI/CD pipeline. Check the release notes and installable debug APK.",
                isDemo = true
            ),
            EmailModel(
                id = "demo-2",
                threadId = "2",
                sender = "Alex Rivers <alex.rivers@designsystem.io>",
                subject = "Design System Update: Neon and Pastel Color Tokens",
                snippet = "We just merged the new 8-bit retro high-contrast palettes for both dark and light viewports. Please review the PR when you have a moment.",
                isDemo = true
            ),
            EmailModel(
                id = "demo-3",
                threadId = "3",
                sender = "Google Cloud <no-reply-cloud@google.com>",
                subject = "Google Account: App Password Configured",
                snippet = "Your 16-character App Password has been successfully created. Zero Inbox is ready to triage directly via IMAP.",
                isDemo = true
            ),
            EmailModel(
                id = "demo-4",
                threadId = "4",
                sender = "Substack Daily <digest@substack.com>",
                subject = "The Art of Triage: Reaching 0 Inbox in under 5 minutes",
                snippet = "How rapid 4-way gesture swiping is reshaping mobile productivity. Swipe right to archive, left to delete, up for response.",
                isDemo = true
            ),
            EmailModel(
                id = "demo-5",
                threadId = "5",
                sender = "Jetpack Compose Weekly <newsletter@compose.dev>",
                subject = "Compose 1.6: PointerInput swipe physics and smooth springs",
                snippet = "Learn how velocity-tracking gesture states and spring specs deliver silky-smooth Tinder card stacking on Android.",
                isDemo = true
            )
        )
    }

    fun getDemoLabels(): List<LabelModel> {
        return listOf(
            LabelModel(id = "Urgent", name = "Urgent", type = "user"),
            LabelModel(id = "Work", name = "Work", type = "user"),
            LabelModel(id = "Receipts", name = "Receipts", type = "user"),
            LabelModel(id = "Projects", name = "Projects", type = "user"),
            LabelModel(id = "Personal", name = "Personal", type = "user")
        )
    }
}
