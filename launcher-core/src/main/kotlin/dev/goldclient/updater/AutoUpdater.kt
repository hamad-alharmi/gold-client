package dev.goldclient.updater

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.URI
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest

@Serializable
data class UpdateManifest(
    val version: String,
    val releaseDate: String,
    val channel: String,
    val changelog: String,
    val platforms: Map<String, PlatformAsset>,
    val minLauncherVersion: String,
    val forceUpdate: Boolean
)

@Serializable
data class PlatformAsset(
    val url: String,
    val checksum: String,
    val size: Long
)

object AutoUpdater {
    private const val MANIFEST_URL =
        "https://hamad-alharmi.github.io/gold-client/update-manifest/manifest.json"
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun checkForUpdate(currentVersion: String): UpdateManifest? =
        withContext(Dispatchers.IO) {
            runCatching {
                val raw = URI(MANIFEST_URL).toURL().readText()
                val manifest = json.decodeFromString<UpdateManifest>(raw)
                if (isNewerVersion(manifest.version, currentVersion)) manifest else null
            }.getOrNull()
        }

    suspend fun downloadUpdate(
        asset: PlatformAsset,
        dest: Path,
        onProgress: (Float) -> Unit
    ) = withContext(Dispatchers.IO) {
        val conn = URI(asset.url).toURL().openConnection()
        val total = conn.contentLengthLong
        var downloaded = 0L
        conn.getInputStream().use { input ->
            Files.newOutputStream(dest).use { output ->
                val buf = ByteArray(8192)
                var n: Int
                while (input.read(buf).also { n = it } != -1) {
                    output.write(buf, 0, n)
                    downloaded += n
                    onProgress(downloaded.toFloat() / total)
                }
            }
        }
        verifyChecksum(dest, asset.checksum)
    }

    private fun verifyChecksum(file: Path, expected: String): Boolean {
        if (expected.isBlank()) return true // skip if manifest has no checksum yet
        val digest = MessageDigest.getInstance("SHA-256")
        Files.newInputStream(file).use { stream ->
            val buf = ByteArray(8192)
            var n: Int
            while (stream.read(buf).also { n = it } != -1)
                digest.update(buf, 0, n)
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        check(actual == expected) { "Checksum mismatch: got $actual, expected $expected" }
        return true
    }

    private fun isNewerVersion(remote: String, local: String): Boolean {
        fun parse(v: String) = v.trimStart('v').split(".")
            .map { it.filter(Char::isDigit).toIntOrNull() ?: 0 }
        val r = parse(remote); val l = parse(local)
        for (i in 0 until maxOf(r.size, l.size)) {
            val rv = r.getOrElse(i) { 0 }; val lv = l.getOrElse(i) { 0 }
            if (rv > lv) return true; if (rv < lv) return false
        }
        return false
    }
}
