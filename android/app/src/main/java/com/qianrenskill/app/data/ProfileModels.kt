package com.qianrenskill.app.data

data class ApiSettings(
    val baseUrl: String = "",
    val apiKey: String = "",
    val model: String = "",
)

enum class ProfileSource(val value: String) {
    BUILTIN("builtin"),
    IMPORTED("imported"),
}

data class StoredProfile(
    val id: String,
    val displayName: String,
    val sourceType: ProfileSource,
    val originalFileName: String,
    val importedAt: Long,
    val location: String,
)
