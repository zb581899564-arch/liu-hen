package com.qianrenskill.app.data

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProfileRepositoryTest {
    @Test
    fun profileSourceKindsMatchBridgeContract() {
        assertEquals("builtin", ProfileSource.BUILTIN.value)
        assertEquals("imported", ProfileSource.IMPORTED.value)
    }

    @Test
    fun importedProfileJsonParsingFallsBackToEmptyListWhenBroken() {
        val parsed = ProfileRepository.parseStoredProfiles("not-json")
        assertTrue(parsed.isEmpty())
    }

    @Test
    fun importedProfileJsonParsesRelativeLocationAndEnumType() {
        val json = """
            [
              {
                "id": "p1",
                "displayName": "A",
                "sourceType": "imported",
                "originalFileName": "a.exprofile.zip",
                "importedAt": 123,
                "location": "profiles/a.exprofile.zip"
              }
            ]
        """.trimIndent()

        val parsed = ProfileRepository.parseStoredProfiles(json)

        assertEquals(1, parsed.size)
        assertEquals(ProfileSource.IMPORTED, parsed.first().sourceType)
        assertEquals("profiles/a.exprofile.zip", parsed.first().location)
    }
}
