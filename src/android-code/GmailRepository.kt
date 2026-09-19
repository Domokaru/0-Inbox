package com.example.zeroinbox

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Modern Gmail API Repository utilizing Google OAuth 2.0 Access Tokens.
 * Interacts directly with official Google Gmail REST API v1 endpoints.
 */
class GmailRepository(
    private val context: Context,
    private val authManager: GoogleAuthManager
) {
    companion object {
        private const val TAG = "GmailRepository"
        private const val GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
    }

    var activeAccount: String? = null
        private set

    fun initialize(accountName: String) {
        activeAccount = accountName
    }

    fun getSavedAccountName(): String? {
        return activeAccount ?: authManager.getSavedEmail()
    }

    private fun getAuthToken(forceRefresh: Boolean = false): String {
        if (forceRefresh) {
            authManager.invalidateCurrentToken()
        }
        val token = authManager.getStoredAccessToken()
        if (token.isNullOrBlank()) {
            val account = authManager.getSavedAccount()
            if (account != null && account.account != null) {
                try {
                    val scopeStr = "oauth2:${GoogleAuthManager.GMAIL_SCOPE} ${GoogleAuthManager.GMAIL_SETTINGS_SCOPE}"
                    val freshToken = com.google.android.gms.auth.GoogleAuthUtil.getToken(
                        context,
                        account.account!!,
                        scopeStr
                    )
                    authManager.saveAccessToken(freshToken)
                    return freshToken
                } catch (e: Exception) {
                    try {
                        val scopeStrFallback = "oauth2:${GoogleAuthManager.GMAIL_SCOPE}"
                        val freshTokenFallback = com.google.android.gms.auth.GoogleAuthUtil.getToken(
                            context,
                            account.account!!,
                            scopeStrFallback
                        )
                        authManager.saveAccessToken(freshTokenFallback)
                        return freshTokenFallback
                    } catch (e2: Exception) {
                        throw IllegalStateException("Failed to obtain OAuth token: ${e2.message}", e2)
                    }
                }
            }
            throw IllegalStateException("No Google Account signed in. Please sign in with Google.")
        }
        return token
    }

    private fun makeRequest(
        urlStr: String,
        method: String = "GET",
        jsonBody: String? = null,
        isRetry: Boolean = false
    ): String {
        val token = getAuthToken(forceRefresh = isRetry)
        val url = URL(urlStr)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.setRequestProperty("Accept", "application/json")
        conn.connectTimeout = 15000
        conn.readTimeout = 15000

        if (jsonBody != null) {
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            OutputStreamWriter(conn.outputStream, "UTF-8").use { writer ->
                writer.write(jsonBody)
                writer.flush()
            }
        }

        val responseCode = conn.responseCode
        if (responseCode in 200..299) {
            return BufferedReader(InputStreamReader(conn.inputStream, "UTF-8")).use { reader ->
                reader.readText()
            }
        } else if (responseCode == 401 && !isRetry) {
            Log.w(TAG, "Gmail API returned 401 Unauthorized, refreshing token and retrying...")
            return makeRequest(urlStr, method, jsonBody, isRetry = true)
        } else {
            val errorStream = conn.errorStream
            val errorBody = if (errorStream != null) {
                BufferedReader(InputStreamReader(errorStream, "UTF-8")).use { it.readText() }
            } else {
                "HTTP $responseCode"
            }
            Log.e(TAG, "Gmail API Error [$responseCode]: $errorBody")
            throw RuntimeException("Gmail API call failed ($responseCode): $errorBody")
        }
    }

    suspend fun fetchEmails(
        pageToken: String? = null,
        filterTwoDays: Boolean = true
    ): Pair<List<EmailModel>, String?> = withContext(Dispatchers.IO) {
        var query = "in:inbox"
        if (filterTwoDays) {
            val twoDaysAgo = System.currentTimeMillis() - (2 * 24 * 60 * 60 * 1000L)
            val dateStr = SimpleDateFormat("yyyy/MM/dd", Locale.US).format(Date(twoDaysAgo))
            query += " after:$dateStr"
        }

        var url = "$GMAIL_API_BASE/messages?q=${java.net.URLEncoder.encode(query, "UTF-8")}&maxResults=30"
        if (!pageToken.isNullOrEmpty()) {
            url += "&pageToken=$pageToken"
        }

        val responseJson = makeRequest(url)
        val json = JSONObject(responseJson)
        val messagesArray = json.optJSONArray("messages") ?: JSONArray()
        val nextPageToken = json.optString("nextPageToken", "").ifEmpty { null }

        val emailList = mutableListOf<EmailModel>()
        for (i in 0 until messagesArray.length()) {
            val item = messagesArray.getJSONObject(i)
            val msgId = item.getString("id")
            val threadId = item.optString("threadId", msgId)

            try {
                val detailUrl = "$GMAIL_API_BASE/messages/$msgId?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date"
                val detailJsonStr = makeRequest(detailUrl)
                val detailJson = JSONObject(detailJsonStr)

                val snippet = detailJson.optString("snippet", "")
                val payload = detailJson.optJSONObject("payload")
                val headers = payload?.optJSONArray("headers") ?: JSONArray()

                var subject = "(No Subject)"
                var sender = "Unknown Sender"

                for (j in 0 until headers.length()) {
                    val header = headers.getJSONObject(j)
                    val name = header.optString("name", "")
                    val value = header.optString("value", "")
                    if (name.equals("Subject", ignoreCase = true)) {
                        subject = value
                    } else if (name.equals("From", ignoreCase = true)) {
                        sender = value
                    }
                }

                emailList.add(
                    EmailModel(
                        id = msgId,
                        threadId = threadId,
                        sender = sender,
                        subject = subject,
                        snippet = snippet,
                        isDemo = false
                    )
                )
            } catch (e: Exception) {
                Log.w(TAG, "Error fetching detail for message $msgId", e)
            }
        }

        Pair(emailList, nextPageToken)
    }

    suspend fun archiveEmail(threadId: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("removeLabelIds", JSONArray().put("INBOX"))
        }.toString()
        makeRequest("$GMAIL_API_BASE/threads/$threadId/modify", "POST", body)
    }

    suspend fun deleteEmail(threadId: String) = withContext(Dispatchers.IO) {
        makeRequest("$GMAIL_API_BASE/threads/$threadId/trash", "POST")
    }

    suspend fun trashEmail(threadId: String) = deleteEmail(threadId)

    suspend fun markRead(threadId: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("removeLabelIds", JSONArray().put("UNREAD"))
        }.toString()
        makeRequest("$GMAIL_API_BASE/threads/$threadId/modify", "POST", body)
    }

    suspend fun applyNeedsResponse(threadId: String) = withContext(Dispatchers.IO) {
        val labelId = getOrCreateLabelId("Needs Response")
        val body = JSONObject().apply {
            put("addLabelIds", JSONArray().put(labelId))
            put("removeLabelIds", JSONArray().put("INBOX"))
        }.toString()
        makeRequest("$GMAIL_API_BASE/threads/$threadId/modify", "POST", body)
    }

    suspend fun applyLabelAndArchive(threadId: String, labelId: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("addLabelIds", JSONArray().put(labelId))
            put("removeLabelIds", JSONArray().put("INBOX"))
        }.toString()
        makeRequest("$GMAIL_API_BASE/threads/$threadId/modify", "POST", body)
    }

    suspend fun unarchiveEmail(threadId: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("addLabelIds", JSONArray().put("INBOX"))
        }.toString()
        makeRequest("$GMAIL_API_BASE/threads/$threadId/modify", "POST", body)
    }

    suspend fun untrashEmail(threadId: String) = withContext(Dispatchers.IO) {
        makeRequest("$GMAIL_API_BASE/threads/$threadId/untrash", "POST")
    }

    suspend fun markUnread(threadId: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("addLabelIds", JSONArray().put("UNREAD"))
        }.toString()
        makeRequest("$GMAIL_API_BASE/threads/$threadId/modify", "POST", body)
    }

    suspend fun removeNeedsResponse(threadId: String) = withContext(Dispatchers.IO) {
        val labelId = getOrCreateLabelId("Needs Response")
        val body = JSONObject().apply {
            put("removeLabelIds", JSONArray().put(labelId))
            put("addLabelIds", JSONArray().put("INBOX"))
        }.toString()
        makeRequest("$GMAIL_API_BASE/threads/$threadId/modify", "POST", body)
    }

    suspend fun unapplyLabel(threadId: String, labelId: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("removeLabelIds", JSONArray().put(labelId))
            put("addLabelIds", JSONArray().put("INBOX"))
        }.toString()
        makeRequest("$GMAIL_API_BASE/threads/$threadId/modify", "POST", body)
    }

    suspend fun blockSender(senderRaw: String, threadId: String) = withContext(Dispatchers.IO) {
        val extractedEmail = run {
            val match = Regex("<([^>]+)>").find(senderRaw)
            match?.groupValues?.get(1)?.trim() ?: run {
                val emailRegex = Regex("([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})")
                emailRegex.find(senderRaw)?.value?.trim() ?: senderRaw.trim()
            }
        }
        // 1. Create Gmail filter to automatically trash future messages from this sender
        try {
            val filterBody = JSONObject().apply {
                put("criteria", JSONObject().apply {
                    put("from", extractedEmail)
                })
                put("action", JSONObject().apply {
                    put("removeLabelIds", JSONArray().put("INBOX"))
                    put("addLabelIds", JSONArray().put("TRASH"))
                })
            }.toString()
            makeRequest("$GMAIL_API_BASE/settings/filters", "POST", filterBody)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 2. Trash the current thread
        try {
            deleteEmail(threadId)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun fetchLabels(): List<LabelModel> = withContext(Dispatchers.IO) {
        val response = makeRequest("$GMAIL_API_BASE/labels")
        val json = JSONObject(response)
        val labelsArray = json.optJSONArray("labels") ?: JSONArray()
        val list = mutableListOf<LabelModel>()
        for (i in 0 until labelsArray.length()) {
            val item = labelsArray.getJSONObject(i)
            val id = item.getString("id")
            val name = item.getString("name")
            val type = item.optString("type", "user")
            // Show user labels and important system labels
            if (type.equals("user", ignoreCase = true) || id in listOf("STARRED", "IMPORTANT")) {
                list.add(LabelModel(id = id, name = name, type = type))
            }
        }
        list
    }

    private suspend fun getOrCreateLabelId(labelName: String): String = withContext(Dispatchers.IO) {
        val labels = fetchLabels()
        val existing = labels.find { it.name.equals(labelName, ignoreCase = true) }
        if (existing != null) return@withContext existing.id

        val body = JSONObject().apply {
            put("name", labelName)
            put("labelListVisibility", "labelShow")
            put("messageListVisibility", "show")
        }.toString()
        val response = makeRequest("$GMAIL_API_BASE/labels", "POST", body)
        JSONObject(response).getString("id")
    }

    fun getDemoEmails(): List<EmailModel> {
        return listOf(
            EmailModel(
                id = "demo-1",
                threadId = "demo-1",
                sender = "Sarah Connor <sarah@skynet-prevention.org>",
                subject = "Critical: Timeline assessment meeting tomorrow at 09:00",
                snippet = "Ben, we need to finalize the quarterly defensive logistics strategy before the noon board briefing. Let me know if you are attending.",
                isDemo = true
            ),
            EmailModel(
                id = "demo-2",
                threadId = "demo-2",
                sender = "GitHub <notifications@github.com>",
                subject = "[0-Inbox] Release v1.0.1 deployed successfully",
                snippet = "Your build #482 passed all test suites and the release artifact is now available on Cloud Run.",
                isDemo = true
            ),
            EmailModel(
                id = "demo-3",
                threadId = "demo-3",
                sender = "Stripe Billing <invoices@stripe.com>",
                subject = "Your receipt for Zero Inbox Workspace Pro",
                snippet = "Amount paid: $24.00 USD. Payment method: Apple Pay (Visa ending in 4242). Thank you for your business!",
                isDemo = true
            )
        )
    }

    fun getDemoLabels(): List<LabelModel> {
        return listOf(
            LabelModel(id = "label-work", name = "Work", type = "user"),
            LabelModel(id = "label-receipts", name = "Receipts", type = "user"),
            LabelModel(id = "label-personal", name = "Personal", type = "user"),
            LabelModel(id = "label-newsletter", name = "Newsletters", type = "user"),
            LabelModel(id = "label-projects", name = "Projects", type = "user")
        )
    }
}
