package com.qianrenskill.app.data

import org.junit.Test
import kotlin.test.assertEquals

class AppSettingsStoreTest {
    @Test
    fun settingsModelRoundTripUsesExpectedDefaults() {
        val settings = ApiSettings()
        assertEquals("", settings.baseUrl)
        assertEquals("", settings.apiKey)
        assertEquals("", settings.model)
    }
}
