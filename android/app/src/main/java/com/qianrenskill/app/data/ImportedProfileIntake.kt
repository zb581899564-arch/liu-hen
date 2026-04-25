package com.qianrenskill.app.data

import android.content.Context
import android.net.Uri
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.zip.ZipFile

class ImportedProfileIntake(
    private val context: Context,
    private val profileRepository: ProfileRepository,
) {
    fun importFromUri(uri: Uri): StoredProfile {
        val now = System.currentTimeMillis()
        val fileName = resolveFileName(uri).ifBlank { "profile-$now.exprofile.zip" }
        val normalizedFileName = ensureZipExtension(fileName)
        val profileId = "imported-${UUID.randomUUID()}"
        val destination = File(profileRepository.profilesDirectory(), "$profileId.exprofile.zip")

        try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(destination).use { output ->
                    input.copyTo(output)
                }
            } ?: error("Unable to open selected profile")

            val displayName = extractDisplayNameFromZip(destination, normalizedFileName)
            val storedProfile = StoredProfile(
                id = profileId,
                displayName = displayName,
                sourceType = ProfileSource.IMPORTED,
                originalFileName = normalizedFileName,
                importedAt = now,
                location = "profiles/${destination.name}",
            )
            profileRepository.saveImportedProfile(storedProfile)
            return storedProfile
        } catch (error: Exception) {
            destination.delete()
            throw error
        }
    }

    private fun resolveFileName(uri: Uri): String {
        val projection = arrayOf(android.provider.OpenableColumns.DISPLAY_NAME)
        context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (index >= 0) {
                    return cursor.getString(index).orEmpty()
                }
            }
        }
        return uri.lastPathSegment.orEmpty().substringAfterLast('/')
    }

    companion object {
        fun extractDisplayNameFromZip(file: File, fallbackFileName: String = file.name): String {
            ZipFile(file).use { zip ->
                val metaEntry = zip.getEntry("profile/meta.json")
                if (metaEntry != null) {
                    val metaText = zip.getInputStream(metaEntry).bufferedReader(Charsets.UTF_8).use { it.readText() }
                    val meta = JSONObject(metaText)
                    val name = meta.optString("name").trim()
                    if (name.isNotEmpty()) {
                        return name
                    }
                }

                val manifestEntry = zip.getEntry("manifest.json")
                if (manifestEntry != null) {
                    val manifestText = zip.getInputStream(manifestEntry).bufferedReader(Charsets.UTF_8).use { it.readText() }
                    val manifest = JSONObject(manifestText)
                    val name = manifest.optString("name").trim()
                    if (name.isNotEmpty()) {
                        return name
                    }
                }
            }

            return fallbackFileName.ifBlank { "\u65b0\u8054\u7cfb\u4eba" }
        }

        private fun ensureZipExtension(name: String): String {
            return if (name.lowercase().endsWith(".zip")) {
                name
            } else {
                "$name.zip"
            }
        }
    }
}
