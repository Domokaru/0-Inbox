package com.example.zeroinbox

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
    val type: String
)
