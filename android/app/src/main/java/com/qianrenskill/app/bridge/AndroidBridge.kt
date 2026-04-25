package com.qianrenskill.app.bridge

import android.content.Context
import android.util.Base64
import android.webkit.JavascriptInterface
import com.qianrenskill.app.data.ApiSettings
import com.qianrenskill.app.data.AppSettingsStore
import com.qianrenskill.app.data.ProfileRepository
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.util.zip.ZipInputStream

class AndroidBridge(
    private val context: Context,
    private val settingsStore: AppSettingsStore,
    private val profileRepository: ProfileRepository,
    private val importLauncher: () -> Unit,
    private val dispatchScript: (String) -> Unit,
) {
    private val chatPersistenceFile = File(context.filesDir, "chat_persistence.json")
    private val appearanceFile = File(context.filesDir, "appearance.json")

    private val requiredProfileFiles = listOf(
        "meta.json",
        "persona.md",
        "relationship_context.md",
        "response_patterns.md",
        "memories.md",
        "sticker_profile.json",
        "sticker_library.json",
    )
    private val exSkillRequiredProfileFiles = listOf(
        "meta.json",
        "SKILL.md",
        "persona.md",
        "memories.md",
    )

    @JavascriptInterface
    fun getAppInfo(): String = JSONObject().put("platform", "android").toString()

    @JavascriptInterface
    fun loadSettings(): String {
        val settings = settingsStore.load()
        return JSONObject()
            .put("baseUrl", settings.baseUrl)
            .put("apiKey", settings.apiKey)
            .put("model", settings.model)
            .toString()
    }

    @JavascriptInterface
    fun saveSettings(payload: String) {
        val obj = JSONObject(payload)
        settingsStore.save(
            ApiSettings(
                baseUrl = obj.optString("baseUrl"),
                apiKey = obj.optString("apiKey"),
                model = obj.optString("model"),
            )
        )
    }

    @JavascriptInterface
    fun loadChatPersistence(): String {
        return try {
            if (chatPersistenceFile.exists()) {
                chatPersistenceFile.readText(Charsets.UTF_8)
            } else {
                "{}"
            }
        } catch (error: Exception) {
            JSONObject()
                .put("error", error.message ?: "failed to load chat persistence")
                .toString()
        }
    }

    @JavascriptInterface
    fun saveChatPersistence(payload: String) {
        val parsed = JSONObject(payload)
        chatPersistenceFile.parentFile?.mkdirs()
        chatPersistenceFile.writeText(parsed.toString(), Charsets.UTF_8)
    }

    @JavascriptInterface
    fun loadAppearance(): String {
        return try {
            if (appearanceFile.exists()) {
                appearanceFile.readText(Charsets.UTF_8)
            } else {
                "{}"
            }
        } catch (error: Exception) {
            JSONObject()
                .put("error", error.message ?: "failed to load appearance")
                .toString()
        }
    }

    @JavascriptInterface
    fun saveAppearance(payload: String) {
        val parsed = JSONObject(payload)
        appearanceFile.parentFile?.mkdirs()
        appearanceFile.writeText(parsed.toString(), Charsets.UTF_8)
    }

    @JavascriptInterface
    fun sendChatRequest(endpoint: String, apiKey: String, payload: String): String {
        return try {
            val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 30_000
                readTimeout = 90_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                if (apiKey.isNotBlank()) {
                    setRequestProperty("Authorization", "Bearer $apiKey")
                }
            }

            connection.outputStream.use { stream ->
                stream.write(payload.toByteArray(Charsets.UTF_8))
            }

            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(Charsets.UTF_8)
                ?.use { reader -> reader.readText() }
                ?: ""
            connection.disconnect()

            if (status in 200..299) {
                body
            } else {
                JSONObject()
                    .put("error", "接口请求失败：$status $body")
                    .toString()
            }
        } catch (error: Exception) {
            JSONObject()
                .put("error", error.message ?: "网络请求失败")
                .toString()
        }
    }

    @JavascriptInterface
    fun sendChatRequestAsync(requestId: String, endpoint: String, apiKey: String, payload: String) {
        Thread {
            val response = sendChatRequest(endpoint, apiKey, payload)
            val script = "window.ExProfileNativeCallbacks&&window.ExProfileNativeCallbacks.resolve(" +
                "${JSONObject.quote(requestId)},${JSONObject.quote(response)});"
            dispatchScript(script)
        }.start()
    }

    @JavascriptInterface
    fun loadProfileFiles(location: String): String {
        return try {
            val wanted = (requiredProfileFiles + exSkillRequiredProfileFiles).associateBy { fileName -> fileName }
            val files = linkedMapOf<String, String>()

            openArchive(location).use { input ->
                ZipInputStream(input).use { zip ->
                    while (true) {
                        val entry = zip.nextEntry ?: break
                        val normalizedName = normalizeProfileEntryName(entry.name)
                        val outputName = wanted[normalizedName]
                        if (!entry.isDirectory) {
                            when {
                                outputName != null -> files[outputName] = zip.readBytes().toString(Charsets.UTF_8)
                                normalizedName.startsWith("knowledge/") || normalizedName.startsWith("versions/") ->
                                    files[normalizedName] = zip.readBytes().toString(Charsets.UTF_8)
                            }
                        }
                        zip.closeEntry()
                    }
                }
            }

            val hasAppProfile = requiredProfileFiles.all { files.containsKey(it) }
            val hasExSkillProfile = exSkillRequiredProfileFiles.all { files.containsKey(it) }
            if (!hasAppProfile && !hasExSkillProfile) {
                val missing = (requiredProfileFiles + exSkillRequiredProfileFiles)
                    .distinct()
                    .filterNot { files.containsKey(it) }
                return JSONObject()
                    .put("error", "missing profile files: ${missing.joinToString(", ")}")
                    .toString()
            }

            val fileJson = JSONObject()
            files.forEach { (name, content) ->
                fileJson.put(name, content)
            }

            JSONObject()
                .put("files", fileJson)
                .toString()
        } catch (error: Exception) {
            JSONObject()
                .put("error", error.message ?: "failed to load profile")
                .toString()
        }
    }

    @JavascriptInterface
    fun loadStickerDataUrl(location: String, archivePath: String): String {
        return try {
            if (archivePath.isBlank() || archivePath.contains("..")) {
                return JSONObject().put("error", "invalid sticker path").toString()
            }

            openArchive(location).use { input ->
                ZipInputStream(input).use { zip ->
                    while (true) {
                        val entry = zip.nextEntry ?: break
                        if (!entry.isDirectory && entry.name == archivePath) {
                            val bytes = zip.readBytes()
                            val encoded = Base64.encodeToString(bytes, Base64.NO_WRAP)
                            return JSONObject()
                                .put("dataUrl", "data:${mimeTypeForPath(archivePath)};base64,$encoded")
                                .toString()
                        }
                        zip.closeEntry()
                    }
                }
            }

            JSONObject().put("error", "sticker not found: $archivePath").toString()
        } catch (error: Exception) {
            JSONObject()
                .put("error", error.message ?: "failed to load sticker")
                .toString()
        }
    }

    @JavascriptInterface
    fun listBuiltinProfiles(): String = JSONArray(
        profileRepository.listBuiltinProfiles().map { profile ->
            JSONObject()
                .put("id", profile.id)
                .put("displayName", profile.displayName)
                .put("sourceType", profile.sourceType.value)
                .put("originalFileName", profile.originalFileName)
                .put("importedAt", profile.importedAt)
                .put("location", profileRepository.resolveLocation(profile))
        }
    ).toString()

    @JavascriptInterface
    fun listImportedProfiles(): String = JSONArray(
        profileRepository.listImportedProfiles().map { profile ->
            JSONObject()
                .put("id", profile.id)
                .put("displayName", profile.displayName)
                .put("sourceType", profile.sourceType.value)
                .put("originalFileName", profile.originalFileName)
                .put("importedAt", profile.importedAt)
                .put("location", profileRepository.resolveLocation(profile))
        }
    ).toString()

    @JavascriptInterface
    fun importProfileFromPicker() {
        importLauncher()
    }

    private fun openArchive(location: String): InputStream {
        val assetPrefix = "file:///android_asset/"
        if (location.startsWith(assetPrefix)) {
            return context.assets.open(location.removePrefix(assetPrefix))
        }

        val filePath = when {
            location.startsWith("file://") -> URLDecoder.decode(location.removePrefix("file://"), "UTF-8")
            else -> location
        }
        return File(filePath).inputStream()
    }

    private fun normalizeProfileEntryName(name: String): String {
        val withoutProfile = name.removePrefix("profile/")
        if (withoutProfile.startsWith("knowledge/") || withoutProfile.startsWith("versions/")) {
            return withoutProfile
        }
        val parts = withoutProfile.split("/")
        if (parts.size >= 2 && (parts[1] == "knowledge" || parts[1] == "versions")) {
            return parts.drop(1).joinToString("/")
        }
        return parts.lastOrNull().orEmpty()
    }

    private fun mimeTypeForPath(path: String): String {
        return when (path.substringAfterLast('.', "").lowercase()) {
            "gif" -> "image/gif"
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "webp" -> "image/webp"
            else -> "application/octet-stream"
        }
    }
}
