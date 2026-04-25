package com.qianrenskill.app.data

import org.junit.Test
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.test.assertEquals

class ImportedProfileIntakeTest {
    @Test
    fun extractDisplayNameFromZipPrefersMetaName() {
        val zip = File.createTempFile("profile-meta", ".zip")
        zip.deleteOnExit()

        ZipOutputStream(zip.outputStream()).use { output ->
            output.putNextEntry(ZipEntry("profile/meta.json"))
            output.write("""{"name":"Sample Contact"}""".toByteArray(Charsets.UTF_8))
            output.closeEntry()
        }

        val displayName = ImportedProfileIntake.extractDisplayNameFromZip(zip)

        assertEquals("Sample Contact", displayName)
    }

    @Test
    fun extractDisplayNameFromZipFallsBackToManifestName() {
        val zip = File.createTempFile("profile-manifest", ".zip")
        zip.deleteOnExit()

        ZipOutputStream(zip.outputStream()).use { output ->
            output.putNextEntry(ZipEntry("manifest.json"))
            output.write("""{"name":"另一个联系人"}""".toByteArray(Charsets.UTF_8))
            output.closeEntry()
        }

        val displayName = ImportedProfileIntake.extractDisplayNameFromZip(zip)

        assertEquals("另一个联系人", displayName)
    }

    @Test
    fun extractDisplayNameFromZipFallsBackToProvidedFileName() {
        val zip = File.createTempFile("profile-empty", ".zip")
        zip.deleteOnExit()

        ZipOutputStream(zip.outputStream()).use { output ->
            output.putNextEntry(ZipEntry("manifest.json"))
            output.write("""{}""".toByteArray(Charsets.UTF_8))
            output.closeEntry()
        }

        val displayName = ImportedProfileIntake.extractDisplayNameFromZip(zip, "sample.exprofile.zip")

        assertEquals("sample.exprofile.zip", displayName)
    }
}
