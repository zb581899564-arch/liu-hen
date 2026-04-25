package com.qianrenskill.app.data

import android.content.Context

class AppSettingsStore(context: Context) {
    private val prefs = context.getSharedPreferences("app_settings", Context.MODE_PRIVATE)

    fun load(): ApiSettings {
        return ApiSettings(
            baseUrl = prefs.getString("baseUrl", "") ?: "",
            apiKey = prefs.getString("apiKey", "") ?: "",
            model = prefs.getString("model", "") ?: "",
        )
    }

    fun save(settings: ApiSettings) {
        prefs.edit()
            .putString("baseUrl", settings.baseUrl)
            .putString("apiKey", settings.apiKey)
            .putString("model", settings.model)
            .commit()
    }
}
