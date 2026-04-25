package com.qianrenskill.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class ProfileRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("profiles", Context.MODE_PRIVATE)
    private val profileDir = File(context.filesDir, "profiles").apply {
        if (!exists() && !mkdirs()) {
            throw IllegalStateException("Unable to create profiles directory: $absolutePath")
        }
    }

    fun listImportedProfiles(): List<StoredProfile> {
        val raw = prefs.getString("profiles_json", "[]") ?: "[]"
        return parseStoredProfiles(raw)
    }

    fun listBuiltinProfiles(): List<StoredProfile> {
        val bundled = StoredProfile(
            id = "builtin-sample-contact",
            displayName = "Sample Contact.",
            sourceType = ProfileSource.BUILTIN,
            originalFileName = "sample-contact.exprofile.zip",
            importedAt = 0L,
            location = "profiles/sample-contact.exprofile.zip",
        )
        return if (builtinAssetExists(bundled.location)) listOf(bundled) else emptyList()
    }

    @Synchronized
    fun saveImportedProfile(profile: StoredProfile) {
        val newList = listImportedProfiles().filterNot { it.id == profile.id } + profile
        val array = JSONArray()
        newList.forEach { item ->
            array.put(
                JSONObject()
                    .put("id", item.id)
                    .put("displayName", item.displayName)
                    .put("sourceType", item.sourceType.value)
                    .put("originalFileName", item.originalFileName)
                    .put("importedAt", item.importedAt)
                    .put("location", item.location)
            )
        }
        prefs.edit().putString("profiles_json", array.toString()).commit()
    }

    fun profilesDirectory(): File = profileDir

    fun resolveLocation(profile: StoredProfile): String {
        return when (profile.sourceType) {
            ProfileSource.BUILTIN -> "file:///android_asset/${profile.location}"
            ProfileSource.IMPORTED -> File(context.filesDir, profile.location).absolutePath
        }
    }

    companion object {
        fun parseStoredProfiles(raw: String): List<StoredProfile> {
            return try {
                val array = JSONArray(raw)
                buildList {
                    for (index in 0 until array.length()) {
                        val obj = array.optJSONObject(index) ?: continue
                        val source = when (obj.optString("sourceType")) {
                            ProfileSource.BUILTIN.value -> ProfileSource.BUILTIN
                            ProfileSource.IMPORTED.value -> ProfileSource.IMPORTED
                            else -> continue
                        }
                        val id = obj.optString("id")
                        val originalFileName = obj.optString("originalFileName")
                        val location = obj.optString("location")
                        if (id.isBlank() || originalFileName.isBlank() || location.isBlank()) {
                            continue
                        }
                        add(
                            StoredProfile(
                                id = id,
                                displayName = obj.optString("displayName", "\u65b0\u8054\u7cfb\u4eba"),
                                sourceType = source,
                                originalFileName = originalFileName,
                                importedAt = obj.optLong("importedAt", 0L),
                                location = location,
                            )
                        )
                    }
                }
            } catch (_error: Exception) {
                emptyList()
            }
        }
    }

    private fun builtinAssetExists(path: String): Boolean {
        return try {
            context.assets.open(path).close()
            true
        } catch (_error: Exception) {
            false
        }
    }
}
